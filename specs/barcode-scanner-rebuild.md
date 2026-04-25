# BarcodeScanner Component — Rebuild

## Context
The Products page at `web/src/pages/ProductsPage.tsx` has a barcode search input with the text "Scan or type barcode...". It needs a companion "Scan barcode with camera" button that opens a modal with a live camera view using the device camera to scan barcodes.

## Requirements

### 1. Install dependency
```
cd web && bun add @zxing/browser @zxing/library
```

### 2. Create `web/src/components/BarcodeScanner.tsx`

A modal component that:
- Opens with a video stream from the device camera (back camera preferred, fallback to any camera)
- Uses `@zxing/browser`'s `BrowserMultiFormatReader` to continuously scan barcodes from the video feed
- On successful scan, calls `onScan(barcode: string)` callback and closes
- Has a cancel/close button to dismiss without scanning
- Shows error states for: permission denied, no camera found, generic errors
- Handles cleanup properly: stops video stream and reader on unmount/close
- Responsive design following existing project patterns (Tailwind classes, same modal style as other modals in the app)
- All parameters properly typed (no implicit `any`)

Props interface:
```ts
interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}
```

### 3. Update `web/src/pages/ProductsPage.tsx`

- Import `BarcodeScanner` component and `Camera` icon from lucide-react (or reuse `ScanBarcode` if more fitting)
- Add state: `const [scannerOpen, setScannerOpen] = useState(false);`
- Add a "Scan barcode with camera" button next to the barcode input field (inside the `<div className="flex items-center gap-3">` that wraps the barcode search)
- Button style: same style pattern as other action buttons in the app — `inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition`
- When a barcode is scanned, close the scanner and set the barcode filter: `setBarcodeInput(code); handleBarcodeSearch(code);`
- Render `<BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleCameraScan} />`

### Constraints
- Use `@zxing/browser` — this is the standard barcode scanning library for web
- No implicit `any` types — all parameters must be typed
- Follow existing Tailwind style conventions in the project
- The modal should be centered overlay with dark backdrop, matching existing modal patterns (check other modals in the project for reference)
- Important: the app runs behind Cloudflare Tunnel with HTTPS, so camera access will work

## Verification
- Run `cd web && bun run build` to verify no TypeScript errors
- Then `cd .. && docker compose build web server` to verify Docker build
