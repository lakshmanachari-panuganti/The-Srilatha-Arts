import { TableClient, odata } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
const credential = new DefaultAzureCredential()

function getTableClient(tableName: string): TableClient {
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>

async function listAll(tableName: string, filter?: string): Promise<Row[]> {
  const client = getTableClient(tableName)
  const rows: Row[] = []
  const opts = filter ? { queryOptions: { filter } } : undefined
  for await (const entity of client.listEntities(opts)) {
    rows.push(entity as Row)
  }
  return rows
}

// ─── PRODUCTS ────────────────────────────────────────────────

export async function getAllProducts(): Promise<Row[]> {
  const rows = await listAll('products')
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export async function getProductsByCategory(category: string): Promise<Row[]> {
  const rows = await listAll('products', odata`PartitionKey eq ${category}`)
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export async function getProduct(category: string, productId: string): Promise<Row | null> {
  const client = getTableClient('products')
  try {
    return (await client.getEntity(category, productId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function getProductById(productId: string): Promise<Row | null> {
  // Product IDs are `<category>-<random>`; the category prefix lets us hit a single partition.
  const category = productId.split('-')[0]
  return getProduct(category, productId)
}

export async function getFeaturedProducts(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.featured === true)
}

export async function getNewArrivals(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.isNewArrival === true)
}

export async function getBestSellers(): Promise<Row[]> {
  return (await getAllProducts()).filter((p) => p.isBestSeller === true)
}

export async function upsertProduct(product: Row): Promise<void> {
  const client = getTableClient('products')
  await client.upsertEntity(product as any, 'Replace')
}

export async function deleteProduct(category: string, productId: string): Promise<void> {
  const client = getTableClient('products')
  await client.deleteEntity(category, productId)
}

// ─── ORDERS ──────────────────────────────────────────────────

export async function createOrder(order: Row): Promise<void> {
  const client = getTableClient('orders')
  await client.createEntity(order as any)
}

export async function getOrder(status: string, orderId: string): Promise<Row | null> {
  const client = getTableClient('orders')
  try {
    return (await client.getEntity(status, orderId)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function getAllOrders(): Promise<Row[]> {
  const rows = await listAll('orders')
  return rows.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )
}

export async function updateOrderStatus(
  currentStatus: string,
  orderId: string,
  newStatus: string
): Promise<void> {
  const client = getTableClient('orders')
  const order = (await client.getEntity(currentStatus, orderId)) as Row
  // Upsert into new partition first - if this fails the original is untouched
  await client.upsertEntity({
    ...order,
    partitionKey: newStatus,
    updatedAt: new Date().toISOString(),
  } as any, 'Replace')
  // Delete from old partition - if this fails the order exists in both partitions
  // (harmless duplicate, not data loss)
  await client.deleteEntity(currentStatus, orderId)
}

export async function createOrderItem(item: Row): Promise<void> {
  const client = getTableClient('orderItems')
  await client.createEntity(item as any)
}

export async function getOrderItems(orderId: string): Promise<Row[]> {
  return listAll('orderItems', odata`PartitionKey eq ${orderId}`)
}

// ─── USERS ───────────────────────────────────────────────────

export async function getUser(email: string): Promise<Row | null> {
  const client = getTableClient('users')
  try {
    return (await client.getEntity('customer', email)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function getUserByGoogleId(googleId: string): Promise<Row | null> {
  const rows = await listAll('users', odata`googleId eq ${googleId}`)
  return rows[0] ?? null
}

export async function createUser(user: Row): Promise<void> {
  const client = getTableClient('users')
  await client.createEntity(user as any)
}

export async function updateUser(user: Row): Promise<void> {
  const client = getTableClient('users')
  await client.upsertEntity(user as any, 'Replace')
}

// ─── ADMINS ──────────────────────────────────────────────────

export async function getAdmin(username: string): Promise<Row | null> {
  const client = getTableClient('admins')
  try {
    return (await client.getEntity('admin', username)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function createAdmin(admin: Row): Promise<void> {
  const client = getTableClient('admins')
  await client.createEntity(admin as any)
}

export async function updateAdmin(admin: Row): Promise<void> {
  const client = getTableClient('admins')
  await client.upsertEntity(admin as any, 'Replace')
}

export async function getAllAdmins(): Promise<Row[]> {
  return listAll('admins')
}

// ─── ANNOUNCEMENTS ───────────────────────────────────────────

export async function listAnnouncements(includeInactive = false): Promise<Row[]> {
  const rows = await listAll('announcements')
  const filtered = includeInactive
    ? rows
    : rows.filter((r) => {
        if (r.active === false) return false
        const now = Date.now()
        if (r.startDate && new Date(String(r.startDate)).getTime() > now) return false
        if (r.endDate && new Date(String(r.endDate)).getTime() < now) return false
        return true
      })
  return filtered.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

export async function getAnnouncement(id: string): Promise<Row | null> {
  const client = getTableClient('announcements')
  try {
    return (await client.getEntity('banner', id)) as Row
  } catch (error: any) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function upsertAnnouncement(announcement: Row): Promise<void> {
  const client = getTableClient('announcements')
  await client.upsertEntity(announcement as any, 'Replace')
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const client = getTableClient('announcements')
  await client.deleteEntity('banner', id)
}

// ─── CONFIG ──────────────────────────────────────────────────

export async function getConfig(key: string): Promise<any> {
  const client = getTableClient('config')
  try {
    const entity = (await client.getEntity('config', key)) as Row
    return JSON.parse(entity.value as string)
  } catch {
    return null
  }
}

export async function setConfig(key: string, value: any): Promise<void> {
  const client = getTableClient('config')
  await client.upsertEntity(
    { partitionKey: 'config', rowKey: key, value: JSON.stringify(value) } as any,
    'Replace'
  )
}
