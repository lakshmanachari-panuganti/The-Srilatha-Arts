/**
 * Extract the true client IP from an Azure Functions HTTP request.
 *
 * Precedence:
 *   1. x-azure-clientip  - set by the Azure App Service front end. This
 *      header is overwritten by the platform on every request, so a
 *      caller cannot spoof it.
 *   2. Rightmost entry of x-forwarded-for - the entry the Azure proxy
 *      appended after any caller-supplied chain. Reading [0] (leftmost)
 *      is spoofable: a caller can prepend any value and the proxy will
 *      simply append the real IP to the right.
 *   3. x-real-ip - fallback for environments that surface only this
 *      header (e.g. local nginx in front of the func host).
 *   4. 'unknown' - keeps rate-limit keys stable when no IP is available.
 *
 * Used by all auth endpoints to key the rate limiter. Getting this
 * wrong turns the rate limit into a no-op (every spoofed request looks
 * like a fresh IP) which is precisely the failure mode that lets
 * credential-stuffing through.
 */

import { HttpRequest } from '@azure/functions'

export function getClientIp(request: HttpRequest): string {
  const azureClientIp = request.headers.get('x-azure-clientip')?.trim()
  if (azureClientIp) return azureClientIp

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    if (parts.length > 0) return parts[parts.length - 1]
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}
