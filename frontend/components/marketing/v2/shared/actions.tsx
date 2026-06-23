'use client'

/**
 * ActionPanel — the shared commerce primitive for v2 rooms.
 *
 * Branches by availability state, wires real cart actions through the
 * existing useAddToCart hook (which handles auth gating, pending intents,
 * login redirect, and the cart drawer), and fires typed analytics events
 * scoped to the originating room via `source`.
 *
 * Rooms supply an `ActionablePiece` (minimum: slug, title, availability)
 * plus their own `source` identifier. Rooms with richer data (FeaturedWorks,
 * Room 07) simply pass a superset of the interface — TypeScript narrows.
 *
 * CTAs per state:
 *   available           Buy Now (resin)  +  Add to Cart (outline)
 *                       View Details · Inquire on WhatsApp
 *
 *   reserved            View Details (outline)
 *                       Inquire on WhatsApp
 *
 *   commission-only     Begin a Commission (resin)
 *                       Inquire on WhatsApp (commission-flavored prefill)
 *
 *   acquired            Commission a Similar Piece (resin)
 *                       (no inquiry — the piece is sold; commission is the
 *                        only meaningful path forward)
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useAddToCart } from '@/hooks/useAddToCart'
import { apiFetch } from '@/lib/api'
import type { Product } from '@/types'
import { trackEvent, type AnalyticsSource } from './analytics'
import { waLink } from '@/lib/site-config'

export interface ActionablePiece {
  slug: string
  title: string
  availability:
    | 'available'
    | 'reserved'
    | 'acquired'
    | 'commission-only'
  price?: { kind: 'exact' | 'starting-from'; amount: number; currency?: 'INR' }
  productId?: string | number
  /** Optional override for the WhatsApp pre-fill. Falls back to a templated
   *  message that mentions the title and the room context. */
  inquiryPrefill?: string
}

