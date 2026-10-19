import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, X, Loader2, AlertTriangle, Keyboard } from 'lucide-react';

/**
 * Quét mã QR bằng camera của thiết bị.
 *
 * Dùng BarcodeDetector có sẵn trong Chrome/Edge (kể cả Chrome Android) nên không
 * cần thêm thư viện. Trình duyệt không hỗ trợ (Safari, Firefox) thì báo rõ và
 * cho dán link thủ công thay vì im lặng không làm gì.
 */

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof w.BarcodeDetector === 'function' ? w.BarcodeDetector : null;
}

/** Rút đường dẫn nội bộ từ nội dung QR (chấp nhận cả URL đầy đủ lẫn hash route). */
export function routeFromScannedText(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  // QR chứa link đầy đủ: https://host/#/nop-ca-nhan?task=12
  const hashIndex = raw.indexOf('#/');
  if (hashIndex >= 0) {
    const rest = raw.slice(hashIndex + 1); // giữ "/nop-ca-nhan?..."
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  // QR chỉ chứa đường dẫn: /nop-ca-nhan?task=12
  if (raw.startsWith('/')) return raw;
  return null;
}

export const QrScanModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error' | 'unsupported'>('starting');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleText = (text: string) => {
    const route = routeFromScannedText(text);
    if (!route) {
      setError('Mã QR này không phải link nộp minh chứng của hệ thống.');
      setStatus('error');
      return;
    }
    stopCamera();
    onClose();
    navigate(route);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const Ctor = getDetectorCtor();
      if (!Ctor) {
        setStatus('unsupported');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus('scanning');

        const detector = new Ctor({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                handleText(codes[0].rawValue);
                return;
              }
            } catch {
              // Bỏ qua khung hình lỗi, thử khung tiếp theo
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Bạn đã từ chối quyền camera. Hãy bật lại trong cài đặt trình duyệt.'
            : 'Không mở được camera trên thiết bị này.'
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
    /* eslint-disable-next-line */
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#1F5FBF]" /> Quét QR nhiệm vụ
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {(status === 'starting' || status === 'scanning') && (
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-square">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-8 border-2 border-white/70 rounded-xl pointer-events-none" />
            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            {status === 'scanning' && (
              <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-white/90">
                Đưa mã QR vào giữa khung
              </p>
            )}
          </div>
        )}

        {status === 'unsupported' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Trình duyệt chưa hỗ trợ quét QR</p>
            <p>Trình duyệt này không có BarcodeDetector. Hãy dùng Chrome/Edge, hoặc dán link bên dưới.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Dán link thủ công: luôn có, phòng khi camera/QR không dùng được */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5" /> Hoặc dán link nộp nhiệm vụ:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder=".../#/nop-ca-nhan?task=12"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
            />
            <button
              type="button"
              disabled={!manual.trim()}
              onClick={() => handleText(manual)}
              className="px-3 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg disabled:opacity-50"
            >
              Mở
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
