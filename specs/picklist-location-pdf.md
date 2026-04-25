# Pick List PDF — Per-Location Download

## Problem
The Pick List page has a single global "Download PDF" button that downloads ALL items across ALL locations. In a real warehouse, a picker works at one location and needs a pick sheet for only that zone.

## Solution
Move the PDF download to per-location buttons. Each location section gets its own "Download PDF" button. Optionally keep a secondary "Download All" button.

## Files to Change

### 1. `server/src/routes/pickList.ts`
- Add a `?location=<locationName>` query parameter to the `GET /pdf` endpoint
- When `location` is provided, filter the `generatePickList()` results to only include items matching that location
- Update the PDF header subtitle to include the location name when filtered
- The existing all-locations grouping logic stays as-is for the "Download All" case

### 2. `web/src/pages/PickListPage.tsx`
- Remove the global "Download PDF" button from the page header area
- (The button now lives in PickListTable per-location)

### 3. `web/src/components/PickListTable.tsx`
- Import `Download` from lucide-react and `openAuthenticatedUrl` from `../api/client`
- Add a "Download PDF" button inside each location header (next to the chevron, location name, and item count)
- The button should call `openAuthenticatedUrl('/pick-list/pdf?location=' + encodeURIComponent(loc), { download: true })`
- Style it to look like a small secondary action button (same style as the Refresh button — `text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition`)
- Add a `stopPropagation()` on the download button click so it doesn't toggle the accordion collapse
- Keep the existing Refresh button where it is

## Constraints
- Use existing `openAuthenticatedUrl` helper from `../api/client` (same pattern as other pages)
- Don't add new dependencies
- Keep the existing `?download=true` query param behavior
- The location header currently has: chevron, MapPin icon, location name, (type), item count (ml-auto). The Download button should go between the type badge and the item count (before ml-auto pushes the count to the right), or after the item count
- Follow existing code patterns and style conventions in the project
