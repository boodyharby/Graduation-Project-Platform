import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  QrCode,
  ScanLine,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import { Language, Reservation } from '../types/parking';
import { t } from '../data/i18n';

interface QuickScanCheckInModalProps {
  lang: Language;
  isOpen: boolean;
  reservations: Reservation[];
  onClose: () => void;
  onCheckInReservation: (reservation: Reservation) => Promise<void> | void;
}

export const QuickScanCheckInModal: React.FC<QuickScanCheckInModalProps> = ({
  lang,
  isOpen,
  reservations,
  onClose,
  onCheckInReservation,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [matchedReservation, setMatchedReservation] = useState<Reservation | null>(null);
  const [rawDecodedText, setRawDecodedText] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const matchAndCheckIn = useCallback(
    async (decodedPayload: string) => {
      const cleaned = decodedPayload.trim();
      if (!cleaned) return false;
      setRawDecodedText(cleaned);

      // Parse possible JSON QR payload or plain ticket code / plate string
      let candidateToken = cleaned;
      try {
        const parsed = JSON.parse(cleaned) as { ticketCode?: string; plateNumber?: string; id?: string };
        candidateToken = parsed.ticketCode || parsed.id || parsed.plateNumber || cleaned;
      } catch {
        // plain string QR payload
      }

      const norm = candidateToken.toLowerCase();
      const match = reservations.find(
        (r) =>
          r.ticketCode.toLowerCase() === norm ||
          r.id.toLowerCase() === norm ||
          r.plateNumber.toLowerCase() === norm ||
          cleaned.toLowerCase().includes(r.ticketCode.toLowerCase())
      );

      if (!match) {
        setStatusFeedback(
          t(
            lang,
            `تمت قراءة الرمز (${candidateToken}) ولكن لم يُعثر على حجز مطابق في قاعدة البيانات.`,
            `Scanned QR "${candidateToken}", but no matching reservation was found in database.`
          )
        );
        return false;
      }

      setMatchedReservation(match);
      stopCamera();
      await onCheckInReservation(match);
      setStatusFeedback(
        t(
          lang,
          `تم تسجيل وصول التذكرة ${match.ticketCode} (${match.driverName}) وتحديث الحالة إلى Arrived في قاعدة البيانات!`,
          `Reservation ${match.ticketCode} (${match.driverName}) identified and flagged as 'arrived' in database!`
        )
      );
      return true;
    },
    [lang, onCheckInReservation, reservations, stopCamera]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStatusFeedback(null);
    setMatchedReservation(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          t(
            lang,
            'المتصفح أو السياق الحالي لا يدعم الوصول المباشر للكاميرا. يمكنك رفع صورة QR أو اختيار التذكرة أدناه.',
            'Camera API unavailable in this browser context. Upload a QR image or verify a ticket below.'
          )
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : t(
              lang,
              'تعذر فتح الكاميرا — يرجى السماح بصلاحية الكاميرا أو رفع صورة التذكرة QR.',
              'Unable to access camera — please grant camera permission or upload a QR ticket image.'
            )
      );
      setCameraActive(false);
    }
  }, [lang]);

  // Auto-open camera when Quick Scan modal opens, clean up on close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setMatchedReservation(null);
      setRawDecodedText(null);
      setStatusFeedback(null);
      setCameraError(null);
      return;
    }
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Continuous live frame QR decoding loop (jsQR + BarcodeDetector)
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    let stopped = false;
    let lastScanMs = 0;

    const scanFrame = async (now: number) => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && now - lastScanMs > 180) {
        lastScanMs = now;
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              const matched = await matchAndCheckIn(code.data);
              if (matched) return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    };

    rafRef.current = requestAnimationFrame(scanFrame);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraActive, isOpen, matchAndCheckIn]);

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          void matchAndCheckIn(decoded.data);
        } else {
          setStatusFeedback(
            t(
              lang,
              'لم يتم اكتشاف رمز QR واضح في الصورة المرفوعة. جرب صورة أوضح أو أدخل الرمز يدوياً.',
              'No readable QR code detected in image. Try a clearer photo or enter code manually.'
            )
          );
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  const activeReservations = reservations.filter((r) => r.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-400/40 bg-[#0B1927] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {t(lang, 'المسح السريع لتذكرة QR بالكاميرا (Quick Scan)', 'Quick Scan — Camera QR Check-In')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  lang,
                  'وجّه الكاميرا نحو رمز QR لتذكرة السائق لتسجيل الوصول (Arrived) فورياً في قاعدة البيانات.',
                  'Point camera at a driver ticket QR code to identify the booking and mark it arrived in Firestore.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Camera Viewfinder */}
        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#060E17] aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-44 w-44 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(6,14,23,0.45)]">
                <div className="eco-qr-scanline" />
              </div>
              <span className="absolute bottom-3 rounded-lg bg-[#08121D]/90 px-3 py-1 font-mono text-[11px] text-emerald-300">
                {t(lang, 'جاري البحث عن رمز QR...', 'Scanning video stream for QR...')}
              </span>
            </div>
          )}

          {!cameraActive && !matchedReservation && (
            <div className="p-6 text-center space-y-3">
              <Camera className="mx-auto h-9 w-9 text-cyan-400 opacity-85" />
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                {cameraError ||
                  t(
                    lang,
                    'اضغط لتشغيل الكاميرا أو ارفع صورة التذكرة QR.',
                    'Start camera stream or upload a QR ticket photo.'
                  )}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {t(lang, 'تشغيل الكاميرا', 'Open Camera')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t(lang, 'رفع صورة QR', 'Upload QR Image')}
                </button>
              </div>
            </div>
          )}

          {matchedReservation && (
            <div className="p-6 text-center space-y-2 bg-emerald-950/35 w-full h-full flex flex-col items-center justify-center">
              <CheckCircle2 className="h-11 w-11 text-emerald-400" />
              <div className="font-mono text-lg font-extrabold text-white">
                {matchedReservation.ticketCode} · {matchedReservation.spotLabel}
              </div>
              <div className="text-xs text-emerald-200">
                {matchedReservation.driverName} · {matchedReservation.plateNumber}
              </div>
              <div className="font-mono text-xs font-bold text-cyan-300 uppercase">
                STATUS: ARRIVED / CHECKED-IN ✓
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleUploadQrImage}
          className="hidden"
        />

        {/* Status or Decoded Banner */}
        {statusFeedback && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
              matchedReservation
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
            }`}
          >
            {matchedReservation ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <span>{statusFeedback}</span>
          </div>
        )}

        {/* Secondary Manual Ticket Verify / Active Reservations Quick Check-In */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) void matchAndCheckIn(manualCode.trim());
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t(lang, 'أو أدخل رمز التذكرة / اللوحة يدوياً (ECO-...)', 'Or enter ticket code / plate (ECO-...)')}
            className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
          >
            <ScanLine className="h-3.5 w-3.5" />
            {t(lang, 'تحقق وتسجيل وصول', 'Check-In Now')}
          </button>
          {cameraActive && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#08121D] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              <Upload className="h-3.5 w-3.5" />
              {t(lang, 'صورة', 'Photo')}
            </button>
          )}
        </form>

        {/* Active Reservations Pending Arrival for 1-click camera-free test or fast gate verify */}
        {activeReservations.length > 0 && !matchedReservation && (
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400">
              {t(
                lang,
                `تذاكر نشطة بانتظار الوصول (${activeReservations.length}):`,
                `Active Bookings Awaiting Arrival (${activeReservations.length}):`
              )}
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1.5">
              {activeReservations.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#08121D] px-3 py-1.5 text-xs"
                >
                  <div className="font-mono text-slate-200">
                    <span className="font-bold text-amber-400">{r.ticketCode}</span> · {r.plateNumber} ·{' '}
                    <span className="text-cyan-400">{r.spotLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void matchAndCheckIn(r.ticketCode)}
                    className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                  >
                    {t(lang, 'تأكيد الوصول', 'Mark Arrived')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rawDecodedText && (
          <div className="text-[11px] font-mono text-slate-500 truncate">
            {t(lang, 'آخر بيانات مقروءة:', 'Last Decoded Payload:')} {rawDecodedText}
          </div>
        )}
      </div>
    </div>
  );
};
