/**
 * The custom-order studio-admin ping's `orderId` is actually a custom-order
 * INQUIRY id (backend/src/functions/customOrders.ts enqueues it as
 * `referenceId`), so it has no /admin/orders/detail row and 404s there.
 * `operation` carries the Meta template key and is the one field both
 * producers of this alert set reliably:
 *   - queue.ts enqueueNotificationSafe (enqueue failure): operation ===
 *     templateKey verbatim.
 *   - notificationsQueue.ts sendAdminNotification (send failure):
 *     operation === `${templateKey}:${toPhone}`.
 * Matches any version of ADMIN_CUSTOM_ORDER_TEMPLATE_KEY in
 * backend/src/services/adminNotifications.ts (admin_notification_v1,
 * _v2, ...) — Meta requires a new template name for a changed template
 * body, so a version bump is a routine future change, not hypothetical.
 * The sibling admin ping (admin_new_order_v1, shop order paid) is NOT
 * included here — its referenceId is a real orderId, so it keeps the
 * Order label/link.
 */
export function isCustomOrderInquiryAlert(operation: string): boolean {
  // split(':') strips the per-admin dedup suffix from the send-failure form
  return operation.split(':')[0].startsWith('admin_notification_v')
}
