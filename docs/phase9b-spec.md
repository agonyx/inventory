# Phase 9B — Frontend Bug Fixes & UX Polish

> **For Hermes:** Use OpenCode via tmux to implement this spec.
> **Goal:** Fix all frontend bugs and UX issues.
> **Files to modify:** web/src/ files only. No server changes.

---

## Task 1: Add debounce to audit log search (#47)

**File:** `web/src/pages/AuditLogsPage.tsx` (~line 53-58)

**Fix:** The search input fires an API call on every keystroke. Wrap the search handler in a debounce (300ms). You can use a simple `useTimeout` pattern with `useRef` + `setTimeout`/`clearTimeout`, or inline it. The pattern:
```
const timerRef = useRef<number>();
const handleSearchChange = (value: string) => {
  clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => { setSearch(value); }, 300);
};
```

---

## Task 2: Fix useAuth firing without token (#48)

**File:** `web/src/hooks/useAuth.ts` (~line 28-39)

**Fix:** The `useAuth()` hook calls `/auth/me` even when no token exists, causing a doomed 401 request on every mount. Add a guard: only enable the query if a token exists in localStorage. Use the `enabled` option in React Query.

---

## Task 3: Fix variant edits silently dropped in ProductForm (#49)

**File:** `web/src/components/ProductForm.tsx` (~line 276-298)

**Fix:** When editing existing variants, changes to variant name/SKU/barcode are not sent to the API. After saving the product, loop through existing variants and call the variant update API (`PATCH /api/products/:productId/variants/:variantId`) for any that changed. Compare against the original variant data.

---

## Task 4: Fix duplicate notifRef in Layout (#50)

**File:** `web/src/components/Layout.tsx` (~line 94, 174)

**Fix:** There are two `notifRef` declarations. Remove the duplicate and keep only one. Make sure the click-outside handler uses the correct ref.

---

## Task 5: Remove adjustedBy from StockAdjustDialog (#51)

**File:** `web/src/components/StockAdjustDialog.tsx` (~line 31)

**Fix:** The backend now derives `adjustedBy` from JWT (Phase 8 fix). Remove the `adjustedBy` field from the dialog form entirely — no need to send it.

---

## Task 6: Fix useStocktake('') and usePurchaseOrder('') empty ID queries (#52, #53)

**Files:**
- `web/src/pages/StocktakesPage.tsx` (~line 100)
- `web/src/pages/PurchaseOrdersPage.tsx` (~line 87)

**Fix:** When no stocktake/PO is selected (modal closed), the hook is called with empty string `''`. Use `enabled: !!id` in the React Query options to skip the query when ID is empty.

---

## Task 7: Use type="password" for webhook secret input (#54)

**File:** `web/src/pages/WebhookConfigsPage.tsx` (~line 210-219)

**Fix:** Change the webhook secret input from `type="text"` to `type="password"` so the secret isn't shown in plaintext.

---

## Task 8: Fix falsy guard skipping page=0 in audit logs (#55)

**File:** `web/src/hooks/useAuditLogs.ts` (~line 39-40)

**Fix:** The code uses `if (page && limit)` which skips when page=0 (falsy). Change to `if (page != null && limit != null)` or `if (page !== undefined && limit !== undefined)`.

---

## Task 9: Exclude select/input from keyboard shortcuts (#56)

**File:** `web/src/hooks/useKeyboardShortcuts.ts` (~line 8-19)

**Fix:** The keyboard shortcut handler fires even when user is typing in a `<select>` dropdown or `<input>` field. Add a check that the active element is not an `input`, `select`, `textarea`, or element with `contentEditable`.

---

## Task 10: Fix falsy variantId collision in ReturnsPage (#57)

**File:** `web/src/pages/ReturnsPage.tsx` (~line 174, 187, 195, 215, 228)

**Fix:** `item.variantId || ''` causes all items with falsy variantIds to use `''` as React key, causing rendering bugs. Use `item.variantId ?? 'unknown'` or `item.id` as the key instead.

---

## Task 11: Fix orders limited to 50 in ReturnsPage (#58)

**File:** `web/src/pages/ReturnsPage.tsx` (~line 78)

**Fix:** `useOrders({ limit: '50' })` means orders beyond 50 aren't selectable for returns. Increase to at least 200 or add a search/filter to the order selector.

---

## Task 12: Fix UserForm stale state on prop change (#59)

**File:** `web/src/components/UserForm.tsx` (~line 38)

**Fix:** When the `user` prop changes, the form doesn't reset. Add a `useEffect` that resets the form state when `user` changes (compare by user.id).

---

