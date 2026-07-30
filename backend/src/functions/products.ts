import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  getAllProducts,
  getProductsByCategory,
  getProductById,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  getOnSaleProducts,
  Row,
} from '../services/tableStorage'
import {
  errorResponse,
  corsPreflightResponse,
  cacheableJsonResponse,
} from '../utils/response'
import { toApi } from '../utils/productApi'


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
    const onSale = request.query.get('onSale')

    let rows: Row[]
    if (category) rows = await getProductsByCategory(category)
    else if (featured === 'true') rows = await getFeaturedProducts()
    else if (newArrivals === 'true') rows = await getNewArrivals()
    else if (bestSellers === 'true') rows = await getBestSellers()
    else if (onSale === 'true') rows = await getOnSaleProducts()
    else rows = await getAllProducts()

    // Catalog listings are read-mostly. s-maxage lets a shared cache
    // (CDN / SWA edge) absorb load; the ETag turns a repeat read into a
    // 304 with no storage transaction at all.
    //
    // No stale-while-revalidate on purpose. It *adds* to max-age rather
    // than replacing it, so `max-age=60, swr=600` means a reload can
    // serve up-to-11-minute-old data. This payload carries stockQty and
    // inStock for one-of-one artwork, and 11 minutes of "still
    // available" on a piece that already sold is not a trade worth
    // making for a marginal latency win.
    return cacheableJsonResponse(
      request,
      { products: rows.map(toApi) },
      'public, max-age=60, s-maxage=120',
      origin,
    )
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
    // Shorter than the listing on purpose. This response drives the
    // "Add to cart" decision and carries stockQty/inStock, and the
    // catalog is one-of-one artwork — a piece that sold 50 seconds ago
    // must not still look available on its own product page. 15s keeps
    // the bot/refresh traffic off storage while keeping the window in
    // which a customer can be disappointed close to what it was before
    // caching existed.
    return cacheableJsonResponse(
      request,
      { product: toApi(row) },
      'public, max-age=15, s-maxage=30',
      origin,
    )
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
