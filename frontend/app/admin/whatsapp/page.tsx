'use client'

/**
 * Admin WhatsApp Conversation Center (view-only).
 *
 *   ┌──── conversations rail ────┐┌────────── selected thread ──────────┐
 *   │ search + list of phones    ││  message bubbles (inbound vs out)    │
 *   │ unread badges + previews   ││  right column: linked orders / PDFs  │
 *   └─────────────────────────────┘└──────────────────────────────────────┘
 *
 * Reads from /api/admin/whatsapp/conversations and
 * /api/admin/whatsapp/conversations/{phone}. No reply UX yet - see
 * docs/TODO-2026-06-04.md for the reply phase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  MessageCircle,
  CheckCheck,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Inbox,
  Send,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatINR, formatDate } from '@/lib/format'

interface ConversationSummary {
  phone: string
  customerName: string
  customerEmail: string
  lastMessageAt: string
  lastMessagePreview: string
  lastDirection: 'inbound' | 'outbound'
  lastOrderId?: string
  unreadCount: number
  createdAt: string
  updatedAt: string
}

interface WhatsAppMessage {
  rowKey: string
  direction: 'inbound' | 'outbound'
  waMessageId: string
  contextMessageId?: string
  type: string
  templateName?: string
  text?: string
  mediaUrl?: string
  mediaCaption?: string
  orderId?: string
  invoiceId?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'sending'
  statusError?: string
  createdAt: string
  updatedAt: string
  /** Set on optimistic messages until the server confirms or rejects. */
  optimisticId?: string
}

interface RelatedOrder {
  id: string
  status: string
  paymentStatus: string
  displayTotal: number
  invoiceUrl?: string
  customerName: string
  createdAt: string
}

interface ConversationDetail {
  conversation: ConversationSummary
  messages: WhatsAppMessage[]
  relatedOrders: RelatedOrder[]
}

