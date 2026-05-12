import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getAllProducts,
  getProductsByCategory,
  getProductById,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  Row,
} from '../services/tableStorage'
import { jsonResponse, errorResponse, corsPreflightResponse } from '../utils/response'

function toApi(row: Row) {
  return {
    id: row.rowKey,
    slug: row.slug || row.rowKey,
    title: row.title,
    category: row.partitionKey,
    price: row.displayPrice ?? row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    size: row.size,
    material: row.material,
    timeToMake: row.timeToMake || '5 days',
    description: row.description,
    shortDescription: row.shortDescription || row.description?.slice(0, 120),
    careInstructions: row.careInstructions || '',
    images: [row.imageUrl, ...safeArray(row.additionalImages)].filter(Boolean),
    inStock: row.inStock !== false,
    stockQty: row.stockQty ?? 0,
    featured: row.featured === true,
    isNewArrival: row.isNewArrival === true,
    isBestSeller: row.isBestSeller === true,
    isOnSale: row.compareAtPrice ? row.compareAtPrice > (row.displayPrice ?? row.price) : false,
    rating: row.rating ?? undefined,
    reviewCount: row.reviewCount ?? undefined,
    createdAt: row.createdAt,
  }
}

function safeArray(json: unknown): string[] {
  if (!json) return []
  if (Array.isArray(json)) return json as string[]
  try {
    const parsed = JSON.parse(String(json))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getProducts(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const category = request.query.get('category')
    const featured = request.query.get('featured')
    const newArrivals = request.query.get('newArrivals')
    const bestSellers = request.query.get('bestSellers')

    let rows: Row[]
    if (category) rows = await getProductsByCategory(category)
    else if (featured === 'true') rows = await getFeaturedProducts()
    else if (newArrivals === 'true') rows = await getNewArrivals()
    else if (bestSellers === 'true') rows = await getBestSellers()
    else rows = await getAllProducts()

    return jsonResponse({ products: rows.map(toApi) }, 200, {}, origin)
  } catch (err) {
    context.error('getProducts failed', err)
    return errorResponse('Failed to load products', 500, origin)
  }
}

export async function getProductByIdFn(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return corsPreflightResponse(origin)

  const id = request.params.id
  if (!id) return errorResponse('Missing product id', 400, origin)

  try {
    const row = await getProductById(id)
    if (!row) return errorResponse('Product not found', 404, origin)
    return jsonResponse({ product: toApi(row) }, 200, {}, origin)
  } catch (err) {
    context.error('getProductById failed', err)
    return errorResponse('Failed to load product', 500, origin)
  }
}

app.http('getProducts', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/products',
  authLevel: 'anonymous',
  handler: getProducts,
})

app.http('getProductById', {
  methods: ['GET', 'OPTIONS'],
  route: 'api/products/{id}',
  authLevel: 'anonymous',
  handler: getProductByIdFn,
})
