/**
 * Order State Machine (§12 of backend-plan.md)
 *
 * Pure functions - no I/O, 100% unit-testable.
 * Imported by: POST /api/orders, PATCH /api/admin/orders/{id}/status,
 * POST /api/payments/verify, processWebhook (courier updates).
 */

import type { OrderStatus, NotificationChannel } from '../types'

// ─── Allowed transitions ─────────────────────────────────────

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PLACED:           ['CONFIRMED', 'CANCELLED', 'ON_HOLD'],
  CONFIRMED:        ['CRAFTING',  'CANCELLED', 'ON_HOLD'],
  CRAFTING:         ['PACKED',    'CANCELLED', 'ON_HOLD'],
  PACKED:           ['SHIPPED',   'ON_HOLD'],
  SHIPPED:          ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED:        ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],   // DELIVERED = admin rejected return
  RETURNED:         ['REFUNDED'],
  REFUNDED:         [],
  CANCELLED:        [],
  ON_HOLD:          ['CONFIRMED', 'CRAFTING', 'PACKED', 'CANCELLED'],
}

/**
 * Check if a transition from `from` → `to` is allowed.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

/**
 * Return all valid next states from the current status.
 */
export function nextValidStates(from: OrderStatus): OrderStatus[] {
  return ALLOWED[from] ?? []
}

/**
 * All known statuses.
 */
export const ALL_STATUSES: OrderStatus[] = Object.keys(ALLOWED) as OrderStatus[]

/**
 * Check if a status string is a valid OrderStatus.
 */
export function isValidStatus(s: string): s is OrderStatus {
  return ALL_STATUSES.includes(s as OrderStatus)
}

// ─── Required fields per transition ──────────────────────────

interface TransitionRequirements {
  tracking?: boolean
  courier?: boolean
  cancelReason?: boolean
  holdReason?: boolean
  refundAmount?: boolean
}

const REQUIREMENTS: Partial<Record<OrderStatus, TransitionRequirements>> = {
  SHIPPED:   { tracking: true, courier: true },
  CANCELLED: { cancelReason: true },
  ON_HOLD:   { holdReason: true },
  REFUNDED:  { refundAmount: true },
}

export interface TransitionPayload {
  tracking?: string
  courier?: string
  cancelReason?: string
  holdReason?: string
  refundAmount?: number
  note?: string
  notifyCustomer?: boolean
}

/**
 * Validate that all required fields for a transition target are present.
 * Returns null if valid, or an error message string.
 */
export function validateTransitionPayload(
  to: OrderStatus,
  payload: TransitionPayload,
): string | null {
  const reqs = REQUIREMENTS[to]
  if (!reqs) return null

  if (reqs.tracking && !payload.tracking) {
    return 'Tracking number is required when moving to SHIPPED'
  }
  if (reqs.courier && !payload.courier) {
    return 'Courier name is required when moving to SHIPPED'
  }
  if (reqs.cancelReason && !payload.cancelReason) {
    return 'Cancel reason is required when cancelling an order'
  }
  if (reqs.holdReason && !payload.holdReason) {
    return 'Hold reason is required when placing an order on hold'
  }
  if (reqs.refundAmount && (payload.refundAmount == null || payload.refundAmount <= 0)) {
    return 'Refund amount is required when moving to REFUNDED'
  }

  return null
}

// ─── Notification side-effects per transition ────────────────

interface TransitionNotification {
  customer: NotificationChannel[]
  internal: NotificationChannel[]
  scheduleReviewRequest?: boolean
}

const NOTIFICATIONS: Partial<Record<OrderStatus, TransitionNotification>> = {
  CONFIRMED:        { customer: ['whatsapp', 'email'], internal: [] },
  CRAFTING:         { customer: ['whatsapp'],          internal: [] },
  PACKED:           { customer: [],                    internal: ['email'] },
  SHIPPED:          { customer: ['whatsapp', 'email'], internal: [] },
  OUT_FOR_DELIVERY: { customer: ['whatsapp', 'push'],  internal: [] },
  DELIVERED:        { customer: ['whatsapp'],          internal: [], scheduleReviewRequest: true },
  CANCELLED:        { customer: ['whatsapp', 'email'], internal: [] },
  ON_HOLD:          { customer: ['whatsapp'],          internal: [] },
  REFUNDED:         { customer: ['whatsapp', 'email'], internal: [] },
}

/**
 * Return which channels to notify on for a given transition target.
 */
export function getTransitionNotifications(to: OrderStatus): TransitionNotification {
  return NOTIFICATIONS[to] ?? { customer: [], internal: [] }
}

// ─── Human-readable labels ───────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED:           'Order Placed',
  CONFIRMED:        'Order Confirmed',
  CRAFTING:         'Being Crafted',
  PACKED:           'Packed',
  SHIPPED:          'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED:        'Delivered',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED:         'Returned',
  REFUNDED:         'Refunded',
  CANCELLED:        'Cancelled',
  ON_HOLD:          'On Hold',
}

export function statusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status] ?? status
}

// ─── Customer-cancellable statuses ───────────────────────────

const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PLACED', 'CONFIRMED', 'CRAFTING']

export function canCustomerCancel(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(status)
}

// ─── Customer-returnable check ───────────────────────────────

const RETURN_WINDOW_DAYS = 7

export function canCustomerReturn(status: OrderStatus, deliveredAt?: string): boolean {
  if (status !== 'DELIVERED') return false
  if (!deliveredAt) return false
  const delivered = new Date(deliveredAt).getTime()
  const now = Date.now()
  const daysSince = (now - delivered) / (1000 * 60 * 60 * 24)
  return daysSince <= RETURN_WINDOW_DAYS
}