## Task 13: Fix nested button in PickListTable (#60)

**File:** `web/src/components/PickListTable.tsx` (~line 101-122)

**Fix:** There's a `<button>` nested inside another `<button>`, which is invalid HTML. Replace the outer button with a `<div>` with `role="button"` and `onClick`, or restructure so there's no nesting.

---

## Task 14: Fix variant removal race condition in ProductForm (#61)

**File:** `web/src/components/ProductForm.tsx` (~line 200-223)

**Fix:** Currently removes the variant from local state before the API confirms. Change to: call the delete API first, then remove from state only on success. On error, show the error and keep the variant in the list.

---

## Task 15: Fix admin email leaked in login placeholder (#65)

**File:** `web/src/pages/LoginPage.tsx` (~line 43)

**Fix:** Remove or change the placeholder text that contains `admin@nicheinventory.local`. Use a generic placeholder like `you@company.com`.

---

## Task 16: Fix useEffect no dependency arrays (#68)

**Files:**
- `web/src/pages/InventoryPage.tsx` (~line 59)
- `web/src/pages/ProductsPage.tsx` (~line 87)
- `web/src/pages/OrdersPage.tsx` (~line 234)

**Fix:** These `useEffect` calls have no dependency array, running on every render. Add proper dependency arrays based on what the effect actually depends on. If the effect is meant to run once, add `[]`.

---

## Task 17: Remove dead exportParams in ProductsPage (#69)

**File:** `web/src/pages/ProductsPage.tsx` (~line 211-214)

**Fix:** `exportParams` is computed but never used. Remove it.

---

## Task 18: Use product.lowStockThreshold instead of hardcoded 5 (#70)

**File:** `web/src/pages/InventoryPage.tsx` (~line 150, 267)

**Fix:** Replace hardcoded `5` with the actual product's `lowStockThreshold` value from the variant's product relation.

---

## Task 19: Fix null vs undefined for type/address in LocationsPage (#76)

**File:** `web/src/pages/LocationsPage.tsx` (~line 99-103)

**Fix:** Change `type: null, address: null` to `type: '', address: ''` or use `undefined`. The form likely expects empty string, not null.

---

## Task 20: Add missing closeForm to useEffect deps (#77)

**Files:**
- `web/src/pages/LocationsPage.tsx` (~line 134)
- `web/src/pages/SuppliersPage.tsx` (~line 132)

**Fix:** `closeForm` is used inside `useEffect` but not in the dependency array. Wrap `closeForm` in `useCallback` and add it to deps, or move the effect logic.

---

## Task 21: Fix array index keys in PurchaseOrdersPage (#78)

**File:** `web/src/pages/PurchaseOrdersPage.tsx` (~line 474)

**Fix:** Replace `key={index}` with `key={item.id}` for PO items in the list.

---

## Task 22: Reduce pickList polling to 30s with visibility API (#79)

**File:** `web/src/hooks/usePickList.ts` (~line 21)

**Fix:** Change polling from 10s to 30s. Add `refetchOnWindowFocus: true` so it still updates when the user switches back to the tab.

---

## Task 23: Clamp setLimit to minimum 1 (#80)

**File:** `web/src/hooks/useUrlFilters.ts` (~line 121)

**Fix:** In `setLimit`, clamp the value: `Math.max(1, value)`.

---

## Task 24: Deduplicate nextStatus/nextLabel in OrdersPage (#83)

**File:** `web/src/pages/OrdersPage.tsx` (~line 386-392, 682-696)

**Fix:** The nextStatus/nextLabel lookup tables are defined twice. Extract to a single constant at the top of the file or a shared utility.

---

## Task 25: Fix double success feedback in SettingsPage (#84)

**File:** `web/src/pages/SettingsPage.tsx` (~line 40-54)

**Fix:** Remove the duplicate success feedback — keep only the toast notification, remove the inline banner.

---

## Task 26: Make chart title match date range (#85)

**File:** `web/src/pages/ReportsPage.tsx` (~line 100-101)

**Fix:** Replace hardcoded "Last 30 Days" with a dynamic string based on the actual date range selected.

---

## Task 27: Fix webhook secret pre-population on edit (#87)

**File:** `web/src/pages/WebhookConfigsPage.tsx` (~line 45)

**Fix:** When editing a webhook, the masked secret `••••••••` is loaded into the form field, which could overwrite the real secret on save. Add a flag to detect masked values and exclude the secret from the PATCH payload when it hasn't changed.

---

## Verification

After all tasks complete, run: `cd web && bunx tsc --noEmit`

Print DONE_WORKING_PHASE9B when finished.
