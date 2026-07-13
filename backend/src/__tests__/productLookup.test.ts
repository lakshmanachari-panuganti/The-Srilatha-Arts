/**
 * Unit tests for getProductById's hardened lookup (services/tableStorage).
 *
 * The id is normally `<category>-<8hex>` and resolves via a direct
 * partition+row point lookup. Ids that don't match that format (legacy /
 * imported rows) - or well-formed ids whose derived partition misses -
 * must fall back to a cross-partition scan on RowKey. The Azure Table
 * client is mocked to a Map so the test needs no live storage.
 */

import { jest } from '@jest/globals'

const table = new Map<string, Record<string, unknown>>()

jest.mock('@azure/data-tables', () => ({
  TableClient: class {
    async createTable() { /* noop */ }
    async getEntity(pk: string, rk: string) {
      const row = table.get(`${pk}|${rk}`)
      if (!row) {
        const err: Error & { statusCode?: number } = new Error('Not found')
        err.statusCode = 404
        throw err
      }
      return row
    }
    listEntities(opts?: { queryOptions?: { filter?: string } }) {
      // Supports the one filter shape getProductById's fallback uses:
      //   RowKey eq '<id>'
      const filter = opts?.queryOptions?.filter ?? ''
      const m = filter.match(/^RowKey eq '(.*)'$/)
      const rows = [...table.values()].filter((r) => !m || r.rowKey === m[1])
      return (async function* () {
        for (const r of rows) yield r
      })()
    }
    async upsertEntity() { /* unused */ }
    async deleteEntity() { /* unused */ }
  },
  // Quote string values the way the real odata tag does, so the mocked
  // listEntities can parse the filter back out.
  odata: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce(
      (acc, s, i) => acc + s + (i < values.length ? `'${String(values[i])}'` : ''),
      '',
    ),
}))

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
}))

process.env.AZURE_STORAGE_ACCOUNT_NAME = 'mockaccount'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getProductById, upsertProduct } = require('../services/tableStorage') as {
  getProductById: (productId: string) => Promise<Record<string, unknown> | null>
  upsertProduct: (product: Record<string, unknown>) => Promise<void>
}

// Silence + observe the fallback warning. Call counts reset per test.
const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

beforeEach(() => {
  table.clear()
  warnSpy.mockClear()
})

afterAll(() => {
  warnSpy.mockRestore()
})

describe('getProductById - direct lookup (well-formed id)', () => {
  it('resolves <category>-<8hex> via the derived partition, no scan', async () => {
    table.set('dot-mandala|dot-mandala-f55f2641', {
      partitionKey: 'dot-mandala',
      rowKey: 'dot-mandala-f55f2641',
      title: 'Owl',
    })
    const row = await getProductById('dot-mandala-f55f2641')
    expect(row?.title).toBe('Owl')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepts uppercase hex suffixes (case-insensitive format check)', async () => {
    table.set('lippan|lippan-ABCDEF01', {
      partitionKey: 'lippan',
      rowKey: 'lippan-ABCDEF01',
      title: 'Mirror',
    })
    const row = await getProductById('lippan-ABCDEF01')
    expect(row?.title).toBe('Mirror')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('getProductById - cross-partition scan fallback', () => {
  it('finds an id that does not match the <category>-<8hex> format', async () => {
    table.set('some-category|legacy_product_1', {
      partitionKey: 'some-category',
      rowKey: 'legacy_product_1',
      title: 'Legacy',
    })
    const row = await getProductById('legacy_product_1')
    expect(row?.title).toBe('Legacy')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('finds a well-formed id whose row lives in an unexpected partition', async () => {
    // Row stored under a partition that is NOT the derived slice(0, -9).
    table.set('renamed-category|dot-mandala-f55f2641', {
      partitionKey: 'renamed-category',
      rowKey: 'dot-mandala-f55f2641',
      title: 'Moved',
    })
    const row = await getProductById('dot-mandala-f55f2641')
    expect(row?.title).toBe('Moved')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('returns null when the id exists nowhere', async () => {
    const row = await getProductById('ghost-deadbeef')
    expect(row).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('getProductById - abuse hardening (public endpoint)', () => {
  it('rejects garbage ids without scanning or logging them', async () => {
    for (const bad of [
      "'; drop--",
      'a b c',
      'x'.repeat(200),
      '../../../etc/passwd',
      '',
      'emoji-💥-id',
    ]) {
      const row = await getProductById(bad)
      expect(row).toBeNull()
    }
    // No scan fallback fired → no warn, no listEntities filter round-trips.
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('negative-caches scan misses so repeated bad lookups scan only once', async () => {
    const id = 'miss-cached-01'
    expect(await getProductById(id)).toBeNull()
    expect(await getProductById(id)).toBeNull()
    expect(await getProductById(id)).toBeNull()
    // Only the first miss reached the scan (and its warn); the rest were
    // answered from the 60s negative cache.
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('upsertProduct clears the negative cache for that id', async () => {
    const id = 'lippan-0badf00d'
    expect(await getProductById(id)).toBeNull() // now negative-cached
    // Product gets created (admin flow) - the row appears and upsertProduct
    // must evict the stale miss so checkout can resolve it immediately.
    table.set(`lippan|${id}`, { partitionKey: 'lippan', rowKey: id, title: 'Fresh' })
    await upsertProduct({ partitionKey: 'lippan', rowKey: id, title: 'Fresh' })
    const row = await getProductById(id)
    expect(row?.title).toBe('Fresh')
  })
})
