# QA Bug Fix Spec — 6 Bugs

## Bug #14 🔴 CRITICAL — Sidebar nav links offset by 1
**Symptom:** Clicking "Returns" navigates to `/inventory`, "Inventory" navigates to `/returns`. Links from "Returns" downward go to the previous link's route.
**Root cause:** The sidebar navigation component likely has a mismatch between nav items array and route paths array. Check `web/src/components/` for Sidebar, Layout, or Navigation component. The `href` attributes in the DOM are correct (`/returns`, `/inventory`, etc.) but clicking navigates to the wrong route — this suggests the React Router routes or the sidebar's `to` prop mapping is misaligned.
**Fix:** Ensure the nav items array has paths correctly aligned with labels. Check both the sidebar links and the React Router route definitions.

## Bug #13 🟠 HIGH — Cancel button doesn't close Add Product modal
**Symptom:** Clicking "Cancel" in the New Product dialog does nothing. The X button (SVG icon) works fine.
**Root cause:** The Cancel button's onClick handler is either missing, not wired up, or calling a function that doesn't set `formOpen`/`isModalOpen` to false.
**Fix:** In `web/src/pages/ProductsPage.tsx` (or wherever the product form modal is), wire the Cancel button to close the modal. Check if there's a `handleClose` or `setFormOpen(false)` that should be called.

## Bug #11 🟡 MEDIUM — Low Stock Threshold field corrupted
**Symptom:** When filling the Add Product form via React state, the threshold field shows `19.989999771118164` (a corrupted version of the price `19.99`). This is a floating point precision issue AND possibly state bleeding.
**Root cause:** The threshold input likely has `type="number"` and receives a float value. JavaScript floating point: `19.99` becomes `19.989999771118164` when set via `HTMLInputElement.value` setter. This may also be a React state issue where the wrong state variable is bound.
**Fix:** Ensure the threshold field uses integer-only input (it should be a whole number). Check the form state handler — make sure `lowStockThreshold` state is separate from `price` state and doesn't get type-coerced. Round or parseInt the value.

## Bug #12 🟡 MEDIUM — Variant SKU field pre-populated with wrong value
**Symptom:** When opening Add Product form, the variant section's "SKU" field shows `10` (the value entered for low stock threshold). The variant rows are getting polluted by other form field values.
**Root cause:** The variants state array is likely being initialized or updated from the wrong source. Check how the `variants` array state is managed — it might be reading from the same input event handler that updates the threshold.
**Fix:** In the product form component, ensure each form field updates only its own state variable. The variants array should only be modified by the variant-specific inputs, not by threshold/price inputs.

## Bug #15 🟡 MEDIUM — Location type dropdown missing "Cold Storage"
**Symptom:** The Add/Edit Location form has options: Warehouse, Store, Supplier, Virtual, Other — but "Cold Storage" is missing. The DB has `cold_storage` type and the list page displays it correctly (humanized to "Cold Storage").
**Root cause:** The `formatLocationType()` helper or the type options array in the location form doesn't include `cold_storage`.
**Fix:** Add `cold_storage` → "Cold Storage" to the location type options in the form component (`web/src/pages/LocationsPage.tsx`). Also check if `formatLocationType()` in that file needs updating.

## Bug #16 🔵 LOW — Webhooks page missing header elements
**Symptom:** Webhooks page doesn't show user avatar, "Admin" label, or "Notifications" button — all other pages have these.
**Root cause:** The Webhooks page likely renders its own layout or doesn't use the shared layout component. Check `web/src/pages/WebhooksPage.tsx` — it may have a different structure than other pages.
**Fix:** Ensure the Webhooks page uses the same layout wrapper as other pages. Check if it's rendering its own header/breadcrumb that overrides the shared layout.
