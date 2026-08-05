import type { InvocationContext } from '@azure/functions'

const sendMessage = jest.fn()
const recordAlert = jest.fn()

jest.mock('@azure/storage-queue', () => ({
  QueueServiceClient: class {
    getQueueClient() {
      return { sendMessage }
    }
  },
}))
jest.mock('@azure/identity', () => ({ DefaultAzureCredential: class {} }))
jest.mock('../services/notificationAlerts', () => ({ recordAlert }))

import { enqueueNotificationSafe } from '../services/queue'

const ctx = { warn: jest.fn() } as unknown as InvocationContext

const message = {
  userEmail: 'asha@example.com',
  channel: 'email',
  templateKey: 'order_confirmed',
  vars: { orderId: 'ORD-1001', customerName: 'Asha R', customerPhone: '9012345678' },
}

describe('enqueueNotificationSafe', () => {
  beforeEach(() => {
    sendMessage.mockReset().mockResolvedValue(undefined)
    recordAlert.mockReset().mockResolvedValue(undefined)
  })

  it('returns true and raises no alert on success', async () => {
    await expect(enqueueNotificationSafe(message, ctx)).resolves.toBe(true)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(recordAlert).not.toHaveBeenCalled()
  })

  it('raises a final alert and returns false when the queue is unreachable', async () => {
    sendMessage.mockRejectedValue(new Error('storage 503'))

    await expect(enqueueNotificationSafe(message, ctx)).resolves.toBe(false)

    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORD-1001',
        channel: 'email',
        operation: 'order_confirmed',
        customerName: 'Asha R',
        // Nothing retries an enqueue that never happened — the alert is
        // actionable immediately, not after a retry budget burns down.
        isFinal: true,
        attempt: 1,
      }),
    )
    expect(recordAlert.mock.calls[0][0].reason).toMatch(/storage 503/)
  })

  it('does not throw, so the caller\'s business operation still completes', async () => {
    sendMessage.mockRejectedValue(new Error('storage 503'))
    await expect(enqueueNotificationSafe(message, ctx)).resolves.toBe(false)
  })

  it('keys admin pings by referenceId and rolls them up under whatsapp', async () => {
    sendMessage.mockRejectedValue(new Error('storage 503'))

    await enqueueNotificationSafe(
      {
        userEmail: '',
        channel: 'whatsapp_admin',
        templateKey: 'admin_new_order_v1',
        vars: { toPhone: '919052380325', referenceId: 'inq-abc', customerName: 'Asha R' },
      },
      ctx,
    )

    expect(recordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'inq-abc',
        channel: 'whatsapp',
        operation: 'admin_new_order_v1',
      }),
    )
  })
})
