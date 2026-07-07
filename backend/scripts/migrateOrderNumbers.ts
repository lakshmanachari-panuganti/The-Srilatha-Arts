/**
 * One-time migration: renumber every existing order from the legacy
 * TSA-YYYY-HEX format to the new YYYYMMDDHHMMSSFF (IST) format.
 *
 * Why row-copy + delete: Azure Table Storage RowKey is immutable. To
 * change an order's id we have to:
 *   1. Read the original row (and every dependent row)
 *   2. Write copies with the new key
 *   3. Delete the originals
 *
 * Dependent tables touched:
 *   - orders             (RowKey  = orderId)
 *   - orderItems         (PK      = orderId)
 *   - orderEvents        (PK      = orderId)
 *   - ordersByStatus     (RowKey  = "{createdAt}_{orderId}")
 *   - couponRedemptions  (RowKey  = orderId, scanned across PKs)
 *
 * Defaults to DRY RUN. Pass --apply to commit.
 *
 * Usage (PowerShell):
 *   $env:AZURE_STORAGE_ACCOUNT_NAME="stthesrilathaartsdev"
 *   npx ts-node scripts/migrateOrderNumbers.ts          # dry run
 *   npx ts-node scripts/migrateOrderNumbers.ts --apply  # commit
 *
 * Requires: az login (DefaultAzureCredential).
 *
 * IMPORTANT: take a Table Storage snapshot/export before running with
 * --apply against production. The script is conservative (copy-before-
 * delete) but a botched migration is impossible to roll back without
 * a snapshot.
 */

import { TableClient } from '@azure/data-tables'
import { AzureCliCredential } from '@azure/identity'
import { formatOrderNumber } from '../src/services/orderNumber'

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'stthesrilathaartsdev'
const APPLY = process.argv.includes('--apply')

type Row = Record<string, unknown> & {
  partitionKey: string
  rowKey: string
  etag?: string
  timestamp?: Date
}

// Migration runs from a developer's box - AzureCliCredential matches
// what's used in seedAdmin.ts and avoids the EnvironmentCredential
// path (which fails noisily when stale SP creds linger in env vars).
const credential = new AzureCliCredential()
const tc = (name: string) =>
  new TableClient(`https://${ACCOUNT_NAME}.table.core.windows.net`, name, credential)

async function listAll(name: string, filter?: string): Promise<Row[]> {
  const client = tc(name)
  const rows: Row[] = []
  const opts = filter ? { queryOptions: { filter } } : undefined
  for await (const e of client.listEntities(opts)) {
    rows.push(e as Row)
  }
  return rows
}

function isLegacyId(id: string): boolean {
  return /^TSA-\d{4}-[0-9A-F]+$/i.test(id)
}

function isNewId(id: string): boolean {
  // 14 digits = pre-2026-06-05 new-format IDs that may already exist;
  // 16 digits = current YYYYMMDDHHMMSSFF format. Both are "already
  // migrated" from the script's perspective and are skipped by buildIdMap.
  return /^\d{14}(\d{2})?$/.test(id)
}

/**
 * Build {oldId → newId} mappings for every legacy order. Walks the
 * orders table once, generates a new ID from each row's createdAt, and
 * de-duplicates by bumping +1s on collision (mirrors the live
 * generator's strategy). All IDs are reserved in-memory before any
 * writes so the migration is deterministic and resumable.
 */
function buildIdMap(orders: Row[]): Map<string, string> {
  const used = new Set<string>()
  const map = new Map<string, string>()
  // Sort by createdAt so we collide deterministically (earlier orders
  // get the earlier seconds).
  const legacy = orders
    .filter((o) => isLegacyId(o.rowKey))
    .sort((a, b) => {
      const ta = new Date(String(a.createdAt ?? 0)).getTime()
      const tb = new Date(String(b.createdAt ?? 0)).getTime()
      return ta - tb
    })

  for (const o of legacy) {
    const createdAt = new Date(String(o.createdAt ?? new Date().toISOString()))
    let candidate = formatOrderNumber(createdAt)
    let bump = 0
    while (used.has(candidate) || isExistingNewId(orders, candidate)) {
      bump += 1
      candidate = formatOrderNumber(new Date(createdAt.getTime() + bump * 1000))
      if (bump > 1000) throw new Error(`Could not allocate new id for ${o.rowKey}`)
    }
    used.add(candidate)
    map.set(o.rowKey, candidate)
  }
  return map
}

function isExistingNewId(orders: Row[], candidate: string): boolean {
  return orders.some((o) => o.rowKey === candidate)
}

