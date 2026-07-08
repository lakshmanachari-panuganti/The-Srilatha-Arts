# Error Handling Findings & Action Plan

This document outlines the findings from our codebase audit regarding error handling, specifically where `try-catch` blocks are missing and where the user experience for error reporting is sub-optimal. 

*Note: The codebase is generally highly resilient. Many critical sections (including `AccountClient.tsx` logout, `seedAdmin.ts` loops, and `health.ts` checks) ALREADY handle errors correctly through encapsulated functions or internal catch blocks. The findings below highlight the true gaps.*

## 1. Backend: Missing `try-catch` in Scripts & Data Migrations
Scripts running outside of the Azure Functions runtime are highly susceptible to partial failures, leaving data in a corrupted state if not handled.

**File:** `backend/scripts/migrateOrderNumbers.ts`
- **Location:** Line ~147 (inside the `for` loop).
- **Issue:** The script runs `await ordersClient.createEntity(copy)` followed immediately by `await ordersClient.deleteEntity(o.partitionKey, o.rowKey)`. 
- **Required Action:** Wrap these multi-step Azure Table Storage operations in a `try-catch` block inside the loop. If `deleteEntity` fails after `createEntity` succeeds, we currently create duplicate data and crash the node process. We need to implement a fallback or log the specific `rowKey` that failed for manual remediation, allowing the script to safely continue migrating the rest of the orders.

## 2. Frontend: Sub-optimal Error Handling & User Experience
Many admin pages do have `try-catch` blocks, but their catch blocks fall back to raw `console.error` and `alert()`. This is bad UX and lacks structured error reporting.

**File:** `frontend/app/admin/announcements/page.tsx`
- **Location:** Line ~165.
- **Issue:** Uses `catch (err) { console.error(err); alert('Failed to delete announcement.') }`.
- **Required Action:** Replace `alert()` with an inline error state or a Toast notification (e.g., using `react-hot-toast` or `sonner`). Ensure the `err` message from the API is displayed.

**File:** `frontend/app/admin/custom-orders/page.tsx`
- **Location:** Line ~65.
- **Issue:** Uses `alert('Failed to update status. Please try again.')`.
- **Required Action:** Introduce an `actionErr` state (similar to `OrderDetailClient.tsx`) to render an `<ErrorPanel />` or inline error banner.

## 3. Frontend: Missing Route-Specific Error Boundaries
**Files:** `frontend/app/admin/error.tsx`, `frontend/app/account/error.tsx`
- **Issue:** The app currently only has a global error boundary (`frontend/app/error.tsx`). 
- **Required Action:** Introduce nested Next.js error boundaries (`error.tsx`) in the `/admin` and `/account` directories. This ensures that if a specific route crashes, the user only loses that section of the UI, rather than seeing a global application crash.

## 4. Backend: Azure Functions Granular Exception Handling
**Files:** All HTTP Trigger Functions (e.g., `backend/src/functions/orders.ts`, `backend/src/functions/cart.ts`)
- **Issue:** While most HTTP handlers have a top-level `try-catch` block returning a generic 500 Internal Server Error, they lack granular status code mapping for database exceptions.
- **Required Action:** Implement specific exception checks in the catch block. For example, if a database operation throws a `RestError` with a 404/409 (Azure Data Tables), we should return a `404 Not Found` or `409 Conflict` to the frontend instead of a generic `500 Internal Server Error`.
