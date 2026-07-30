/**
 * Restore tables from an export produced by export-tables.ts.
 *
 * An untested backup is not a backup. This script exists so the restore
 * path is a rehearsed procedure rather than something improvised during
 * an incident.
 *
 * SAFETY: refuses to run unless CONFIRM_RESTORE_TO matches the target
 * account name. Restoring into the wrong account would overwrite live
 * data with a snapshot — the exact disaster the backup exists to prevent.
 *
 * Restore into a scratch account first, time it, and record the number
 * in docs/. That number is your RTO.
 *
 * Usage:
 *   AZURE_STORAGE_ACCOUNT_NAME=stscratchdev \
 *   CONFIRM_RESTORE_TO=stscratchdev \
 *   EXPORT_DIR=./export \
 *   npx ts-node scripts/restore-tables.ts
 */

import { TableClient, TableServiceClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { createReadStream, readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createGunzip } from 'zlib'
import { createInterface } from 'readline'

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME
const confirm = process.env.CONFIRM_RESTORE_TO
const inDir = process.env.EXPORT_DIR || './export'

// See the note in export-tables.ts — present so the restore path can be
// rehearsed against Azurite instead of only ever being attempted for the
// first time during an actual incident.
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING

if (!account && !connectionString) {
  console.error(
    'Set AZURE_STORAGE_ACCOUNT_NAME (production) or ' +
      'AZURE_STORAGE_CONNECTION_STRING (emulator / testing)',
  )
  process.exit(1)
}
if (confirm !== (account ?? 'emulator')) {
  console.error(
    `Refusing to run.\n` +
      `  Target account:      ${account ?? 'emulator'}\n` +
      `  CONFIRM_RESTORE_TO:  ${confirm ?? '(unset)'}\n\n` +
      `Set CONFIRM_RESTORE_TO to the target account name to proceed ` +
      `(use "emulator" when running against a connection string).`,
  )
  process.exit(1)
}
if (!existsSync(inDir)) {
  console.error(`Export directory not found: ${inDir}`)
  process.exit(1)
}

const endpoint = `https://${account}.table.core.windows.net`
const credential = new DefaultAzureCredential()
const allowInsecureConnection = Boolean(connectionString)

function serviceClient(): TableServiceClient {
  return connectionString
    ? TableServiceClient.fromConnectionString(connectionString, { allowInsecureConnection })
    : new TableServiceClient(endpoint, credential)
}

function tableClient(name: string): TableClient {
  return connectionString
    ? TableClient.fromConnectionString(connectionString, name, { allowInsecureConnection })
    : new TableClient(endpoint, name, credential)
}

/** Fields Table Storage manages itself — must not be written back. */
const MANAGED_FIELDS = new Set(['etag', 'odata.etag', 'timestamp'])

function stripManaged(entity: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(entity)) {
    if (!MANAGED_FIELDS.has(k) && !MANAGED_FIELDS.has(k.toLowerCase())) {
      out[k] = v
    }
  }
  return out
}

async function restoreTable(file: string): Promise<number> {
  const name = file.replace(/\.ndjson\.gz$/, '')
  const svc = serviceClient()
  try {
    await svc.createTable(name)
  } catch {
    // Already exists — fine, upsert below is idempotent.
  }

  const client = tableClient(name)
  const rl = createInterface({
    input: createReadStream(join(inDir, file)).pipe(createGunzip()),
    crlfDelay: Infinity,
  })

  let restored = 0
  for await (const line of rl) {
    if (!line.trim()) continue
    const entity = stripManaged(JSON.parse(line))
    // Upsert rather than create so a partial restore can be re-run.
    await client.upsertEntity(entity as never, 'Replace')
    restored++
  }
  return restored
}

async function main(): Promise<void> {
  const manifestPath = join(inDir, 'manifest.json')
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
    console.log(`Export taken ${m.exportedAt} from ${m.account}`)
    console.log(`Expecting ${m.tableCount} tables, ${m.totalRows} rows\n`)
  }

  const files = readdirSync(inDir).filter((f) => f.endsWith('.ndjson.gz')).sort()
  if (files.length === 0) {
    console.error('No .ndjson.gz files found')
    process.exit(1)
  }

  const started = Date.now()
  let total = 0
  for (const file of files) {
    const n = await restoreTable(file)
    total += n
    console.log(`  ${file}: ${n} rows`)
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\nRestored ${files.length} tables, ${total} rows in ${seconds}s`)
  console.log(`\nThat elapsed time is your measured RTO — record it in docs/.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
