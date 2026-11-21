import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Droplets,
  Play,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react';
import { Language, SolarCleanCycleLog } from '../types/parking';
import { t } from '../data/i18n';

interface SolarDryCleanPanelProps {
  lang: Language;
  solarKw: number;
  dustPct: number;
  windKmh: number;
  onUpdateDustPct?: (nextDust: number) => void;
  onRestoreSolarKw: (recoveredKw: number) => void;
  onLogAudit?: (actionAr: string, actionEn: string) => void;
  onNotify: (msg: string) => void;
}

export const SolarDryCleanPanel: React.FC<SolarDryCleanPanelProps> = ({
  lang,
  solarKw,
  dustPct,
  windKmh,
  onUpdateDustPct,
  onRestoreSolarKw,
  onLogAudit,
  onNotify,
}) => {
  const [phase, setPhase] = useState<'idle' | 'queued_wind' | 'cleaning' | 'completed'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [autoQueueEnabled, setAutoQueueEnabled] = useState<boolean>(true);
  const [history, setHistory] = useState<SolarCleanCycleLog[]>([
    {
      id: 'clean-init-1',
      triggeredBy: 'Auto-Sandstorm Sweep',
      dustBeforePct: 68,
      dustAfterPct: 4,
      recoveredKw: 62.4,
      waterSavedLiters: 420,
      windKmh: 22,
      completedAt: '06:40',
    },
  ]);

  const windSafe = windKmh <= 35;

  // Auto-dispatch if dust >= 50% and autoQueue is active
  useEffect(() => {
    if (!autoQueueEnabled) return;
    if (dustPct >= 50 && phase === 'idle') {
      if (!windSafe) {
        setPhase('queued_wind');
      }
    } else if (phase === 'queued_wind' && windSafe) {
      setPhase('cleaning');
      setProgress(8);
    }
  }, [autoQueueEnabled, dustPct, phase, windSafe]);

  // Animate dry-brush cleaning progress
  useEffect(() => {
    if (phase !== 'cleaning') return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + 16);
      });
    }, 450);
    return () => clearInterval(timer);
  }, [phase]);

  // Complete cycle once progress reaches 100
  useEffect(() => {
    if (phase !== 'cleaning' || progress < 100) return;

    const dustBefore = Math.max(8, dustPct);
    const dustAfter = 3;
    const kwGain = Number(Math.max(12, Math.min(85, dustBefore * 0.85)).toFixed(1));
    const waterSaved = Math.round(280 + dustBefore * 2.4);

    const log: SolarCleanCycleLog = {
      id: `clean-${Date.now()}`,
      triggeredBy: autoQueueEnabled ? 'Auto Dust Guard' : 'Manual Dispatch',
      dustBeforePct: dustBefore,
      dustAfterPct: dustAfter,
      recoveredKw: kwGain,
      waterSavedLiters: waterSaved,
      windKmh,
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHistory((prev) => [log, ...prev].slice(0, 6));
    setPhase('completed');
    onUpdateDustPct?.(dustAfter);
    onRestoreSolarKw(kwGain);
    onLogAudit?.(
      `إتمام التنظيف الجاف الآلي للألواح الشمسية (استعادة +${kwGain} kW وتوفير ${waterSaved} لتر ماء)`,
      `Completed autonomous dry solar canopy cleaning (+${kwGain} kW restored, ${waterSaved}L water saved)`
    );
    onNotify(
      t(
        lang,
        `اكتمل التنظيف الجاف للألواح! تمت استعادة +${kwGain} kW وتوفير ${waterSaved} لتر ماء.`,
        `Dry solar brush cycle finished! Restored +${kwGain} kW & saved ${waterSaved}L water.`
      )
    );
  }, [autoQueueEnabled, dustPct, lang, onLogAudit, onNotify, onRestoreSolarKw, onUpdateDustPct, phase, progress, windKmh]);

  const handleDispatch = () => {
    if (phase === 'cleaning') return;
    if (!windSafe) {
      setPhase('queued_wind');
      onNotify(
        t(
          lang,
          `سرعة الرياح الحالية ${windKmh} كم/س تتجاوز حد الأمان (35 كم/س). تم تأجيل التنظيف تلقائياً حتى هدوء الرياح.`,
          `Wind speed ${windKmh} km/h exceeds 35 km/h safety limit; dry cleaning queued until wind subsides.`
        )
      );
      return;
    }
    setProgress(5);
    setPhase('cleaning');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-400" />
            {t(
              lang,
              'روبوت التنظيف الجاف التلقائي للألواح الشمسية (بعد العواصف الرملية)',
              'Autonomous Solar Dry-Cleaning Dispatch (Post-Sandstorm Recovery)'
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'يجدول تنظيفاً كهروستاتيكياً جافاً دون ماء فور تجاوز الغبار 50% وبمجرد هدوء الرياح دون 35 كم/س.',
              'Dispatches waterless electrostatic brush cycles when dust >= 50% and wind drops safely below 35 km/h.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={autoQueueEnabled}
              onChange={(e) => setAutoQueueEnabled(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>{t(lang, 'جدولة تلقائية عند الغبار ≥ 50%', 'Auto-Dispatch ≥ 50% Dust')}</span>
          </label>

          <button
            type="button"
            disabled={phase === 'cleaning'}
            onClick={handleDispatch}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {phase === 'cleaning'
              ? t(lang, `جاري التنظيف (${progress}%)`, `Cleaning (${progress}%)`)
              : t(lang, 'تشغيل دورة التنظيف الجاف', 'Dispatch Dry-Brush Sweep')}
          </button>
        </div>
      </div>

      {/* Telemetry Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(lang, 'نسبة الغبار المرصودة', 'Detected Canopy Dust')}
          </div>
          <div
            className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
              dustPct >= 50 ? 'text-red-400' : dustPct >= 25 ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {dustPct}%
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Wind className="h-3 w-3 text-cyan-400" />
            {t(lang, 'شرط أمان الرياح (≤ 35 km/h)', 'Wind Lock (≤ 35 km/h)')}
          </div>
          <div
            className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
              windSafe ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {windKmh} km/h · {windSafe ? t(lang, 'آمن', 'SAFE') : t(lang, 'مؤجل', 'LOCKED')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" />
            {t(lang, 'الإنتاج الشمسي الحالي', 'Current Solar Yield')}
          </div>
          <div className="mt-1 font-mono text-xl font-extrabold text-amber-300 tabular-nums">
            {solarKw} kW
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Droplets className="h-3 w-3 text-emerald-400" />
            {t(lang, 'المياه الموفرة (تنظيف جاف)', 'Water Saved (Waterless)')}
          </div>
          <div className="mt-1 font-mono text-xl font-extrabold text-emerald-400 tabular-nums">
            {history.reduce((acc, h) => acc + h.waterSavedLiters, 0).toLocaleString()} L
          </div>
        </div>
      </div>

      {/* Live Progress / Queue Status */}
      {phase !== 'idle' && (
        <div className="rounded-xl border border-white/10 bg-[#08121D] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              {phase === 'queued_wind' ? (
                <>
                  <Wind className="h-4 w-4 text-amber-400" />
                  {t(
                    lang,
                    'في قائمة الانتظار الآلية: ينتظر هدوء الرياح دون 35 كم/س للبدء بأمان',
                    'Queued automatically: waiting for wind speed to drop below 35 km/h'
                  )}
                </>
              ) : phase === 'cleaning' ? (
                <>
                  <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                  {t(
                    lang,
                    'روبوت التنظيف الكهروستاتيكي يمسح مصفوفات المظلات الشمسية حالياً...',
                    'Electrostatic dry-brush robot sweeping solar canopy rows...'
                  )}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {t(
                    lang,
                    'تمت دورة التنظيف الجاف واستعادة الكفاءة الشمسية بنجاح',
                    'Dry-cleaning sweep complete & solar efficiency restored'
                  )}
                </>
              )}
            </span>
            <span className="font-mono font-bold text-cyan-300 tabular-nums">
              {phase === 'queued_wind' ? 'WAIT' : `${progress}%`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                phase === 'queued_wind'
                  ? 'bg-amber-400'
                  : phase === 'completed'
                    ? 'bg-emerald-400'
                    : 'bg-cyan-400'
              }`}
              style={{ width: `${phase === 'queued_wind' ? 25 : progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent Cleaning History */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">
          {t(lang, 'سجل دورات التنظيف الجاف واسترداد الطاقة', 'Dry-Cleaning & Yield Recovery History')}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {history.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-2.5 text-xs space-y-1"
            >
              <div className="flex items-center justify-between font-bold text-white">
                <span>{item.triggeredBy}</span>
                <span className="font-mono text-emerald-400 tabular-nums">+{item.recoveredKw} kW</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                <span>
                  {item.dustBeforePct}% → {item.dustAfterPct}% {t(lang, 'غبار', 'dust')}
                </span>
                <span>·</span>
                <span>{item.waterSavedLiters}L</span>
                <span>·</span>
                <span className="font-mono">{item.completedAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
