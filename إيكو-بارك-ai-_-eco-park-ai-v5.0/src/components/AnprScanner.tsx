import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Camera, CheckCircle2, CloudUpload, Download, Filter, ScanLine, Upload, Wifi, WifiOff } from 'lucide-react';
import { AnprScanRecord, Language, OfflineGateQueueItem, VehicleType } from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS } from '../utils/ecoEngine';

interface AnprResult {
  plateNumber: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  color: string;
  confidence: number;
  scanSource?: 'anpr_camera' | 'manual_gate';
}

interface AnprScannerProps {
  lang: Language;
  scans?: AnprScanRecord[];
  onDetectedAndAssign: (result: AnprResult) => void;
  onExportComplete?: (count: number) => void;
}

export const AnprScanner: React.FC<AnprScannerProps> = ({
  lang,
  scans = [],
  onDetectedAndAssign,
  onExportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<AnprResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [manualPlate, setManualPlate] = useState('');
  const [manualType, setManualType] = useState<VehicleType>('ELECTRIC');

  // Offline Gate Kiosk Queue & Auto-Sync
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineGateQueueItem[]>(() => {
    try {
      const saved = window.localStorage.getItem('ecopark_offline_gate_queue');
      return saved ? (JSON.parse(saved) as OfflineGateQueueItem[]) : [];
    } catch {
      return [];
    }
  });
  const isGateOffline = !browserOnline || simulateOffline;

  useEffect(() => {
    try {
      window.localStorage.setItem('ecopark_offline_gate_queue', JSON.stringify(offlineQueue));
    } catch {
      // ignore quota errors
    }
  }, [offlineQueue]);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    const onWipe = () => {
      setOfflineQueue([]);
      setLastResult(null);
      setErrorMsg(null);
      try {
        window.localStorage.removeItem('ecopark_offline_gate_queue');
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('ecopark-data-wiped', onWipe);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('ecopark-data-wiped', onWipe);
    };
  }, []);

  const syncOfflineQueue = () => {
    if (offlineQueue.length === 0) return;
    const pending = [...offlineQueue];
    setOfflineQueue([]);
    pending.forEach((item) => {
      onDetectedAndAssign({
        plateNumber: item.plateNumber,
        vehicleType: item.vehicleType,
        vehicleModel: item.vehicleModel,
        color: `${item.color} (Offline Sync)`,
        confidence: item.confidence,
        scanSource: item.scanSource === 'qr_pass' ? 'manual_gate' : item.scanSource,
      });
    });
  };

  useEffect(() => {
    if (!isGateOffline && offlineQueue.length > 0) {
      syncOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGateOffline]);

  const dispatchOrQueueGate = (result: AnprResult) => {
    setLastResult(result);
    if (isGateOffline) {
      const queued: OfflineGateQueueItem = {
        id: `q-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        plateNumber: result.plateNumber,
        vehicleType: result.vehicleType,
        vehicleModel: result.vehicleModel,
        color: result.color,
        confidence: result.confidence,
        scanSource: result.scanSource || 'manual_gate',
        queuedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setOfflineQueue((prev) => [...prev, queued]);
      return;
    }
    onDetectedAndAssign(result);
  };

  // Built-in ANPR/QR CSV Export & Filter State inside ANPR Scanner section
  const [showExportPanel, setShowExportPanel] = useState(true);
  const [exportPlateFilter, setExportPlateFilter] = useState('');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  const filteredExportScans = useMemo(() => {
    const q = exportPlateFilter.trim().toLowerCase();
    return scans.filter((item) => {
      if (q && !item.plateNumber.toLowerCase().includes(q) && !(item.ticketCode || '').toLowerCase().includes(q)) {
        return false;
      }
      const itemDate = (item.timestamp || '').slice(0, 10);
      if (exportFromDate && itemDate && itemDate < exportFromDate) return false;
      if (exportToDate && itemDate && itemDate > exportToDate) return false;
      return true;
    });
  }, [exportFromDate, exportPlateFilter, exportToDate, scans]);

  const handleExportScannerCsv = () => {
    const headers = [
      'ID',
      'Plate Number',
      'Timestamp',
      'Assigned Bay',
      'Vehicle Type',
      'Scan Source',
      'Ticket Code',
      'Confidence %',
    ];
    const rows = filteredExportScans.map((s) => [
      s.id,
      s.plateNumber,
      s.timestamp,
      s.assignedBayLabel,
      s.vehicleType,
      s.scanSource,
      s.ticketCode || '-',
      String(s.confidence),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = exportPlateFilter.trim()
      ? `-${exportPlateFilter.trim().replace(/\s+/g, '_')}`
      : exportFromDate || exportToDate
        ? `-${exportFromDate || 'start'}_to_${exportToDate || 'now'}`
        : '';
    a.download = `anpr-qr-scan-logs${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onExportComplete?.(filteredExportScans.length);
  };

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPlate.trim()) return;
    setErrorMsg(null);
    const result: AnprResult = {
      plateNumber: manualPlate.trim(),
      vehicleType: manualType,
      vehicleModel: lang === 'ar' ? VEHICLE_SPECS[manualType].labelAr : VEHICLE_SPECS[manualType].labelEn,
      color: lang === 'ar' ? 'تسجيل بوابة مباشر' : 'Direct Gate Entry',
      confidence: 100,
      scanSource: 'manual_gate',
    };
    setManualPlate('');
    dispatchOrQueueGate(result);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setScanning(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/anpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ANPR analysis failed');

      const enriched: AnprResult = { ...data, scanSource: 'anpr_camera' };
      dispatchOrQueueGate(enriched);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t(lang, 'تعذر تحليل صورة اللوحة.', 'Unable to analyze plate image.')
      );
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {t(lang, 'كاميرا التعرف التلقائي على اللوحات (ANPR Vision AI)', 'ANPR Vision AI Camera')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                lang,
                'ارفع صورة المركبة للتحليل الفوري عبر Vision AI أو أدخل رقم اللوحة مباشرة.',
                'Upload a vehicle image for real-time plate analysis or enter a plate manually.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulateOffline((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              isGateOffline
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {isGateOffline ? <WifiOff className="h-3.5 w-3.5 text-amber-400" /> : <Wifi className="h-3.5 w-3.5 text-emerald-400" />}
            {isGateOffline
              ? t(lang, 'وضع البوابة: غير متصل', 'Gate: Offline Queue')
              : t(lang, 'وضع البوابة: متصل', 'Gate: Online')}
          </button>

          <button
            type="button"
            onClick={() => setShowExportPanel((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              showExportPanel
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {t(lang, 'تصدير السجل CSV', 'CSV Export Filter')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {scanning
              ? t(lang, 'جاري المسح بالذكاء الاصطناعي...', 'Scanning with AI...')
              : t(lang, 'رفع صورة مركبة للتحليل', 'Upload Vehicle Image')}
          </button>
        </div>
      </div>

      {/* Direct Plate Entry Form */}
      <form onSubmit={handleManualCheckIn} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          type="text"
          value={manualPlate}
          onChange={(e) => setManualPlate(e.target.value)}
          placeholder={t(lang, 'أدخل رقم اللوحة...', 'Enter plate number...')}
          className="sm:col-span-2 rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
          required
        />
        <select
          value={manualType}
          onChange={(e) => setManualType(e.target.value as VehicleType)}
          className="rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
        >
          {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
            <option key={vt} value={vt}>
              {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
        >
          <ScanLine className="h-4 w-4" />
          {t(lang, 'تسجيل دخول وتوجيه', 'Check In & Route')}
        </button>
      </form>

      {/* Quick One-Click Gate Simulation Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">
          {t(lang, 'تجربة فورية للبوابة:', 'Quick Gate Test:')}
        </span>
        {(
          [
            { plate: 'أ ب ج 9010', vt: 'ELECTRIC' as VehicleType, labelAr: 'كهربائية · أ ب ج 9010', labelEn: 'EV · ABC 9010' },
            { plate: 'هـ و ي 4421', vt: 'HYBRID' as VehicleType, labelAr: 'هجينة · هـ و ي 4421', labelEn: 'Hybrid · HWY 4421' },
            { plate: 'ط م س 7702', vt: 'DIESEL' as VehicleType, labelAr: 'ديزل · ط م س 7702', labelEn: 'Diesel · TMS 7702' },
          ]
        ).map((preset) => (
          <button
            key={preset.plate}
            type="button"
            onClick={() => {
              const res: AnprResult = {
                plateNumber: preset.plate,
                vehicleType: preset.vt,
                vehicleModel: lang === 'ar' ? VEHICLE_SPECS[preset.vt].labelAr : VEHICLE_SPECS[preset.vt].labelEn,
                color: lang === 'ar' ? 'مسح بوابة ANPR' : 'ANPR Gate Scan',
                confidence: 99,
                scanSource: 'anpr_camera',
              };
              dispatchOrQueueGate(res);
            }}
            className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            {lang === 'ar' ? preset.labelAr : preset.labelEn}
          </button>
        ))}
      </div>

      {/* Offline Queue Banner & Instant Sync Controls */}
      {(isGateOffline || offlineQueue.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold">
                {t(
                  lang,
                  `طابور البوابة بدون اتصال: ${offlineQueue.length} عملية محفوظة محلياً`,
                  `Offline Gate Kiosk Buffer: ${offlineQueue.length} entry(s) queued locally`
                )}
              </div>
              <div className="text-[11px] text-amber-200/80">
                {t(
                  lang,
                  'ستتم المزامنة والتسكين التلقائي في قاعدة البيانات فور عودة الاتصال بالشبكة.',
                  'Queued gate check-ins will sync automatically to live bays and Firestore once connectivity returns.'
                )}
              </div>
            </div>
          </div>

          {offlineQueue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSimulateOffline(false);
                syncOfflineQueue();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 font-extrabold text-slate-950 hover:bg-amber-300"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {t(lang, `مزامنة الآن (${offlineQueue.length})`, `Sync Queue Now (${offlineQueue.length})`)}
            </button>
          )}
        </div>
      )}

      {/* Filtered ANPR & QR CSV Export Bar */}
      {showExportPanel && (
        <div className="rounded-xl border border-white/10 bg-[#08121D] p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              {t(
                lang,
                'تصفية وتصدير سجل مسوحات ANPR / QR كملف CSV',
                'Filter & Export ANPR / QR Scan History (CSV)'
              )}
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {t(lang, 'السجلات المطابقة:', 'Matching Records:')}{' '}
              <strong className="text-emerald-400">{filteredExportScans.length}</strong> / {scans.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t(lang, 'تصفية برقم اللوحة / التذكرة', 'Filter by Plate / Ticket')}
              </label>
              <input
                type="text"
                value={exportPlateFilter}
                onChange={(e) => setExportPlateFilter(e.target.value)}
                placeholder={t(lang, 'مثال: أ ب ج أو ECO...', 'e.g. ABC or ECO...')}
                className="w-full rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t(lang, 'من تاريخ', 'From Date')}
              </label>
              <input
                type="date"
                value={exportFromDate}
                onChange={(e) => setExportFromDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t(lang, 'إلى تاريخ', 'To Date')}
              </label>
              <input
                type="date"
                value={exportToDate}
                onChange={(e) => setExportToDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setExportFromDate(today);
                  setExportToDate(today);
                }}
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-cyan-400/50 hover:text-white"
              >
                {t(lang, 'اليوم', 'Today')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportPlateFilter('');
                  setExportFromDate('');
                  setExportToDate('');
                }}
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                {t(lang, 'إعادة ضبط', 'Reset')}
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportScannerCsv}
              disabled={filteredExportScans.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              {t(lang, `تصدير CSV (${filteredExportScans.length})`, `Export CSV (${filteredExportScans.length})`)}
            </button>
          </div>
        </div>
      )}

      {scanning && (
        <div className="relative h-20 overflow-hidden rounded-xl border border-cyan-400/50 bg-[#08121D] flex items-center justify-center">
          <div
            aria-hidden="true"
            className="eco-qr-laser pointer-events-none absolute inset-x-4 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_2px_rgba(34,211,238,0.85)]"
          />
          <span className="font-mono text-xs font-bold text-cyan-300">
            {t(lang, 'جاري تحليل اللوحة وبصمة المركبة عبر الذكاء الاصطناعي...', 'Analyzing license plate & vehicle signature...')}
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {lastResult && (
        <div className="eco-flash-glow flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/45 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">
                {t(lang, 'تم التعرف وتصنيف المركبة:', 'Detected & Classified:')} {lastResult.plateNumber}
              </div>
              <div className="mt-0.5 text-xs text-slate-300">
                {lastResult.vehicleModel} · {lastResult.color} · {t(lang, 'دقة الرصد:', 'Confidence:')} {lastResult.confidence}%
              </div>
            </div>
          </div>
          <div className="font-mono text-xs font-bold text-emerald-300">
            {lang === 'ar'
              ? VEHICLE_SPECS[lastResult.vehicleType].labelAr
              : VEHICLE_SPECS[lastResult.vehicleType].labelEn}{' '}
            · {VEHICLE_SPECS[lastResult.vehicleType].exhaustPpm} ppm
          </div>
        </div>
      )}
    </div>
  );
};
