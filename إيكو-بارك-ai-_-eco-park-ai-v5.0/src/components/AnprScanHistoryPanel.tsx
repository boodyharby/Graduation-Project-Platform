import React, { useMemo, useState } from 'react';
import { Download, QrCode, ScanLine, Search, Trash2 } from 'lucide-react';
import { AnprScanRecord, Language, Reservation } from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS } from '../utils/ecoEngine';

interface AnprScanHistoryPanelProps {
  lang: Language;
  scans: AnprScanRecord[];
  reservations: Reservation[];
  onVerifyQrTicket: (ticketOrPlate: string) => void;
  onClearHistory: () => void;
}

export const AnprScanHistoryPanel: React.FC<AnprScanHistoryPanelProps> = ({
  lang,
  scans,
  reservations,
  onVerifyQrTicket,
  onClearHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'anpr_camera' | 'qr_pass' | 'manual_gate'>('all');
  const [qrCheckInput, setQrCheckInput] = useState('');

  const filteredScans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scans.filter((item) => {
      if (sourceFilter !== 'all' && item.scanSource !== sourceFilter) return false;
      const itemDate = (item.timestamp || '').slice(0, 10);
      if (fromDate && itemDate && itemDate < fromDate) return false;
      if (toDate && itemDate && itemDate > toDate) return false;
      if (!q) return true;
      return (
        item.plateNumber.toLowerCase().includes(q) ||
        item.assignedBayLabel.toLowerCase().includes(q) ||
        (item.ticketCode || '').toLowerCase().includes(q)
      );
    });
  }, [fromDate, scans, searchTerm, sourceFilter, toDate]);

  const counts = useMemo(() => {
    const total = scans.length;
    const camera = scans.filter((s) => s.scanSource === 'anpr_camera').length;
    const qr = scans.filter((s) => s.scanSource === 'qr_pass').length;
    return { total, camera, qr };
  }, [scans]);

  const handleQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCheckInput.trim()) return;
    onVerifyQrTicket(qrCheckInput.trim());
    setQrCheckInput('');
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Plate Number', 'Timestamp', 'Assigned Bay', 'Vehicle Type', 'Scan Source', 'Ticket Code', 'Confidence %'];
    const rows = filteredScans.map((s) => [
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
    a.download = 'ecopark-anpr-qr-scan-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeReservations = useMemo(
    () => reservations.filter((r) => r.status === 'active').slice(0, 4),
    [reservations]
  );

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <QrCode className="h-4 w-4 text-emerald-400" />
            <span>
              {t(
                lang,
                'السجل التاريخي لعمليات مسح ANPR ورموز QR عند البوابة',
                'Historical Log of ANPR & QR Gate Scans'
              )}
            </span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              {t(lang, 'إجمالي المسوحات:', 'Total Scans:')}{' '}
              <strong className="font-mono text-white tabular-nums">{counts.total}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t(lang, 'كاميرا ANPR:', 'ANPR Camera:')}{' '}
              <strong className="font-mono text-cyan-300 tabular-nums">{counts.camera}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t(lang, 'تذاكر QR الخضراء:', 'QR Passes:')}{' '}
              <strong className="font-mono text-emerald-300 tabular-nums">{counts.qr}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredScans.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-400/50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            {t(lang, `تصدير CSV (${filteredScans.length})`, `Export CSV (${filteredScans.length})`)}
          </button>
          {scans.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t(lang, 'مسح السجل', 'Clear Log')}
            </button>
          )}
        </div>
      </div>

      {/* Quick QR Pass Gate Verification Bar */}
      <form
        onSubmit={handleQrSubmit}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-white/10 bg-[#08121D] p-3"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ScanLine className="h-4 w-4 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={qrCheckInput}
            onChange={(e) => setQrCheckInput(e.target.value)}
            placeholder={t(
              lang,
              'امسح أو أدخل رمز تذكرة QR (مثل ECO-1024 أو VIP-4012) أو رقم اللوحة لتسجيل العبور...',
              'Scan/enter QR ticket code (e.g. ECO-1024 / VIP-4012) or plate to log gate scan...'
            )}
            className="w-full bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 shrink-0"
        >
          {t(lang, 'تحقق وتسجيل QR', 'Verify & Log QR Scan')}
        </button>
      </form>

      {activeReservations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{t(lang, 'مسح سريع لتذكرة نشطة:', 'Quick-scan active pass:')}</span>
          {activeReservations.map((res) => (
            <button
              key={res.id}
              type="button"
              onClick={() => onVerifyQrTicket(res.ticketCode)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              {res.ticketCode} ({res.spotLabel})
            </button>
          ))}
        </div>
      )}

      {/* Search, Date Range & Source Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t(lang, 'ابحث برقم اللوحة أو الموقف أو رمز التذكرة...', 'Search plate, bay, or ticket code...')}
              className="w-full rounded-lg border border-white/10 bg-[#08121D] py-2 ps-8 pe-3 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label={t(lang, 'من تاريخ', 'From Date')}
              className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
            />
            <span className="text-xs text-slate-500">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label={t(lang, 'إلى تاريخ', 'To Date')}
              className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
            />
            {(fromDate || toDate || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFromDate('');
                  setToDate('');
                }}
                className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                {t(lang, 'مسح الفلاتر', 'Clear')}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#08121D] p-1">
          {(
            [
              { id: 'all', ar: 'الكل', en: 'All' },
              { id: 'anpr_camera', ar: 'كاميرا ANPR', en: 'ANPR Camera' },
              { id: 'qr_pass', ar: 'مسح QR', en: 'QR Pass' },
              { id: 'manual_gate', ar: 'بوابة مباشرة', en: 'Gate Entry' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                sourceFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t(lang, tab.ar, tab.en)}
            </button>
          ))}
        </div>
      </div>

      {/* Historical Scans Table */}
      {filteredScans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#08121D]/70 py-10 text-center text-xs text-slate-400">
          {t(
            lang,
            'لا توجد سجلات مسح ANPR أو QR مطابقة حتى الآن. استخدم كاميرا ANPR بالأعلى أو أصدر/امسح تذكرة خضراء ليظهر السجل هنا تلقائياً.',
            'No ANPR or QR scan records yet. Scan a plate via ANPR above or verify a Green QR pass to populate this log.'
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="py-2.5 pe-4 text-start font-semibold">{t(lang, 'رقم اللوحة', 'Plate Number')}</th>
                <th className="py-2.5 pe-4 text-start font-semibold">{t(lang, 'الوقت والتاريخ', 'Timestamp')}</th>
                <th className="py-2.5 pe-4 text-start font-semibold">{t(lang, 'الموقف المخصص', 'Assigned Bay')}</th>
                <th className="py-2.5 pe-4 text-start font-semibold">{t(lang, 'نوع المركبة والمصدر', 'Vehicle & Source')}</th>
                <th className="py-2.5 text-start font-semibold">{t(lang, 'الدقة', 'Confidence')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredScans.map((scan) => {
                const vehicleSpec = VEHICLE_SPECS[scan.vehicleType];
                const sourceText =
                  scan.scanSource === 'anpr_camera'
                    ? t(lang, 'كاميرا ANPR AI', 'ANPR Vision AI')
                    : scan.scanSource === 'qr_pass'
                      ? t(lang, 'تذكرة QR الخضراء', 'Green QR Pass')
                      : t(lang, 'تسجيل بوابة مباشر', 'Direct Gate Entry');
                return (
                  <tr key={scan.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 pe-4 font-mono font-bold text-white whitespace-nowrap">
                      {scan.plateNumber}
                      {scan.ticketCode && (
                        <span className="ms-2 font-mono text-[11px] font-normal text-emerald-400">
                          {scan.ticketCode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pe-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {scan.timestamp}
                    </td>
                    <td className="py-3 pe-4 font-mono font-bold text-cyan-300 whitespace-nowrap">
                      {scan.assignedBayLabel}
                    </td>
                    <td className="py-3 pe-4 text-slate-300 whitespace-nowrap">
                      <span>{lang === 'ar' ? vehicleSpec.labelAr : vehicleSpec.labelEn}</span>
                      <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
                      <span className="text-slate-400">{sourceText}</span>
                    </td>
                    <td className="py-3 font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                      {scan.confidence}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
