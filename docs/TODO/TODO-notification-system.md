# Notification system - follow-up TODOs

Captured from the 2026-06-11 final verification pass on commit `7940854`. None of these are
production blockers individually; collectively they harden the notification observability
surface for the next 12 months of scale.

## Pre-merge to `develop`

### TODO-N1 · Fix the "Failure rate" calculation on the dashboard - **DONE**

Shipped as part of the same `ai-driven1` branch.

**What landed:**
- `activityStats` now returns `attemptFailureRate` (renamed from the misleading
  `failureRate`), plus `uniqueNotifications`, `finalFailures`, and `notificationFailureRate`.
- `notificationFailureRate` = count of `notificationAlerts` with `isFinal: true` whose
  `lastFailureAt` falls in the window, divided by unique `(orderId, channel, templateKey)`
  groups in the same window - the operationally honest customer-impact metric.
- New `countFinalAlertsInRange` helper in `backend/src/services/notificationAlerts.ts`
  (in-memory filter - alerts table is small, dedup'd by orderId/channel/operation).
- Dashboard now has 5 stat cards: Total attempts / Successful / Failed / **Notification
  failure rate** (red >5% threshold lives here) / Attempt failure rate (text-ink-soft,
  informational, subtitle reads "Send infrastructure (retries count)").
- Notification failure rate card carries a subtitle "N of M notifications" so the source
  numbers are visible without expanding anything.

---

## Pre-merge to `main` / production

### TODO-N2 · PII masking on the activity table view

**Severity:** Medium (security hygiene - shoulder-surfing protection)
**Effort:** ~3 hours, frontend only
**Files:**
- `frontend/app/admin/notifications/page.tsx` (`ActivityRowItem`)
- New: `frontend/lib/maskPii.ts` (small helpers)

**Recommendation:** mask `recipientContact` in the table column by default:
- `r***@gmail.com` for emails (preserve first char + domain)
- `+91 ****** 1234` for phones (preserve country code + last 4)

Full reveal on the expanded row (click to expand - already implemented).

Add a per-session "Reveal contacts" toggle near the filter bar so an admin doing bulk
support work can flip it for the session. State stored in localStorage so it persists
across page reloads.

API stays full-fidelity (admins legitimately need the values for support). Masking is
purely a client-side render concern.

### TODO-N3 · Add channel-level health cards

**Severity:** Low (operational visibility - data already exists in the API)
**Effort:** ~1 hour
**Files:**
- `frontend/app/admin/notifications/page.tsx` (`StatCards` section)

The `byChannel` block in the stats API response is already computed and returned. Render
two more cards under the existing four:

```
Email today                          WhatsApp today
12 sent · 1 failed · 8.3% failure    11 sent · 2 failed · 18% failure
```

Apply the same failure-rate redefinition from TODO-N1.

### TODO-N4 · Cursor pagination on the activity feed

**Severity:** Low (paper risk at studio scale, real risk above ~10k notifications/month)
**Effort:** ~half day
**Files:**
- `backend/src/functions/notificationsAdmin.ts` (`listActivity`)
- `frontend/app/admin/notifications/page.tsx`

Today: max 200 results returned, no offset / continuation. Admin cannot view notifications
older than the current page (they'd have to narrow the date range to see them).

Add: `?cursor=<base64({lastCreatedAt, lastChannel, lastRowKey})>` parameter. Server uses
the cursor to filter `createdAt lt <cursorTimestamp>` and returns a next-cursor in the
response. UI shows "Load older" button when next-cursor present.

### TODO-N5 · Date-range upper bound

**Severity:** Low (DOS-class against the Function App; admin endpoint so blast radius limited)
**Effort:** ~30 minutes
**Files:**
- `backend/src/functions/notificationsAdmin.ts` (both endpoints)

Reject ranges > 365 days unless `?allowFullScan=true` is explicitly set. Stops accidental
full-table scans from a poorly-set custom range. Logs the override use for audit.

---

## Post-launch (optional)

### TODO-N6 · Pre-aggregated daily stats table

**Severity:** Low (optimization for >50k notifications/month - not relevant today)
**Effort:** ~1 day

Nightly timer-triggered Function that writes a daily roll-up to a `notificationStatsDaily`
table partitioned by `YYYY-MM`. Stats endpoint reads pre-aggregated rows instead of
scanning emailLog + whatsappMessages every request. Sub-100ms response regardless of
historical volume.

Defer until the studio's monthly notification volume exceeds 10k or stats latency exceeds 2s.

### TODO-N7 · Per-template alert thresholds

**Severity:** Low (nice-to-have)
**Effort:** ~half day

Today the dashboard alerts on ANY final failure. Some templates may legitimately have a
small steady failure rate (e.g., customers who entered typo'd emails). Worth allowing
per-template alert thresholds: "Only alert on order_confirmed if failure rate > 1%; alert
on order_shipped if failure rate > 0%". Configurable per-template in admin settings.

Surface in the existing template breakdown table.
