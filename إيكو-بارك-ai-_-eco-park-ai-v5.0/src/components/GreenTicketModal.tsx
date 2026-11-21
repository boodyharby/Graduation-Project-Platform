import React from 'react';
import { BatteryCharging, Crown, Download, Printer, Volume2, Wind, X } from 'lucide-react';
import { Language, Reservation } from '../types/parking';
import { t } from '../data/i18n';
import {
  VEHICLE_SPECS,
  buildQrMatrix,
  playHydraulicGateSound,
  speakGuidance,
} from '../utils/ecoEngine';

interface GreenTicketModalProps {
  lang: Language;
  ticket: Reservation | null;
  onClose: () => void;
  onSummonChargingRobot?: (spotId: string, plate: string) => void;
}

export const GreenTicketModal: React.FC<GreenTicketModalProps> = ({
  lang,
  ticket,
  onClose,
  onSummonChargingRobot,
}) => {
  if (!ticket) return null;

  const matrix = buildQrMatrix(ticket.ticketCode);
  const spec = VEHICLE_SPECS[ticket.vehicleType];
  const isVip = ticket.ticketCode.startsWith('VIP-');

  const handleVoiceCheck = () => {
    playHydraulicGateSound();
    speakGuidance(
      lang === 'ar'
        ? isVip
          ? `مرحباً بك في مسار VIP التنفيذي. تم تأكيد التذكرة الذهبية ${ticket.ticketCode} للموقف المميز ${ticket.spotLabel}.`
          : `تم التحقق من التذكرة الخضراء ${ticket.ticketCode}. مستوى عادم الغاز ${ticket.exhaustPpm} جزء في المليون. تفضل بالدخول إلى الموقف ${ticket.spotLabel}.`
        : isVip
          ? `Welcome to Executive VIP Lane. Gold Pass ${ticket.ticketCode} confirmed for priority bay ${ticket.spotLabel}.`
          : `Green Pass ${ticket.ticketCode} verified. Exhaust level ${ticket.exhaustPpm} ppm. Proceed to bay ${ticket.spotLabel}.`,
      lang
    );
  };

  const handleDownloadReceipt = () => {
    const content = [
      '=== ECO-PARK AI v5.0 MASTER EDITION ===',
      `Pass Tier: ${isVip ? 'VIP EXECUTIVE GOLD PASS' : 'SMART GREEN PASS'}`,
      `Ticket Code: ${ticket.ticketCode}`,
      `Branch: ${ticket.branch}`,
      `Driver: ${ticket.driverName}`,
      `Plate Number: ${ticket.plateNumber}`,
      `Vehicle Category: ${ticket.vehicleType}`,
      `Assigned Bay: ${ticket.spotLabel}`,
      `Exhaust Sensor Check: ${ticket.exhaustPpm} ppm`,
      `Parking Fee: ${ticket.feeSar} SAR`,
      `Carbon Tax: ${ticket.carbonTaxSar} SAR`,
      `Carbon Points Earned: +${ticket.pointsEarned}`,
      `Estimated CO2 Saved: ${ticket.co2SavedKg} kg`,
      `Entry: ${ticket.entryTime}`,
      `Exit: ${ticket.exitTime}`,
      '======================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticket.ticketCode}-receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className={`w-full max-w-md rounded-2xl border bg-[#0B1927] p-6 shadow-2xl ${
          isVip ? 'border-amber-400/60' : 'border-white/15'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isVip && <Crown className="h-5 w-5 text-amber-400" />}
            <h3 className={`text-xl font-bold ${isVip ? 'text-amber-300' : 'text-emerald-400'}`}>
              {isVip
                ? t(lang, 'التذكرة الخضراء VIP الذهبية', 'VIP Executive Green Pass')
                : t(lang, 'التذكرة الخضراء الذكية', 'Smart Green QR Pass')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Card */}
        <div
          className={`mt-4 flex flex-col items-center rounded-xl border p-5 ${
            isVip
              ? 'eco-amber-flash border-amber-400/50 bg-gradient-to-b from-[#1B1F24] to-[#0F2235]'
              : 'eco-flash-glow border-emerald-400/40 bg-[#0F2235]'
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-xl font-bold text-amber-400">
            <span>{ticket.ticketCode}</span>
            <span
              className={`text-[10px] font-semibold uppercase ${
                isVip ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              · {isVip ? t(lang, 'أولوية VIP', 'VIP PRIORITY') : t(lang, 'تصريح نشط', 'LIVE PASS')}
            </span>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-xl bg-white p-3 shadow-lg">
            <div
              aria-hidden="true"
              className={`eco-qr-laser pointer-events-none absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent to-transparent ${
                isVip
                  ? 'via-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.75)]'
                  : 'via-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.75)]'
              }`}
            />
            <svg width="144" height="144" viewBox="0 0 90 90" aria-label={ticket.ticketCode}>
              {matrix.map((row, rIdx) =>
                row.map((cell, cIdx) =>
                  cell === 1 ? (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={cIdx * 10}
                      y={rIdx * 10}
                      width="9.5"
                      height="9.5"
                      fill="#0B1927"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <Wind className="h-4 w-4 text-cyan-400" />
            <span>
              {t(lang, 'فحص حساس عادم الغاز:', 'Exhaust Gas Sensor:')}
            </span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              {ticket.exhaustPpm} ppm
            </span>
          </div>
        </div>

        {/* Details Card */}
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-[#0F2235] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'اسم السائق:', 'Driver:')}</span>
            <span className="font-semibold text-white">{ticket.driverName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'رقم اللوحة:', 'Plate:')}</span>
            <span className="font-mono font-semibold text-white">{ticket.plateNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'نوع المركبة:', 'Vehicle Type:')}</span>
            <span className="font-semibold" style={{ color: spec.badgeColor }}>
              {lang === 'ar' ? spec.labelAr : spec.labelEn}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'الموقف المخصص:', 'Assigned Bay:')}</span>
            <span className="font-mono font-bold text-cyan-400">{ticket.spotLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'الرسوم:', 'Tariff Fee:')}</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {ticket.feeSar + ticket.carbonTaxSar} {t(lang, 'ريال', 'SAR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t(lang, 'نقاط الكربون:', 'Carbon Points:')}</span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              +{ticket.pointsEarned}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {onSummonChargingRobot &&
            (ticket.vehicleType === 'ELECTRIC' || ticket.vehicleType === 'HYBRID' || isVip) && (
              <button
                type="button"
                onClick={() => {
                  onSummonChargingRobot(ticket.spotId, ticket.plateNumber);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-3 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
              >
                <BatteryCharging className="h-4 w-4 text-cyan-400" />
                {t(lang, 'استدعاء روبوت الشحن المتنقل لهذا الموقف', 'Summon Mobile Charging Robot to Bay')}
              </button>
            )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleVoiceCheck}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25"
            >
              <Volume2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(lang, 'صوت', 'Voice')}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#0F2235] px-2.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(lang, 'طباعة', 'Print')}</span>
            </button>
            <button
              onClick={handleDownloadReceipt}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2.5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(lang, 'إيصال', 'Save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
