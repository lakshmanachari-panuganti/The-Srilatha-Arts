import {
  notifyStudioAdmins,
  ADMIN_NEW_ORDER_TEMPLATE_KEY,
} from '../services/adminNotifications'
import type { InvocationContext } from '@azure/functions'

const ctx = { log: jest.fn(), warn: jest.fn() } as unknown as InvocationContext

describe('notifyStudioAdmins', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
    process.env.STUDIO_ADMINS_WHATSAPP_GROUP = '9052380325, 9014393938'
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: 'wamid.test' }] }),
    } as Response)
  })

  afterEach(() => jest.restoreAllMocks())

  it('sends the requested template with customer name + mobile to every admin', async () => {
    const result = await notifyStudioAdmins({
      customerName: 'Asha R',
      customerPhone: '+91 90123 45678',
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      context: ctx,
    })

    expect(result).toEqual({ attempted: 2, succeeded: 2, failed: 0, skipped: 0 })

    const fetchMock = global.fetch as jest.Mock
    const payloads = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body))
    expect(payloads.map((p) => p.to)).toEqual(['919052380325', '919014393938'])
    for (const p of payloads) {
      expect(p.template.name).toBe('admin_new_order_v1')
      expect(p.template.components[0].parameters).toEqual([
        { type: 'text', text: 'Asha R' },
        { type: 'text', text: '+91 90123 45678' },
      ])
    }
  })

  it('defaults to the custom-order template when none is given', async () => {
    await notifyStudioAdmins({ customerName: 'A', customerPhone: '1', context: ctx })
    const fetchMock = global.fetch as jest.Mock
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).template.name).toBe(
      'admin_notification_v1',
    )
  })

  it('isolates a per-admin failure so later admins still get notified', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'boom' } as Response)
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messages: [{ id: 'wamid.test' }] }),
      } as Response)

    const result = await notifyStudioAdmins({
      customerName: 'Asha R',
      customerPhone: '9012345678',
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      context: ctx,
    })

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1, skipped: 0 })
  })
})
