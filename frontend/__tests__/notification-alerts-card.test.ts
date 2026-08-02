/**
 * Unit test for the alert-source discriminator used by NotificationAlertsCard.
 * Regression check for the "Order #<inquiryId>" broken-link bug: a
 * custom-order studio-admin ping's alert row must be recognised so it
 * links to /admin/custom-orders instead of the (non-existent) order
 * detail page — for any template version, since Meta requires a new
 * template name whenever the template body changes.
 */
import { isCustomOrderInquiryAlert } from '../lib/notificationAlerts'

describe('isCustomOrderInquiryAlert', () => {
  it('matches the enqueue-failure form (operation === templateKey verbatim)', () => {
    // queue.ts enqueueNotificationSafe sets operation = message.templateKey
    expect(isCustomOrderInquiryAlert('admin_notification_v1')).toBe(true)
  })

  it('matches the send-failure form (templateKey:toPhone)', () => {
    // notificationsQueue.ts sendAdminNotification sets
    // operation = `${templateKey}:${toPhone}`
    expect(isCustomOrderInquiryAlert('admin_notification_v1:919014393938')).toBe(true)
  })

  it('matches future template versions, both producer forms', () => {
    // Meta requires a new template name for a changed template body, so a
    // version bump is routine, not hypothetical.
    expect(isCustomOrderInquiryAlert('admin_notification_v2')).toBe(true)
    expect(isCustomOrderInquiryAlert('admin_notification_v2:919014393938')).toBe(true)
  })

  it('does not match the sibling admin ping (admin_new_order_v1)', () => {
    // referenceId for this one IS a real orderId — must keep Order label/link.
    expect(isCustomOrderInquiryAlert('admin_new_order_v1')).toBe(false)
    expect(isCustomOrderInquiryAlert('admin_new_order_v1:919014393938')).toBe(false)
  })

  it('does not match customer notification template keys', () => {
    expect(isCustomOrderInquiryAlert('order_confirmed')).toBe(false)
    expect(isCustomOrderInquiryAlert('order_shipped')).toBe(false)
    expect(isCustomOrderInquiryAlert('review_request')).toBe(false)
    expect(isCustomOrderInquiryAlert('payment_after_cancel')).toBe(false)
    expect(isCustomOrderInquiryAlert('invoice_generation')).toBe(false)
  })
})
