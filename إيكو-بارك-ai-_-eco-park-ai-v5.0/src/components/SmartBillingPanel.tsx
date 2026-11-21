import React, { useMemo, useState } from 'react';
import {
  BatteryCharging,
  Crown,
  Download,
  Receipt,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Language, ParkingSpot, Reservation, VehicleType } from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS } from '../utils/ecoEngine';

interface SmartBillingPanelProps {
  lang: Language;
  spots: ParkingSpot[];
  reservations: Reservation[];
  bessCharge?: number;
  solarKw?: number;
  onDispatchPeakShave?: (bessDropPct: number, kwhShaved: number, sarSaved: number) => void;
  onNotify: (msg: string) => void;
}

export const SmartBillingPanel: React.FC<SmartBillingPanelProps> = ({
  lang,
  spots,
  reservations,
  bessCharge = 82,
  solarKw = 180,
  onDispatchPeakShave,
  onNotify,
}) => {
  const liveOccupancyPct = useMemo(() => {
    const busy = spots.filter((s) => s.status !== 'available').length;
    return Math.round((busy / Math.max(1, spots.length)) * 100);
  }, [spots]);

  const [simulatedOccupancy, setSimulatedOccupancy] = useState<number>(liveOccupancyPct);
  const [peakHoursActive, setPeakHoursActive] = useState<boolean>(false);
  const [autoPeakShave, setAutoPeakShave] = useState<boolean>(true);
  const [peakShaveReservePct, setPeakShaveReservePct] = useState<number>(45);

  const peakShaveEligible = bessCharge > peakShaveReservePct;

  const surgeMultiplier = useMemo(() => {
    const base = simulatedOccupancy >= 80 ? 1.35 : simulatedOccupancy >= 55 ? 1.15 : 1.0;
    const bessTariffDelta = peakHoursActive && (!autoPeakShave || !peakShaveEligible) ? 0.12 : 0;
    return Number((base + (peakHoursActive ? 0.15 : 0) + bessTariffDelta).toFixed(2));
  }, [autoPeakShave, bessCharge, peakHoursActive, peakShaveEligible, simulatedOccupancy]);

  const peakShaveStats = useMemo(() => {
    const activeEvLoads = spots.filter((s) => s.status === 'occupied' && s.hasCharger).length * 22;
    const utilityPeakRate = peakHoursActive ? 0.48 : 0.28;
    const solarOffPeakRate = 0.14;
    const shavedKw = autoPeakShave && peakShaveEligible ? Math.min(110, Math.round(activeEvLoads * 0.55 + solarKw * 0.22)) : 0;
    const hourlySavingsSar = Number(((shavedKw * (utilityPeakRate - solarOffPeakRate))).toFixed(1));
    return { utilityPeakRate, solarOffPeakRate, shavedKw, hourlySavingsSar };
  }, [autoPeakShave, peakHoursActive, peakShaveEligible, solarKw, spots]);

  const totals = useMemo(() => {
    const parkingTotal = reservations.reduce((acc, r) => acc + r.feeSar, 0);
    const carbonTaxTotal = reservations.reduce((acc, r) => acc + r.carbonTaxSar, 0);
    const vipCount = reservations.filter((r) => r.ticketCode.startsWith('VIP-')).length;
    return {
      parkingTotal,
      carbonTaxTotal,
      grandTotal: parkingTotal + carbonTaxTotal,
      vipCount,
    };
  }, [reservations]);

  const downloadInvoice = (res: Reservation) => {
    const isVip = res.ticketCode.startsWith('VIP-');
    const lines = [
      '==========================================',
      'ECO-PARK AI v5.0 — SMART CARBON INVOICE',
      '==========================================',
      `Invoice Ref: INV-${res.ticketCode}`,
      `Tier: ${isVip ? 'VIP EXECUTIVE GOLD' : 'STANDARD ECO'}`,
      `Driver: ${res.driverName}`,
      `Plate Number: ${res.plateNumber}`,
      `Vehicle Category: ${res.vehicleType}`,
      `Branch / Bay: ${res.branch} / ${res.spotLabel}`,
      `Base & Dynamic Tariff: ${res.feeSar} SAR`,
      `Afforestation Carbon Tax: ${res.carbonTaxSar} SAR`,
      `Total Due (Paid): ${res.feeSar + res.carbonTaxSar} SAR`,
      `CO2 Avoided: ${res.co2SavedKg} kg (+${res.pointsEarned} pts)`,
      `Status: ${res.status.toUpperCase()}`,
      '==========================================',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INV-${res.ticketCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(t(lang, `تم تنزيل الفاتورة الإلكترونية INV-${res.ticketCode}.`, `Downloaded invoice INV-${res.ticketCode}.`));
  };

  return (
    <div className="space-y-6">
      {/* Top Billing KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="text-xs text-slate-400">{t(lang, 'معامل التعرفة الديناميكية', 'Dynamic Surge Multiplier')}</div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-cyan-400 tabular-nums">
            {surgeMultiplier}x
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, `محسوب عند إشغال ${simulatedOccupancy}%`, `Calculated at ${simulatedOccupancy}% occupancy`)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="text-xs text-slate-400">{t(lang, 'إجمالي رسوم الوقوف', 'Parking Revenue')}</div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
            {totals.parkingTotal} {t(lang, 'ر.س', 'SAR')}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, `${reservations.length} فواتير مسجلة`, `${reservations.length} recorded stays`)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="text-xs text-slate-400">{t(lang, 'حصيلة ضريبة التشجير', 'Afforestation Carbon Tax')}</div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-amber-400 tabular-nums">
            {totals.carbonTaxTotal} {t(lang, 'ر.س', 'SAR')}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, 'مخصصة لمبادرة السعودية الخضراء', 'Allocated to national greening')}
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'حجوزات VIP الذهبية', 'VIP Executive Passes')}</span>
            <Crown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
            {totals.vipCount}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, 'أولوية الصف الأول وروبوت الشحن', 'Front-bay & mobile charger priority')}
          </div>
        </div>
      </div>

      {/* Dynamic Pricing Simulator */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
              {t(lang, 'محاكي التسعير الديناميكي حسب الذروة والمركبة', 'Dynamic Eco-Tariff Simulator')}
            </h2>
            <p className="text-xs text-slate-400">
              {t(
                lang,
                'تبقى المركبات الكهربائية معفاة 100% في كافة الأوقات لتحفيز التحول الأخضر.',
                'EVs remain 100% exempt across all occupancy tiers to accelerate zero-emission adoption.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSimulatedOccupancy(liveOccupancyPct)}
              className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs text-slate-300 hover:border-emerald-400/50"
            >
              {t(lang, `مزامنة الإشغال الحي (${liveOccupancyPct}%)`, `Sync Live (${liveOccupancyPct}%)`)}
            </button>
            <button
              type="button"
              onClick={() => setPeakHoursActive((p) => !p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                peakHoursActive
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                  : 'border-white/10 bg-[#08121D] text-slate-300'
              }`}
            >
              <TrendingUp className="inline h-3.5 w-3.5 me-1" />
              {peakHoursActive ? t(lang, 'ذروة المساء نشطة (+15%)', 'Evening Peak (+15%)') : t(lang, 'ساعات قياسية', 'Standard Hours')}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">{t(lang, 'نسبة الإشغال المختبرة', 'Simulated Lot Occupancy')}</span>
            <span className="font-mono font-bold text-cyan-400 tabular-nums">{simulatedOccupancy}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={simulatedOccupancy}
            onChange={(e) => setSimulatedOccupancy(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => {
            const spec = VEHICLE_SPECS[vt];
            const dynamicTotal =
              vt === 'ELECTRIC'
                ? 0
                : Math.round(spec.feeSar * surgeMultiplier) + spec.carbonTaxSar;
            return (
              <div
                key={vt}
                className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-1.5"
              >
                <div className="text-xs font-bold" style={{ color: spec.badgeColor }}>
                  {lang === 'ar' ? spec.labelAr : spec.labelEn}
                </div>
                <div className="font-mono text-2xl font-extrabold text-white tabular-nums">
                  {dynamicTotal} <span className="text-xs text-slate-400">{t(lang, 'ر.س', 'SAR')}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {vt === 'ELECTRIC'
                    ? t(lang, 'إعفاء 100% +30 نقطة', '100% Exempt +30 pts')
                    : t(lang, `ضريبة كربون: ${spec.carbonTaxSar} ر.س`, `Carbon Tax: ${spec.carbonTaxSar} SAR`)}
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-amber-400/45 bg-amber-500/10 p-4 space-y-1.5">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" />
              {t(lang, 'باقة VIP الذهبية', 'VIP Executive Pass')}
            </div>
            <div className="font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
              {Math.round(25 * surgeMultiplier)} <span className="text-xs text-amber-200/70">{t(lang, 'ر.س', 'SAR')}</span>
            </div>
            <div className="text-[11px] text-amber-200/80">
              {t(lang, 'أولوية الصف الأول + روبوت شحن +50 نقطة', 'Front Bay + Robot Charge +50 pts')}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Peak-Shaving & BESS Utility Tariff Engine */}
      <div className="rounded-xl border border-emerald-400/25 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              {t(
                lang,
                'محرك التسعير الديناميكي وتقليص أحمال الذروة عبر BESS (Peak-Shaving Engine)',
                'Dynamic Peak-Shaving & BESS-Aware Tariff Engine'
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'يوازن تلقائياً بين تعرفة الشبكة المرتفعة وتفريغ بطاريات BESS لتقليص فواتير الذروة وحماية هامش الربح.',
                'Automatically dispatches BESS storage when utility tariffs peak, curbing demand charges and stabilizing charging margins.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPeakShave}
                onChange={(e) => setAutoPeakShave(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>{t(lang, 'تقليص الذروة التلقائي', 'Auto Peak-Shaving')}</span>
            </label>

            {onDispatchPeakShave && (
              <button
                type="button"
                disabled={!peakShaveEligible}
                onClick={() => {
                  const kwh = Math.max(18, Math.round(peakShaveStats.shavedKw * 0.45));
                  const sar = Number((kwh * (peakShaveStats.utilityPeakRate - peakShaveStats.solarOffPeakRate)).toFixed(1));
                  onDispatchPeakShave(8, kwh, sar);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
              >
                <BatteryCharging className="h-3.5 w-3.5" />
                {t(lang, 'تفعيل تفريغ BESS لخفض الذروة', 'Dispatch BESS Peak-Shave')}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 rounded-xl bg-[#08121D] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                {t(lang, 'الحد الأدنى الاحتياطي لـ BESS لتقليص الذروة', 'BESS Reserve Floor for Peak-Shaving')}
              </span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                {peakShaveReservePct}% ({t(lang, 'الحالي:', 'Now:')} {bessCharge}%)
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={85}
              step={5}
              value={peakShaveReservePct}
              onChange={(e) => setPeakShaveReservePct(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>

          <div className="lg:col-span-7 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#08121D] p-3">
              <div className="text-[11px] text-slate-400">
                {t(lang, 'تعرفة الشبكة مقابل الشمسي', 'Grid vs Solar Rate')}
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-white tabular-nums">
                {peakShaveStats.utilityPeakRate} / {peakShaveStats.solarOffPeakRate} SAR
              </div>
            </div>
            <div className="rounded-xl bg-[#08121D] p-3">
              <div className="text-[11px] text-slate-400">
                {t(lang, 'الحمل المُزاح عبر BESS', 'Peak Load Shaved')}
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-cyan-300 tabular-nums">
                {peakShaveStats.shavedKw} kW
              </div>
            </div>
            <div className="rounded-xl bg-[#08121D] p-3">
              <div className="text-[11px] text-slate-400">
                {t(lang, 'وفر التكلفة / ساعة', 'Grid Savings / hr')}
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-emerald-400 tabular-nums">
                +{peakShaveStats.hourlySavingsSar} {t(lang, 'ر.س', 'SAR')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Invoices Table */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-400" />
            {t(lang, 'سجل الفواتير الذكية والإيصالات', 'Smart Invoices & Receipts')}
          </h3>
          <span className="font-mono text-xs text-emerald-400 tabular-nums">
            {t(lang, 'الإجمالي:', 'Total:')} {totals.grandTotal} SAR
          </span>
        </div>

        {reservations.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            {t(lang, 'لا توجد فواتير صادرة حتى الآن. أنشئ حجزاً قياسياً أو VIP لإصدار فاتورته فوراً.', 'No invoices issued yet. Create a Standard or VIP reservation to generate receipts.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="pb-3 text-start">{t(lang, 'الفاتورة', 'Invoice')}</th>
                  <th className="pb-3 text-start">{t(lang, 'السائق / الفئة', 'Driver / Tier')}</th>
                  <th className="pb-3 text-start">{t(lang, 'الموقف', 'Bay')}</th>
                  <th className="pb-3 text-start">{t(lang, 'التعرفة', 'Tariff')}</th>
                  <th className="pb-3 text-start">{t(lang, 'ضريبة الكربون', 'Carbon Tax')}</th>
                  <th className="pb-3 text-start">{t(lang, 'الإجمالي', 'Total')}</th>
                  <th className="pb-3 text-start">{t(lang, 'تصدير', 'Export')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reservations.map((r) => {
                  const isVip = r.ticketCode.startsWith('VIP-');
                  return (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="py-3 font-mono font-bold text-cyan-300">INV-{r.ticketCode}</td>
                      <td className="py-3">
                        <span className="text-white font-semibold">{r.driverName}</span>
                        {isVip && (
                          <span className="ms-2 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            VIP
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-slate-300">{r.spotLabel}</td>
                      <td className="py-3 font-mono tabular-nums">{r.feeSar} SAR</td>
                      <td className="py-3 font-mono text-amber-300 tabular-nums">{r.carbonTaxSar} SAR</td>
                      <td className="py-3 font-mono font-bold text-emerald-400 tabular-nums">
                        {r.feeSar + r.carbonTaxSar} SAR
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => downloadInvoice(r)}
                          className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t(lang, 'فاتورة', 'Download')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