export function ActionPanel({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  switch (piece.availability) {
    case 'acquired':
      return <AcquiredActions piece={piece} source={source} />
    case 'commission-only':
      return <CommissionActions piece={piece} source={source} />
    case 'reserved':
      return <ReservedActions piece={piece} source={source} />
    case 'available':
    default:
      return <AvailableActions piece={piece} source={source} />
  }
}

// ── Available — full commerce stack ──────────────────────────────
function AvailableActions({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  const router = useRouter()
  const { addToCart } = useAddToCart()
  const [busy, setBusy] = useState<null | 'buy' | 'cart'>(null)

  const handle = async (action: 'buy' | 'cart') => {
    if (!piece.productId) {
      router.push('/shop')
      return
    }
    setBusy(action)
    try {
      const res = await apiFetch<{ product: Product }>(
        `/products/${encodeURIComponent(String(piece.productId))}`,
      )
      const product = res.product
      const added = addToCart(product, 1, { openDrawer: action === 'cart' })
      if (!added) return // useAddToCart sent the visitor to login; intent will replay
      trackEvent({
        name: action === 'buy' ? 'begin_checkout' : 'add_to_cart',
        params: {
          item_id: String(piece.productId),
          item_name: piece.title,
          price: piece.price?.amount,
          source,
        },
      })
      if (action === 'buy') router.push('/checkout')
    } catch {
      // Fetch failed — fall back to PDP so visitor can still act.
      router.push(`/product/${encodeURIComponent(String(piece.productId))}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => handle('buy')}
          disabled={busy !== null}
          aria-label={`Buy "${piece.title}" now`}
          data-track="action_buy_now"
          data-piece={piece.slug}
          data-source={source}
          className="btn-resin"
        >
          {busy === 'buy' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <ShoppingBag className="w-4 h-4" aria-hidden />
          )}
          {busy === 'buy' ? 'Adding…' : 'Buy Now'}
        </button>
        <button
          type="button"
          onClick={() => handle('cart')}
          disabled={busy !== null}
          aria-label={`Add "${piece.title}" to cart`}
          data-track="action_add_to_cart"
          data-piece={piece.slug}
          data-source={source}
          className="btn-outline"
        >
          {busy === 'cart' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : null}
          {busy === 'cart' ? 'Adding…' : 'Add to Cart'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ViewDetailsLink piece={piece} source={source} />
        <WhatsAppInquiryLink piece={piece} source={source} />
      </div>
    </div>
  )
}

// ── Reserved — no cart, but Details is still discoverable ─────────
function ReservedActions({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  return (
    <div className="flex flex-col gap-5">
      {piece.productId && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/product/${encodeURIComponent(String(piece.productId))}`}
            data-track="action_view_details"
            data-piece={piece.slug}
            data-source={source}
            onClick={() =>
              trackEvent({
                name: 'select_item',
                params: {
                  item_id: String(piece.productId!),
                  item_name: piece.title,
                  source,
                },
              })
            }
            className="btn-outline"
          >
            View Details
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <WhatsAppInquiryLink piece={piece} source={source} />
      </div>
    </div>
  )
}

// ── Commission-only — primary path = /custom-order ────────────────
function CommissionActions({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/custom-order?inspiration=${encodeURIComponent(piece.slug)}`}
          data-track="action_commission"
          data-piece={piece.slug}
          data-source={source}
          onClick={() =>
            trackEvent({
              name: 'commission_inquiry',
              params: {
                item_id: piece.productId ? String(piece.productId) : undefined,
                item_name: piece.title,
                source,
              },
            })
          }
          className="btn-resin"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          Begin a Commission
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <WhatsAppInquiryLink piece={piece} source={source} kind="commission" />
      </div>
    </div>
  )
}

// ── Acquired — pure pivot to commission. No inquiry, no purchase. ───
function AcquiredActions({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/custom-order?inspiration=${encodeURIComponent(piece.slug)}`}
          data-track="action_commission_similar"
          data-piece={piece.slug}
          data-source={source}
          onClick={() =>
            trackEvent({
              name: 'commission_inquiry',
              params: {
                item_id: piece.productId ? String(piece.productId) : undefined,
                item_name: piece.title,
                source,
              },
            })
          }
          className="btn-resin"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          Commission a Similar Piece
        </Link>
      </div>
    </div>
  )
}

// ── Reusable: View Details text link ─────────────────────────────
function ViewDetailsLink({
  piece,
  source,
}: {
  piece: ActionablePiece
  source: AnalyticsSource
}) {
  if (!piece.productId) return null
  return (
    <Link
      href={`/product/${encodeURIComponent(String(piece.productId))}`}
      data-track="action_view_details"
      data-piece={piece.slug}
      data-source={source}
      onClick={() =>
        trackEvent({
          name: 'select_item',
          params: {
            item_id: String(piece.productId!),
            item_name: piece.title,
            source,
          },
        })
      }
      className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase
                 text-ink/80 hover:text-ink transition-all duration-500
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-[color:var(--accent-strong)]
                 focus-visible:ring-offset-2 focus-visible:ring-offset-plum rounded-sm"
      style={{ letterSpacing: '0.14em' }}
    >
      <span className="relative">
        View Details
        <span
          aria-hidden
          className="absolute -bottom-1 left-0 h-px w-full bg-ink/30
                     scale-x-0 origin-left transition-transform duration-500
                     group-hover:scale-x-100 group-focus-visible:scale-x-100"
        />
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
    </Link>
  )
}

// ── Reusable: WhatsApp inquiry text link ─────────────────────────
function WhatsAppInquiryLink({
  piece,
  source,
  kind = 'inquiry',
}: {
  piece: ActionablePiece
  source: AnalyticsSource
  kind?: 'inquiry' | 'commission'
}) {
  const baseMessage =
    piece.inquiryPrefill ??
    (kind === 'commission'
      ? `Hi Srilatha, I'd like to discuss commissioning a piece inspired by "${piece.title}".`
      : `Hi Srilatha, I'd like to discuss "${piece.title}" — I've been picturing it on a wall at home.`)
  const href = waLink(baseMessage)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Inquire about "${piece.title}" on WhatsApp`}
      data-track="action_whatsapp_inquiry"
      data-piece={piece.slug}
      data-source={source}
      onClick={() =>
        trackEvent({
          name: 'whatsapp_inquiry',
          params: {
            item_id: piece.productId ? String(piece.productId) : undefined,
            item_name: piece.title,
            source,
          },
        })
      }
      className="group inline-flex items-center gap-2.5 text-sm font-semibold uppercase
                 text-[color:var(--accent-strong)] hover:text-[color:var(--gold-deep)]
                 transition-colors duration-500
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-[color:var(--accent-strong)]
                 focus-visible:ring-offset-2 focus-visible:ring-offset-plum rounded-sm"
      style={{ letterSpacing: '0.14em' }}
    >
      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
      <span>Inquire on WhatsApp</span>
    </a>
  )
}

// ── AvailabilityBadge — letterpress-style status tag, dot-coloured by state ──
export function AvailabilityBadge({
  availability,
}: {
  availability: ActionablePiece['availability']
}) {
  const STYLES: Record<
    ActionablePiece['availability'],
    { label: string; dotColor: string }
  > = {
    available:         { label: 'Available for acquisition',           dotColor: 'rgb(26, 127, 75)' },
    reserved:          { label: 'Reserved (in escrow)',                dotColor: 'rgb(200, 150, 47)' },
    acquired:          { label: 'Privately acquired',                  dotColor: 'rgb(138, 126, 110)' },
    'commission-only': { label: 'Commission only — variations on request', dotColor: 'rgb(138, 106, 26)' },
  }
  const { label, dotColor } = STYLES[availability]
  return (
    <span
      className="inline-flex items-center gap-2.5 text-[10px] uppercase font-semibold text-ink/80"
      style={{ letterSpacing: '0.32em' }}
    >
      <span
        aria-hidden
        className="block w-1.5 h-1.5 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}55` }}
      />
      {label}
    </span>
  )
}
