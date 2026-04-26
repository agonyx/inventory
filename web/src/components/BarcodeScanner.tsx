import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    const startScanning = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (devices.length === 0) {
          setError('No camera found. Please connect a camera and try again.');
          return;
        }

        const backDevice = devices.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'),
        );
        const deviceId = backDevice?.deviceId || undefined;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current ?? undefined,
          (result, _error, controls) => {
            if (result) {
              const text = result.getText();
              if (text) {
                controls.stop();
                onScanRef.current(text);
              }
            }
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found. Please connect a camera and try again.');
          } else {
            setError(`Camera error: ${err.message}`);
          }
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred while accessing the camera.');
        }
      }
    };

    setError(null);
    startScanning();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex flex-col w-full h-full sm:h-auto sm:max-w-[640px] sm:rounded-2xl sm:shadow-2xl sm:max-h-[90vh] bg-black sm:bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 sm:bg-gray-900 text-white shrink-0">
          <h3 className="text-lg font-semibold">Scan Barcode</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 sm:aspect-[4/3]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="relative w-3/4 h-1/3"
                style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)' }}
              >
                <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-blue-400 rounded-tl-sm animate-corner-pulse-tl" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-blue-400 rounded-tr-sm animate-corner-pulse-tr" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-blue-400 rounded-br-sm animate-corner-pulse-br" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-blue-400 rounded-bl-sm animate-corner-pulse-bl" />
                {/* Scan line with gradient trail */}
                <div
                  className="absolute left-2 right-2 h-0.5 animate-scan-line"
                  style={{
                    background: 'linear-gradient(to bottom, transparent, rgba(96, 165, 250, 0.3), rgba(96, 165, 250, 0.9), rgba(96, 165, 250, 0.3), transparent)',
                    height: '24px',
                    boxShadow: '0 0 12px 4px rgba(96, 165, 250, 0.35)',
                  }}
                />
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6">
              <Camera size={32} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-300">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 text-center bg-black/80 sm:bg-gray-50 shrink-0">
          <p className="text-xs text-gray-400 sm:text-gray-500">Point your camera at a barcode to scan</p>
        </div>
      </div>
    </div>
  );
}
