import { useEffect, useRef, useState } from 'react';
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
                onScan(text);
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
  }, [open, onScan]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Scan Barcode</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/3 border-2 border-white/60 rounded-lg" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-center p-6">
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

        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500">Point your camera at a barcode to scan</p>
        </div>
      </div>
    </div>
  );
}
