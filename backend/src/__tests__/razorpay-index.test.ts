/**
 * Unit test for the ordersByRazorpayId secondary index (audit H3).
 *
 * Locks the round-trip contract: what upsertOrderByRazorpayId writes is
 * what getInternalOrderIdByRazorpay reads back. The underlying Azure
 * Table client is mocked to a Map so the test needs no live storage.
 */

import { jest } from '@jest/globals'

const table = new Map<string, Record<string, unknown>>()

// Mock @azure/data-tables — the TableClient class returned by getTableClient
// only exposes upsertEntity + getEntity for this module.
jest.mock('@azure/data-tables', () => ({
  TableClient: class {
    async createTable() { /* noop */ }
    async upsertEntity(row: { partitionKey: string; rowKey: string }) {
      table.set(`${row.partitionKey}|${row.rowKey}`, row)
    }
    async getEntity(pk: string, rk: string) {
      const row = table.get(`${pk}|${rk}`)
      if (!row) {
        const err: Error & { statusCode?: number } = new Error('Not found')
        err.statusCode = 404
        throw err
      }
      return row
    }
    async deleteEntity() { /* unused */ }
  },
  odata: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((acc, s, i) => acc + s + (values[i] ?? ''), ''),
}))

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
}))

process.env.AZURE_STORAGE_ACCOUNT_NAME = 'mockaccount'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { upsertOrderByRazorpayId, getInternalOrderIdByRazorpay } = require('../services/tableStorage') as {
  upsertOrderByRazorpayId: (rzpId: string, internalId: string, userEmail: string) => Promise<void>
  getInternalOrderIdByRazorpay: (rzpId: string) => Promise<{ internalOrderId: string; userEmail: string } | null>
}

beforeEach(() => {
  table.clear()
})

describe('ordersByRazorpayId — audit H3', () => {
  it('returns null when the id is unknown', async () => {
    const got = await getInternalOrderIdByRazorpay('order_unknown')
    expect(got).toBeNull()
  })

  it('round-trips the mapping (write → read)', async () => {
    await upsertOrderByRazorpayId('order_ABC', '2026070412000000', 'e@x.io')
    const got = await getInternalOrderIdByRazorpay('order_ABC')
    expect(got).toEqual({
      internalOrderId: '2026070412000000',
      userEmail: 'e@x.io',
    })
  })

  it('re-upsert replaces the previous mapping', async () => {
    await upsertOrderByRazorpayId('order_ABC', 'internal_1', 'a@x.io')
    await upsertOrderByRazorpayId('order_ABC', 'internal_2', 'a@x.io')
    const got = await getInternalOrderIdByRazorpay('order_ABC')
    expect(got?.internalOrderId).toBe('internal_2')
  })

  it('separate razorpay ids are independent', async () => {
    await upsertOrderByRazorpayId('order_A', 'int_A', 'a@x.io')
    await upsertOrderByRazorpayId('order_B', 'int_B', 'b@x.io')
    expect((await getInternalOrderIdByRazorpay('order_A'))?.internalOrderId).toBe('int_A')
    expect((await getInternalOrderIdByRazorpay('order_B'))?.internalOrderId).toBe('int_B')
  })
})