function formatPhoneDisplay(phone: string): string {
  // Render E.164-without-plus as "+91 90523 80325" style for readability.
  if (!phone) return ''
  if (phone.length === 12 && phone.startsWith('91')) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`
  }
  return `+${phone}`
}

function formatRelative(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Date.now() - t
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

function StatusIcon({ status }: { status?: WhatsAppMessage['status'] }) {
  if (status === 'read')
    return <CheckCheck className="w-3.5 h-3.5 text-emerald-500" aria-label="Read" />
  if (status === 'delivered')
    return <CheckCheck className="w-3.5 h-3.5 text-ink-mute" aria-label="Delivered" />
  if (status === 'sent')
    return <Check className="w-3.5 h-3.5 text-ink-mute" aria-label="Sent" />
  if (status === 'failed')
    return <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-label="Failed" />
  if (status === 'sending')
    return <Loader2 className="w-3.5 h-3.5 text-ink-mute animate-spin" aria-label="Sending" />
  return null
}

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listErr, setListErr] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailErr, setDetailErr] = useState('')

  // Composer state
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const messagesEndRef = useRef<HTMLLIElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const refreshList = useCallback(async () => {
    setListErr('')
    try {
      const r = await apiFetch<{ conversations: ConversationSummary[] }>(
        `/admin/whatsapp/conversations${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      )
      setConversations(r.conversations || [])
      // Auto-select the first conversation when nothing is selected yet
      if (!selected && (r.conversations || []).length > 0) {
        setSelected(r.conversations[0].phone)
      }
    } catch (e) {
      setListErr(e instanceof Error ? e.message : 'Could not load conversations')
    } finally {
      setLoadingList(false)
    }
  }, [query, selected])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const refreshDetail = useCallback(async (phone: string) => {
    setLoadingDetail(true)
    setDetailErr('')
    try {
      const r = await apiFetch<ConversationDetail>(
        `/admin/whatsapp/conversations/${encodeURIComponent(phone)}`,
      )
      setDetail(r)
      // Optimistically clear unread badge in the list now that the
      // backend has reset it.
      setConversations((prev) =>
        prev.map((c) => (c.phone === phone ? { ...c, unreadCount: 0 } : c)),
      )
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : 'Could not load conversation')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selected) refreshDetail(selected)
  }, [selected, refreshDetail])

  // Reset composer when switching threads — don't carry a draft across phones.
  useEffect(() => {
    setReplyText('')
    setSendErr('')
  }, [selected])

  // Auto-scroll to the newest message when a thread loads or a reply is sent.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [detail?.messages.length])

  const sendReply = useCallback(async () => {
    const text = replyText.trim()
    if (!text || sending || !selected || !detail) return

    const optimisticId = `optimistic-${Date.now()}`
    const now = new Date().toISOString()
    const optimistic: WhatsAppMessage = {
      rowKey: optimisticId,
      optimisticId,
      direction: 'outbound',
      waMessageId: '',
      type: 'text',
      text,
      status: 'sending',
      createdAt: now,
      updatedAt: now,
    }

    setDetail((d) => (d ? { ...d, messages: [...d.messages, optimistic] } : d))
    setReplyText('')
    setSendErr('')
    setSending(true)

    try {
      const r = await apiFetch<{ message: WhatsAppMessage }>(
        `/admin/whatsapp/conversations/${encodeURIComponent(selected)}/send`,
        { method: 'POST', body: { text } },
      )
      // Replace optimistic with confirmed.
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) =>
                m.optimisticId === optimisticId ? r.message : m,
              ),
            }
          : d,
      )
      // Keep the inbox left rail in sync — bump preview + last-message-at.
      setConversations((prev) =>
        prev.map((c) =>
          c.phone === selected
            ? {
                ...c,
                lastMessageAt: r.message.createdAt,
                lastMessagePreview: text,
                lastDirection: 'outbound',
              }
            : c,
        ),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Send failed'
      setSendErr(message)
      // Mark the optimistic bubble as failed so the operator knows nothing
      // got through (and can retype/retry).
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) =>
                m.optimisticId === optimisticId
                  ? { ...m, status: 'failed', statusError: message }
                  : m,
              ),
            }
          : d,
      )
      // Restore the draft so the operator doesn't have to retype.
      setReplyText(text)
    } finally {
      setSending(false)
      // Return focus so they can keep typing without grabbing the mouse.
      composerRef.current?.focus()
    }
  }, [replyText, sending, selected, detail])

  const filtered = useMemo(() => conversations, [conversations])
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  )

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4">
      {/* ── Left rail: conversations list ─────────────────────────── */}
      <aside className="lg:w-[340px] flex flex-col bg-plum-light border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-ink-soft" />
          <h1 className="font-serif text-base text-ink">
            WhatsApp inbox
          </h1>
          {totalUnread > 0 && (
            <span className="ml-auto text-[11px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 rounded-full">
              {totalUnread} new
            </span>
          )}
        </div>

        <div className="px-3 py-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-mute" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phone, name, message…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-plum border border-white/10 rounded-md text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-lavender focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-6 text-sm text-ink-mute flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : listErr ? (
            <div className="p-4 text-sm text-red-300">{listErr}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-ink-mute flex flex-col items-center gap-2 text-center">
              <Inbox className="w-6 h-6 text-ink-mute" />
              <div>No conversations yet.</div>
              <div className="text-xs">
                Conversations appear here when the system sends a confirmation or a customer replies.
              </div>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isActive = c.phone === selected
                const hasUnread = c.unreadCount > 0
                return (
                  <li key={c.phone}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.phone)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isActive ? 'bg-white/[0.07]' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm truncate ${hasUnread ? 'text-ink font-semibold' : 'text-ink'}`}>
                              {c.customerName || formatPhoneDisplay(c.phone)}
                            </span>
                            {hasUnread && (
                              <span className="ml-auto shrink-0 text-[10px] min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ink-mute mt-0.5">
                            {formatPhoneDisplay(c.phone)}
                          </div>
                          <div className={`text-xs mt-1 truncate ${hasUnread ? 'text-ink-soft' : 'text-ink-mute'}`}>
                            {c.lastDirection === 'outbound' ? '↗ ' : '↘ '}
                            {c.lastMessagePreview}
                          </div>
                        </div>
                        <div className="text-[10px] text-ink-mute whitespace-nowrap pl-1">
                          {formatRelative(c.lastMessageAt)}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Main pane: thread + related ───────────────────────────── */}
      <section className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 min-h-0">
        <div className="bg-plum-light border border-white/10 rounded-xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="m-auto p-8 text-sm text-ink-mute flex flex-col items-center gap-3">
              <MessageCircle className="w-8 h-8 text-ink-mute" />
              <div>Pick a conversation to read.</div>
            </div>
          ) : loadingDetail && !detail ? (
            <div className="m-auto p-8 text-sm text-ink-mute flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
            </div>
          ) : detailErr ? (
            <div className="m-4 p-4 text-sm bg-red-500/10 text-red-300 border border-red-500/30 rounded">
              {detailErr}
            </div>
          ) : detail ? (
            <>
              <header className="px-5 py-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-serif text-lg text-ink">
                      {detail.conversation.customerName || formatPhoneDisplay(detail.conversation.phone)}
                    </div>
                    <div className="text-xs text-ink-mute">
                      {formatPhoneDisplay(detail.conversation.phone)}
                      {detail.conversation.customerEmail ? ` · ${detail.conversation.customerEmail}` : ''}
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${detail.conversation.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ink-soft hover:text-ink inline-flex items-center gap-1.5"
                  >
                    Open on WhatsApp <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-4 bg-plum/60">
                {detail.messages.length === 0 ? (
                  <div className="text-sm text-ink-mute text-center mt-12">
                    No messages yet on this thread.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {detail.messages.map((m) => {
                      const isOut = m.direction === 'outbound'
                      return (
                        <li key={m.rowKey} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-wrap break-words ${
                              isOut
                                ? 'bg-emerald-500/15 text-ink border border-emerald-400/25 rounded-tr-sm'
                                : 'bg-slate-800 text-ink border border-white/10 rounded-tl-sm'
                            }`}
                          >
                            {m.templateName && (
                              <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-0.5">
                                Template · {m.templateName}
                              </div>
                            )}
                            {m.text || m.mediaCaption || <span className="text-ink-mute">[{m.type}]</span>}
                            {m.mediaUrl && (
                              <div className="mt-1">
                                <a
                                  href={m.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-lavender hover:text-lavender-soft underline inline-flex items-center gap-1"
                                >
                                  View attachment <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-ink-mute justify-end">
                              <span>{formatRelative(m.createdAt)}</span>
                              {isOut && <StatusIcon status={m.status} />}
                            </div>
                            {m.statusError && (
                              <div className="text-[10px] text-red-400 mt-0.5">{m.statusError}</div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                    <li ref={messagesEndRef} aria-hidden="true" />
                  </ul>
                )}
              </div>

              {/* ── Composer ─────────────────────────────────────── */}
              <div className="border-t border-white/10 bg-plum/80 px-4 py-3">
                {sendErr && (
                  <div className="mb-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2.5 py-1.5">
                    {sendErr}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendReply()
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    ref={composerRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter inserts a newline.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendReply()
                      }
                    }}
                    rows={2}
                    maxLength={4096}
                    placeholder="Type a reply…  (Enter to send, Shift+Enter for new line)"
                    disabled={sending}
                    className="flex-1 resize-none text-sm bg-plum border border-white/10 rounded-md px-3 py-2 text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-lavender focus:border-transparent disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
                <p className="text-[10px] text-ink-mute mt-1.5">
                  Free-form replies require the customer to have messaged within
                  the last 24 hours (WhatsApp policy). Outside that window, use a
                  template from the order page.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Right context column: linked orders + invoices */}
        <aside className="hidden xl:flex flex-col bg-plum-light border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="font-serif text-sm text-ink">Linked orders</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!detail || detail.relatedOrders.length === 0 ? (
              <div className="text-xs text-ink-mute p-2">
                No orders linked to this conversation yet.
              </div>
            ) : (
              detail.relatedOrders.map((o) => (
                <div
                  key={o.id}
                  className="border border-white/10 bg-plum/40 rounded-md p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/orders/detail?id=${encodeURIComponent(o.id)}`}
                      className="font-mono text-lavender hover:text-lavender-soft hover:underline truncate"
                    >
                      {o.id}
                    </Link>
                    <span className="text-[10px] uppercase tracking-wider text-ink-mute">
                      {o.status}
                    </span>
                  </div>
                  <div className="text-ink-soft">{formatINR(o.displayTotal)}</div>
                  <div className="text-ink-mute">
                    {formatDate(o.createdAt)} · {o.paymentStatus}
                  </div>
                  {o.invoiceUrl && (
                    <a
                      href={o.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-lavender hover:text-lavender-soft hover:underline"
                    >
                      View invoice <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
