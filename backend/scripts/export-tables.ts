/**
 * Full export of every Table Storage table to gzipped NDJSON.
 *
 * Why this exists
 * ───────────────
 * The storage account holding every order, invoice and customer record is
 * Standard_LRS in a single region, with no soft-delete on tables and no
 * point-in-time restore. LRS survives a disk failure; it does not survive
 * an accidental delete, a bad migration, or a compromised credential —
 * it replicates all three faithfully.
 *
 * Geo-redundant storage would cost roughly double. An off-Azure export
 * costs nothing and covers strictly more failure modes, including loss of
 * the subscription itself.
 *
 * Runs in GitHub Actions against production using the OIDC-federated
 * service principal (needs `Storage Table Data Reader`). Output is
 * uploaded as a workflow artifact.
 *
 * Format: one gzipped NDJSON file per table, plus manifest.json with row
 * counts. NDJSON streams, so memory stays flat regardless of table size,
 * and it round-trips cleanly through restore-tables.ts.
 *
 * Usage:  EXPORT_DIR=./export npx ts-node scripts/export-tables.ts
 */

import { TableClient, TableServiceClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { createWriteStream, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME
const outDir = process.env.EXPORT_DIR || './export'

// A connection string, when present, takes precedence. This exists so the
// export can be exercised against Azurite — a backup script that has never
// been run end-to-end is a hope, not a backup, and hard-coding the
// *.table.core.windows.net endpoint made it impossible to test anywhere
// but production.
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING

if (!account && !connectionString) {
  console.error(
    'Set AZURE_STORAGE_ACCOUNT_NAME (production) or ' +
      'AZURE_STORAGE_CONNECTION_STRING (emulator / testing)',
  )
  process.exit(1)
}

const endpoint = `https://${account}.table.core.windows.net`
const credential = new DefaultAzureCredential()
const allowInsecure = Boolean(connectionString)

function serviceClient(): TableServiceClient {
  return connectionString
    ? TableServiceClient.fromConnectionString(connectionString, {
        allowInsecureConnection: allowInsecure,
      })
    : new TableServiceClient(endpoint, credential)
}

function tableClient(name: string): TableClient {
  return connectionString
    ? TableClient.fromConnectionString(connectionString, name, {
        allowInsecureConnection: allowInsecure,
      })
    : new TableClient(endpoint, name, credential)
}

async function listTableNames(): Promise<string[]> {
  const svc = serviceClient()
  const names: string[] = []
  for await (const t of svc.listTables()) {
    if (t.name) names.push(t.name)
  }
  return names.sort()
}

async function exportTable(name: string): Promise<number> {
  const client = tableClient(name)
  let count = 0

  async function* lines(): AsyncGenerator<string> {
    for await (const entity of client.listEntities()) {
      count++
      yield JSON.stringify(entity) + '\n'
    }
  }

  await pipeline(
    Readable.from(lines()),
    createGzip(),
    createWriteStream(join(outDir, `${name}.ndjson.gz`)),
  )
  return count
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true })

  const tables = await listTableNames()
  if (tables.length === 0) {
    console.error('No tables found — refusing to write an empty backup')
    process.exit(1)
  }

  const counts: Record<string, number> = {}
  for (const name of tables) {
    counts[name] = await exportTable(name)
    console.log(`  ${name}: ${counts[name]} rows`)
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: account ?? '(connection-string)',
        tableCount: tables.length,
        tables: counts,
        totalRows: total,
      },
      null,
      2,
    ),
  )

  console.log(`\nExported ${tables.length} tables, ${total} rows total`)

  // A silent zero-row backup is worse than no backup, because it looks
  // like success. Fail the workflow instead.
  if (total === 0) {
    console.error('Export produced 0 rows across all tables — failing')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
