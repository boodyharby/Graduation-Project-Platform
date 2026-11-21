import React from 'react';
import { ArrowRight, BatteryCharging, Car, CheckCircle2, Minimize2, Sun, ThermometerSun, Zap } from 'lucide-react';
import { Language, ParkingSpot, ProjectSettings } from '../types/parking';
import { t } from '../data/i18n';

interface GateKioskOverlayProps {
  lang: Language;
  settings: ProjectSettings;
  spots: ParkingSpot[];
  solarKw: number;
  bessCharge: number;
  avgTempC: number;
  onExitKiosk: () => void;
}

export const GateKioskOverlay: React.FC<GateKioskOverlayProps> = ({
  lang,
  settings,
  spots,
  solarKw,
  bessCharge,
  avgTempC,
  onExitKiosk,
}) => {
  const availableSpots = spots.filter((s) => s.status === 'available');
  const availableEv = availableSpots.filter((s) => s.hasCharger);
  const availableStd = availableSpots.filter((s) => !s.hasCharger);
  const recommendedBay = availableEv[0] || availableSpots[0];

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[70] flex flex-col justify-between bg-[#060E17] p-6 sm:p-10 text-slate-100 overflow-y-auto"
    >
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="font-mono text-xs font-semibold text-emerald-400">
            {settings.projectCode} · {lang === 'ar' ? settings.teamNameAr : settings.teamNameEn}
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
            {lang === 'ar' ? settings.projectNameAr.split('|')[0].trim() : settings.projectNameEn}
          </h1>
          <div className="mt-1 text-xs text-slate-400">
            {lang === 'ar' ? settings.instituteNameAr : settings.instituteNameEn}
          </div>
        </div>

        <button
          type="button"
          onClick={onExitKiosk}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0D1E2E] px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-emerald-400/50 hover:text-white"
        >
          <Minimize2 className="h-4 w-4 text-emerald-400" />
          {t(lang, 'إغلاق وضع شاشة البوابة', 'Exit Gate Kiosk Mode')}
        </button>
      </div>

      {/* Main Availability & Guidance Focal Display */}
      <div className="my-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/40 bg-[#0D1E2E] p-6 flex flex-col justify-between">
          <div className="text-sm font-semibold text-slate-300">
            {t(lang, 'المواقف المتاحة للدخول الآن', 'Available Bays Right Now')}
          </div>
          <div className="my-4 font-mono text-6xl font-black text-emerald-400 tabular-nums">
            {availableSpots.length}
            <span className="ms-2 text-2xl font-bold text-slate-400">/ {spots.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <Zap className="h-4 w-4" />
              {availableEv.length} {t(lang, 'شحن كهربائي', 'EV Chargers')}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <Car className="h-4 w-4" />
              {availableStd.length} {t(lang, 'موقف عادي', 'Standard')}
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-cyan-500/35 bg-[#0D1E2E] p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-cyan-300">
              {t(lang, 'التوجيه الذكي الفوري عند البوابة', 'Instant Gate Guidance')}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {t(lang, 'قاعدة الموقف المفرد مفعّلة', '1 Bay = 1 Car Enforced')}
            </span>
          </div>

          {recommendedBay ? (
            <div className="my-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-400/30 bg-[#08121D] p-5">
              <div>
                <div className="text-xs text-slate-400">
                  {t(lang, 'أقرب موقف موصى به لك', 'Nearest Recommended Bay')}
                </div>
                <div className="mt-1 font-mono text-4xl font-black text-white">
                  {recommendedBay.label}
                </div>
                <div className="mt-1 text-xs text-emerald-300">
                  {recommendedBay.hasCharger
                    ? t(lang, `مزود بشاحن ${recommendedBay.chargerKw}kW`, `Equipped with ${recommendedBay.chargerKw}kW EV Charger`)
                    : t(lang, 'موقف مظلل ومجهز بحساسات أمان', 'Shaded Smart Bay with Safety Sensors')}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950">
                <ArrowRight className={`h-5 w-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                <span>
                  {recommendedBay.distanceFromGateMeters}m {t(lang, 'من البوابة', 'from Gate')}
                </span>
              </div>
            </div>
          ) : (
            <div className="my-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
              {t(lang, 'جاري توسعة موقف إضافي تلقائياً لاستيعاب دخولك...', 'Auto-expanding a fresh bay for incoming vehicle...')}
            </div>
          )}

          {/* Live Bay Status Strip */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {spots.map((spot) => {
              const isAvail = spot.status === 'available';
              return (
                <div
                  key={spot.id}
                  className={`rounded-lg border px-3 py-2 text-center font-mono text-xs font-bold ${
                    isAvail
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 bg-[#08121D] text-slate-500'
                  }`}
                >
                  {spot.label} {spot.hasCharger ? '⚡' : ''}
                  <div className="mt-0.5 text-[10px] font-normal">
                    {isAvail ? t(lang, 'متاح', 'OPEN') : t(lang, 'محجوز/مشغول', 'BUSY')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Live Energy & Thermal Footer */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-white/10 pt-5 text-xs">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] px-4 py-3">
          <Sun className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-slate-400">{t(lang, 'الطاقة الشمسية النظيفة', 'Clean Solar Canopy')}</div>
            <div className="font-mono text-base font-extrabold text-amber-300 tabular-nums">{solarKw} kW</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] px-4 py-3">
          <BatteryCharging className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-slate-400">{t(lang, 'مخزون بطاريات BESS', 'BESS Storage Level')}</div>
            <div className="font-mono text-base font-extrabold text-emerald-300 tabular-nums">{bessCharge}%</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] px-4 py-3">
          <ThermometerSun className="h-5 w-5 text-cyan-400 shrink-0" />
          <div>
            <div className="text-slate-400">{t(lang, 'متوسط حرارة الساحة', 'Lot Thermal Comfort')}</div>
            <div className="font-mono text-base font-extrabold text-cyan-300 tabular-nums">
              {avgTempC}°C · <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
