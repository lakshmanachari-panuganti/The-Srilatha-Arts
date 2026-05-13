// ─── PRODUCTS ────────────────────────────────────────────────

export interface ProductEntity {
  partitionKey: string  // category
  rowKey: string        // productId e.g. "resin-abc123"
  title: string
  price: number         // in paise
  displayPrice: number  // in rupees
  compareAtPrice?: number
  size: string
  material: string
  description: string
  shortDescription?: string
  careInstructions?: string
  timeToMake?: string
  imageUrl: string
  additionalImages: string  // JSON array
  inStock: boolean
  stockQty?: number
  featured: boolean
  isNewArrival: boolean
  isBestSeller: boolean
  isOnSale?: boolean
  sortOrder: number
  slug?: string
  rating?: number
  reviewCount?: number
  createdAt: string
  updatedAt: string
}

// ─── ORDERS ──────────────────────────────────────────────────

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'CRAFTING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'ON_HOLD'

export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'COD'

export interface OrderEntity {
  partitionKey: string   // userEmail (or 'guest')
  rowKey: string         // orderId e.g. "TSA-2026-00001"
  status: OrderStatus
  paymentStatus: PaymentStatus
  items: string          // JSON of OrderItemSnapshot[]
  totalAmount: number    // in paise
  displayTotal: number   // in rupees
  subtotal: number
  shippingAmount: number
  discountAmount?: number
  gstAmount?: number
  couponCode?: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string  // JSON of Address
  billingAddress?: string  // JSON of Address
  trackingNumber?: string
  courier?: string
  courierUrl?: string
  eta?: string              // ISO datetime
  cancelReason?: string
  holdReason?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  invoiceUrl?: string
  returnRequestedAt?: string
  refundedAt?: string
  refundAmount?: number
  customerNote?: string
  addressEdited?: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderItemSnapshot {
  productId: string
  title: string
  category: string
  imageUrl: string
  price: number         // in paise, unit price at time of purchase
  displayPrice: number  // in rupees
  qty: number
}

/** Secondary index: `ordersByStatus` table */
export interface OrdersByStatusEntity {
  partitionKey: string  // status
  rowKey: string        // ISO-createdAt_orderId (reverse-sortable)
  orderId: string
  userEmail: string
  customerName: string
  displayTotal: number
  paymentStatus: PaymentStatus
  createdAt: string
  updatedAt: string
}

// ─── ORDER EVENTS ────────────────────────────────────────────

export type OrderEventChannel = 'status' | 'note' | 'internal' | 'message' | 'refund' | 'system'

export interface OrderEventEntity {
  partitionKey: string    // orderId
  rowKey: string          // ISO-timestamp_seq
  fromStatus?: string
  toStatus?: string
  channel: OrderEventChannel
  by: string              // userId or adminId or 'system'
  byRole: 'customer' | 'admin' | 'superadmin' | 'system'
  note?: string
  meta?: string           // JSON — tracking#, refundId, etc.
  createdAt: string
}

// ─── ORDER ITEMS ─────────────────────────────────────────────

export interface OrderItemEntity {
  partitionKey: string   // orderId
  rowKey: string         // productId
  title: string
  category: string
  imageUrl: string
  price: number
  displayPrice: number
  qty: number
}

// ─── COUPONS ─────────────────────────────────────────────────

export type CouponType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_SHIPPING'
  | 'BUY_X_GET_Y'

export interface CouponEntity {
  partitionKey: 'coupon'
  rowKey: string          // code (uppercased)
  type: CouponType
  value: number           // % or paise
  minOrderAmount?: number // in paise
  maxDiscount?: number    // cap in paise (for %)
  applicableCategories?: string  // JSON array or 'ALL'
  applicableProducts?: string    // JSON array or 'ALL'
  firstTimeOnly: boolean
  stackable: boolean
  usageLimit?: number     // total uses across all users
  perUserLimit?: number   // uses per user
  currentUsage: number
  startDate: string
  endDate: string
  active: boolean
  promoteInBanner: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CouponRedemptionEntity {
  partitionKey: string   // code
  rowKey: string         // orderId
  userEmail: string
  discountAmount: number
  redeemedAt: string
}

// ─── ANNOUNCEMENTS ───────────────────────────────────────────

export interface AnnouncementEntity {
  partitionKey: 'banner'
  rowKey: string          // id
  message: string
  href: string
  startDate?: string
  endDate?: string
  priority: number
  theme: 'gold' | 'festive-pink' | 'muted'
  active: boolean
  linkedCouponCode?: string
  createdAt: string
  updatedAt: string
}

// ─── USERS ───────────────────────────────────────────────────

export interface UserEntity {
  partitionKey: 'customer'
  rowKey: string  // email — lowercase
  name: string
  phone: string
  passwordHash: string  // empty string for OAuth-only users
  authProvider: 'local' | 'google'
  googleId: string      // empty string for non-Google users
  picture: string       // empty string when not provided
  isActive: boolean
  dob?: string          // YYYY-MM-DD for birthday coupons
  loyaltyTier?: 'silver' | 'gold' | 'platinum'
  lifetimeValue?: number
  prefWhatsapp?: boolean
  prefEmail?: boolean
  prefPush?: boolean
  deletedAt?: string
  createdAt: string
  lastLogin: string
}

// ─── ADMINS ──────────────────────────────────────────────────

export type AdminRole = 'owner' | 'manager' | 'support' | 'readonly' | 'admin' | 'superadmin'

export interface AdminEntity {
  partitionKey: 'admin'
  rowKey: string  // username — alphanumeric, lowercase
  name: string
  passwordHash: string
  role: AdminRole
  permissions?: string   // JSON array
  invitedBy?: string
  isActive: boolean
  createdAt: string
  lastLogin: string
}

// ─── WISHLIST ────────────────────────────────────────────────

export interface WishlistEntity {
  partitionKey: string  // userEmail
  rowKey: string        // productId
  addedAt: string
}

// ─── REVIEWS ─────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'hidden'

export interface ReviewEntity {
  partitionKey: string  // productId
  rowKey: string        // reviewId
  userEmail: string
  userName: string
  rating: number        // 1–5
  title?: string
  body: string
  photos?: string       // JSON array of URLs
  orderId: string       // proof of purchase
  status: ReviewStatus
  adminReply?: string
  adminRepliedAt?: string
  createdAt: string
}

// ─── CUSTOM ORDERS ───────────────────────────────────────────

export type CustomOrderStatus = 'NEW' | 'QUOTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED'

export interface CustomOrderEntity {
  partitionKey: 'inbox'
  rowKey: string           // status_inquiryId
  inquiryId: string
  status: CustomOrderStatus
  customerName: string
  customerEmail: string
  customerPhone: string
  artForm: string          // resin | dot-mandala | lippan | pichwai | kolam
  size?: string
  palette?: string
  description: string
  referenceImages?: string // JSON array of blob URLs
  budget?: string
  quotedAmount?: number
  adminNote?: string
  createdAt: string
  updatedAt: string
}

// ─── ADDRESSES ───────────────────────────────────────────────

export interface AddressEntity {
  partitionKey: string   // userEmail
  rowKey: string         // addressId
  label: string          // 'Home' | 'Work' | custom
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface Address {
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
}

// ─── NOTIFICATIONS ───────────────────────────────────────────

export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'push'

export interface NotificationEntity {
  partitionKey: string     // userEmail
  rowKey: string           // ISO-timestamp_channel
  channel: NotificationChannel
  templateKey: string
  vars: string             // JSON
  status: 'sent' | 'failed' | 'queued'
  error?: string
  createdAt: string
}

// ─── AUDIT LOG ───────────────────────────────────────────────

export interface AuditLogEntity {
  partitionKey: 'admin'
  rowKey: string           // ISO-timestamp_staffId
  staffId: string
  action: string           // e.g. 'order.status.update', 'product.create'
  resourceType: string     // 'order' | 'product' | 'coupon' | ...
  resourceId: string
  details?: string         // JSON
  createdAt: string
}

// ─── AUTH ─────────────────────────────────────────────────────

export interface TokenPayload {
  id: string
  role: 'customer' | 'admin' | 'superadmin'
}

// ─── QUEUE MESSAGES ──────────────────────────────────────────

export interface NotificationQueueMessage {
  userEmail: string
  channel: NotificationChannel
  templateKey: string
  vars: Record<string, string>
}

export interface WebhookQueueMessage {
  source: 'razorpay' | 'courier'
  payload: Record<string, unknown>
  receivedAt: string
}

export interface ReviewRequestQueueMessage {
  orderId: string
  userEmail: string
  customerName: string
  items: { title: string; productId: string }[]
}
