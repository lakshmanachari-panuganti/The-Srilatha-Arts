import type { InvocationContext } from '@azure/functions'

const enqueueNotification = jest.fn()
jest.mock('../services/queue', () => ({ enqueueNotification }))

import {
  enqueueStudioAdminNotifications,
  sendAdminTemplate,
  parseStudioAdminPhones,
  ADMIN_NEW_ORDER_TEMPLATE_KEY,
  ADMIN_CUSTOM_ORDER_TEMPLATE_KEY,
  ADMIN_WHATSAPP_CHANNEL,
} from '../services/adminNotifications'

const ctx = { log: jest.fn(), warn: jest.fn() } as unknown as InvocationContext

describe('parseStudioAdminPhones', () => {
  it('normalises, de-duplicates, and drops junk', () => {
    expect(
      parseStudioAdminPhones('9052380325, +91 90143 93938; 9052380325, , 123'),
    ).toEqual(['919052380325', '919014393938'])
  })

  it('keeps space-formatted numbers intact (regression: split used to shred them)', () => {
    expect(parseStudioAdminPhones('+91 90523 80325')).toEqual(['919052380325'])
  })

  it('rejects a whitespace-separated list rather than concatenating it', () => {
    expect(parseStudioAdminPhones('9052380325 9014393938')).toEqual([])
  })

  it('returns [] when unset', () => {
    expect(parseStudioAdminPhones(undefined)).toEqual([])
  })
})

describe('enqueueStudioAdminNotifications', () => {
  beforeEach(() => {
    enqueueNotification.mockReset().mockResolvedValue(undefined)
    process.env.STUDIO_ADMINS_WHATSAPP_GROUP = '9052380325, 9014393938'
  })

  it('queues one message per admin carrying name + mobile', async () => {
    const result = await enqueueStudioAdminNotifications({
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      customerName: 'Asha R',
      customerPhone: '+91 90123 45678',
      referenceId: 'ORD-1001',
      context: ctx,
    })

    expect(result).toEqual({ enqueued: 2, skipped: 0, failed: 0 })
    expect(enqueueNotification.mock.calls.map((c) => c[0])).toEqual([
      {
        userEmail: '',
        channel: ADMIN_WHATSAPP_CHANNEL,
        templateKey: 'admin_new_order_v1',
        vars: {
          toPhone: '919052380325',
          customerName: 'Asha R',
          customerPhone: '+91 90123 45678',
          referenceId: 'ORD-1001',
        },
      },
      {
        userEmail: '',
        channel: ADMIN_WHATSAPP_CHANNEL,
        templateKey: 'admin_new_order_v1',
        vars: {
          toPhone: '919014393938',
          customerName: 'Asha R',
          customerPhone: '+91 90123 45678',
          referenceId: 'ORD-1001',
        },
      },
    ])
  })

  it('isolates a per-admin enqueue failure', async () => {
    enqueueNotification
      .mockRejectedValueOnce(new Error('queue 503'))
      .mockResolvedValue(undefined)

    const result = await enqueueStudioAdminNotifications({
      templateName: ADMIN_CUSTOM_ORDER_TEMPLATE_KEY,
      customerName: 'Asha R',
      customerPhone: '9012345678',
      referenceId: 'inq-abc',
      context: ctx,
    })

    expect(result).toEqual({ enqueued: 1, skipped: 0, failed: 1 })
  })

  it('no-ops without throwing when no admins are configured', async () => {
    process.env.STUDIO_ADMINS_WHATSAPP_GROUP = ''
    const result = await enqueueStudioAdminNotifications({
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      customerName: 'Asha R',
      customerPhone: '9012345678',
      referenceId: 'ORD-1001',
      context: ctx,
    })
    expect(result).toEqual({ enqueued: 0, skipped: 0, failed: 0 })
    expect(enqueueNotification).not.toHaveBeenCalled()
  })
})

describe('sendAdminTemplate', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
  })

  afterEach(() => jest.restoreAllMocks())

  it('sends the template with name as {{1}} and mobile as {{2}}', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: 'wamid.test' }] }),
    } as Response)

    await sendAdminTemplate({
      toPhone: '919052380325',
      templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
      customerName: 'Asha R',
      customerPhone: '+91 90123 45678',
    })

    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.to).toBe('919052380325')
    expect(payload.template.name).toBe('admin_new_order_v1')
    expect(payload.template.language.code).toBe('en')
    expect(payload.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Asha R' },
      { type: 'text', text: '+91 90123 45678' },
    ])
  })

  it('throws so the queue retries when WhatsApp is unconfigured', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN
    await expect(
      sendAdminTemplate({
        toPhone: '919052380325',
        templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
        customerName: 'Asha R',
        customerPhone: '9012345678',
      }),
    ).rejects.toThrow(/not configured/)
  })

  it('throws on a Meta API rejection so the queue retries', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: { message: 'template not found', code: 132001 } }),
    } as Response)

    await expect(
      sendAdminTemplate({
        toPhone: '919052380325',
        templateName: ADMIN_NEW_ORDER_TEMPLATE_KEY,
        customerName: 'Asha R',
        customerPhone: '9012345678',
      }),
    ).rejects.toThrow(/template not found/)
  })
})
