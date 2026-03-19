import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "barcode-scanner-container",
      { fps: 10, qrbox: { width: 250, height: 100 }, supportedScanTypes: [0, 1] },
      false
    );

    scanner.render(
      (result) => {
        scanner.clear();
        onScan(result);
      },
      () => {} // ignore errors
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="font-semibold text-slate-900">Scan Barcode</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4">
          <div id="barcode-scanner-container" />
          <p className="text-xs text-slate-500 text-center mt-2">Point camera at tracking barcode</p>
        </div>
      </div>
    </div>
  );
}