export interface ProductEntity {
  partitionKey: string  // category
  rowKey: string        // productId e.g. "resin-abc123"
  title: string
  price: number         // in paise
  displayPrice: number  // in rupees
  size: string
  material: string
  description: string
  imageUrl: string
  additionalImages: string  // JSON array
  inStock: boolean
  featured: boolean
  isNewArrival: boolean
  isBestSeller: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AdminEntity {
  partitionKey: 'admin'
  rowKey: string  // username — alphanumeric, lowercase
  name: string
  passwordHash: string
  role: 'admin' | 'superadmin'
  isActive: boolean
  createdAt: string
  lastLogin: string
}

export interface UserEntity {
  partitionKey: 'customer'
  rowKey: string  // email — lowercase
  name: string
  phone: string
  passwordHash: string  // empty string for OAuth-only users
  authProvider: 'local' | 'google'
  googleId: string  // empty string for non-Google users
  picture: string  // empty string when not provided
  isActive: boolean
  createdAt: string
  lastLogin: string
}

export interface TokenPayload {
  id: string
  role: 'customer' | 'admin' | 'superadmin'
}