async function migrate(): Promise<void> {
  console.log(`[migrate] account=${ACCOUNT_NAME} dryRun=${!APPLY}`)

  const orders = await listAll('orders')
  console.log(`[migrate] read ${orders.length} order rows`)

  const idMap = buildIdMap(orders)
  console.log(`[migrate] ${idMap.size} legacy ids will be renumbered`)
  if (idMap.size === 0) {
    console.log('[migrate] nothing to do.')
    return
  }

  // Log a small sample so the operator can sanity check.
  let i = 0
  for (const [oldId, newId] of idMap) {
    if (i++ < 10) console.log(`         ${oldId}  ->  ${newId}`)
  }
  if (idMap.size > 10) console.log(`         ... and ${idMap.size - 10} more`)

  if (!APPLY) {
    console.log('[migrate] dry run complete - pass --apply to commit')
    return
  }

  // Per-row failures are collected instead of aborting the whole run. A
  // failure between createEntity and deleteEntity leaves both rows behind;
  // logging the exact key lets an operator finish the cleanup by hand
  // without re-running the migration from scratch.
  const failures: { table: string; partitionKey: string; rowKey: string; error: string }[] = []
  const recordFailure = (table: string, partitionKey: string, rowKey: string, err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    failures.push({ table, partitionKey, rowKey, error: message })
    console.error(`[${table}] FAILED ${partitionKey}/${rowKey}: ${message}`)
  }

  // ── 1. Migrate orders table ────────────────────────────────────
  const ordersClient = tc('orders')
  for (const o of orders) {
    if (!isLegacyId(o.rowKey)) continue
    const newId = idMap.get(o.rowKey)!
    try {
      const copy: Row = { ...o, rowKey: newId }
      delete copy.etag
      delete copy.timestamp
      await ordersClient.createEntity(copy)
      await ordersClient.deleteEntity(o.partitionKey, o.rowKey)
      console.log(`[orders] ${o.rowKey} -> ${newId}`)
    } catch (err) {
      recordFailure('orders', o.partitionKey, o.rowKey, err)
    }
  }

  // ── 2. Migrate orderItems (PK = orderId) ───────────────────────
  const itemsClient = tc('orderItems')
  for (const [oldId, newId] of idMap) {
    const rows = await listAll('orderItems', `PartitionKey eq '${oldId}'`)
    for (const r of rows) {
      try {
        const copy: Row = { ...r, partitionKey: newId }
        delete copy.etag
        delete copy.timestamp
        await itemsClient.createEntity(copy)
        await itemsClient.deleteEntity(oldId, r.rowKey)
      } catch (err) {
        recordFailure('orderItems', oldId, r.rowKey, err)
      }
    }
    if (rows.length) console.log(`[orderItems] ${oldId}: copied ${rows.length} rows`)
  }

  // ── 3. Migrate orderEvents (PK = orderId) ──────────────────────
  const eventsClient = tc('orderEvents')
  for (const [oldId, newId] of idMap) {
    const rows = await listAll('orderEvents', `PartitionKey eq '${oldId}'`)
    for (const r of rows) {
      try {
        const copy: Row = { ...r, partitionKey: newId }
        delete copy.etag
        delete copy.timestamp
        await eventsClient.createEntity(copy)
        await eventsClient.deleteEntity(oldId, r.rowKey)
      } catch (err) {
        recordFailure('orderEvents', oldId, r.rowKey, err)
      }
    }
    if (rows.length) console.log(`[orderEvents] ${oldId}: copied ${rows.length} rows`)
  }

  // ── 4. Migrate ordersByStatus (RowKey = createdAt_orderId) ─────
  const statusClient = tc('ordersByStatus')
  const statusRows = await listAll('ordersByStatus')
  for (const r of statusRows) {
    const oldOrderId = (r as { orderId?: string }).orderId || ''
    if (!isLegacyId(oldOrderId)) continue
    const newId = idMap.get(oldOrderId)
    if (!newId) continue
    const oldRowKey = r.rowKey
    // RowKey looks like "{createdAt}_{orderId}" - swap the trailing id.
    const newRowKey = oldRowKey.endsWith(`_${oldOrderId}`)
      ? oldRowKey.slice(0, -oldOrderId.length) + newId
      : `${String(r.createdAt ?? '')}_${newId}`
    try {
      const copy: Row = { ...r, rowKey: newRowKey, orderId: newId }
      delete copy.etag
      delete copy.timestamp
      await statusClient.createEntity(copy)
      await statusClient.deleteEntity(r.partitionKey, oldRowKey)
      console.log(`[ordersByStatus] ${oldRowKey} -> ${newRowKey}`)
    } catch (err) {
      recordFailure('ordersByStatus', r.partitionKey, oldRowKey, err)
    }
  }

  // ── 5. Migrate couponRedemptions (RowKey = orderId) ────────────
  const redemptionClient = tc('couponRedemptions')
  let redemptionsTouched = 0
  let redemptions: Row[] = []
  try {
    redemptions = await listAll('couponRedemptions')
  } catch (err) {
    // Table may not exist in fresh environments - that's expected, skip.
    console.warn('[couponRedemptions] skipped:', (err as Error).message)
  }
  for (const r of redemptions) {
    const newId = idMap.get(r.rowKey)
    if (!newId) continue
    try {
      const copy: Row = { ...r, rowKey: newId }
      delete copy.etag
      delete copy.timestamp
      await redemptionClient.createEntity(copy)
      await redemptionClient.deleteEntity(r.partitionKey, r.rowKey)
      redemptionsTouched += 1
    } catch (err) {
      recordFailure('couponRedemptions', r.partitionKey, r.rowKey, err)
    }
  }
  if (redemptionsTouched) console.log(`[couponRedemptions] copied ${redemptionsTouched} rows`)

  // ── 6. Self-check ──────────────────────────────────────────────
  const after = await listAll('orders')
  const stragglers = after.filter((o) => isLegacyId(o.rowKey))
  if (stragglers.length) {
    console.error(`[migrate] WARNING: ${stragglers.length} legacy ids still present`)
  } else {
    console.log('[migrate] OK - no legacy ids remain.')
  }

  if (failures.length) {
    console.error(`[migrate] ${failures.length} row(s) failed - see log for details:`)
    for (const f of failures) {
      console.error(`  - ${f.table} ${f.partitionKey}/${f.rowKey}: ${f.error}`)
    }
    // Non-zero exit so CI / operator scripts notice, even though the
    // run completed as much as it could.
    process.exitCode = 1
  }
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
