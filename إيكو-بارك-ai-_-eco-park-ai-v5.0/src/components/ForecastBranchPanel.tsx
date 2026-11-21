import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  CloudSun,
  Download,
  Leaf,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react';
import { Language, ParkingSpot } from '../types/parking';
import { BRANCHES } from '../data/initialData';
import { t } from '../data/i18n';

interface ForecastBranchPanelProps {
  lang: Language;
  spots: ParkingSpot[];
  solarKw: number;
  bessCharge: number;
  totalCo2Kg: number;
  onActivateEcoConservation: () => void;
  onNotify: (msg: string) => void;
}

export const ForecastBranchPanel: React.FC<ForecastBranchPanelProps> = ({
  lang,
  spots,
  solarKw,
  bessCharge,
  totalCo2Kg,
  onActivateEcoConservation,
  onNotify,
}) => {
  const currentOcc = Math.round(
    (spots.filter((s) => s.status !== 'available').length / Math.max(1, spots.length)) * 100
  );

  const forecastCurve = useMemo(() => {
    const baseSolar = Math.max(60, solarKw || 140);
    const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    const solarWeights = [0.55, 0.85, 1.0, 0.92, 0.65, 0.25, 0.05, 0.0];
    const tempCurve = [29, 34, 39, 41, 38, 33, 29, 26];
    const occCurve = [45, 72, 88, 84, 78, 92, 68, 35];

    return hours.map((hour, i) => ({
      hour,
      solarForecastKw: Math.round(baseSolar * solarWeights[i]),
      ambientTempC: tempCurve[i],
      predictedOccPct: Math.min(100, Math.round((occCurve[i] + currentOcc) / 2)),
    }));
  }, [solarKw, currentOcc]);

  const peakHour = useMemo(
    () =>
      forecastCurve.reduce(
        (best, item) => (item.predictedOccPct > best.predictedOccPct ? item : best),
        forecastCurve[0]
      ),
    [forecastCurve]
  );

  const branchLeaderboard = useMemo(() => {
    return BRANCHES.map((branchName, idx) => {
      const isPrimary = idx === 0;
      const co2 = isPrimary
        ? Math.max(120, Math.round(totalCo2Kg + 120))
        : [98, 86, 79, 110][idx - 1] || 75;
      const solar = isPrimary ? Math.max(115, solarKw || 140) : [128, 112, 95, 134][idx - 1] || 90;
      const evRatio = isPrimary ? 64 : [58, 52, 47, 71][idx - 1] || 50;
      const score = Math.round(co2 * 0.45 + solar * 0.35 + evRatio * 0.6);
      return {
        branchName,
        isPrimary,
        co2Kg: co2,
        solarKw: solar,
        evSharePct: evRatio,
        esgScore: score,
      };
    }).sort((a, b) => b.esgScore - a.esgScore);
  }, [totalCo2Kg, solarKw]);

  const exportBenchmark = () => {
    const report = [
      'ECO-PARK AI v5.0 — MULTI-BRANCH ESG BENCHMARK & FORECAST',
      `Generated: ${new Date().toISOString()}`,
      `Active BESS: ${bessCharge}% | Live Solar: ${solarKw} kW | Peak Predicted: ${peakHour.hour} (${peakHour.predictedOccPct}%)`,
      '',
      ...branchLeaderboard.map(
        (b, i) =>
          `#${i + 1} ${b.branchName} | ESG Score: ${b.esgScore} | CO2 Saved: ${b.co2Kg} kg | Solar: ${b.solarKw} kW | EV Share: ${b.evSharePct}%`
      ),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eco-park-branch-benchmark.txt';
    a.click();
    URL.revokeObjectURL(url);
    onNotify(t(lang, 'تم تصدير تقرير مقارنة الفروع والتوقعات.', 'Exported Multi-Branch ESG Benchmark report.'));
  };

  return (
    <div className="space-y-6">
      {/* Top Weather & Peak Advisory Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-amber-400/30 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'ذروة الإشعاع الشمسي المتوقعة', 'Forecast Solar Peak')}</span>
            <CloudSun className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
            {Math.max(...forecastCurve.map((f) => f.solarForecastKw))} kW
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, 'نافذة الشحن المثلى لـ BESS: 10:00 – 14:00', 'Optimal BESS solar window: 10:00 – 14:00')}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/30 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'ذروة الحرارة المحيطة', 'Ambient Thermal Peak')}</span>
            <Thermometer className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-cyan-300 tabular-nums">
            41°C
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, 'يوصى بتفعيل الرذاذ المائي قبل الساعة 13:00', 'Activate mist cooling prior to 13:00')}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-400/30 bg-[#0D1E2E] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t(lang, 'ساعة الذروة المتوقعة', 'Predicted Peak Hour')}</span>
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
              {peakHour.hour} ({peakHour.predictedOccPct}%)
            </div>
          </div>
          <button
            type="button"
            onClick={onActivateEcoConservation}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
          >
            <Zap className="h-3.5 w-3.5" />
            {t(lang, 'تفعيل الترشيد الاستباقي للذروة', 'Pre-Activate Eco-Conservation')}
          </button>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">
            {t(lang, 'منحنى التنبؤ بالإنتاج الشمسي والحرارة والإشغال (12 ساعة)', 'Solar Output, Ambient Heat & Occupancy Forecast')}
          </h3>
          <p className="text-xs text-slate-400">
            {t(lang, 'توقعات مدعومة بالبيانات الحية لتخطيط شحن BESS وتوزيع الأحمال.', 'Telemetry-driven forecast for BESS charging and load balancing.')}
          </p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastCurve} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A52" />
              <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#08121D',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="solarForecastKw"
                name={t(lang, 'طاقة شمسية متوقعة (kW)', 'Forecast Solar (kW)')}
                stroke="#F59E0B"
                fill="url(#solarGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="predictedOccPct"
                name={t(lang, 'الإشغال المتوقع (%)', 'Predicted Occupancy (%)')}
                stroke="#10B981"
                fill="url(#occGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Multi-Branch ESG Leaderboard */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                {t(lang, 'لوحة التميز البيئي ومقارنة الفروع (ESG Benchmark)', 'Multi-Branch ESG Benchmark Leaderboard')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(lang, 'تصنيف الفروع حسب الوفر الكربوني وكفاءة الطاقة الشمسية وحصة المركبات الكهربائية.', 'Ranked by avoided CO2, solar yield, and EV adoption ratio.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportBenchmark}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
          >
            <Download className="h-3.5 w-3.5" />
            {t(lang, 'تصدير تقرير الفروع', 'Export Benchmark')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {branchLeaderboard.map((b, index) => (
            <div
              key={b.branchName}
              className={`rounded-xl border p-4 space-y-2 ${
                b.isPrimary
                  ? 'border-emerald-400/50 bg-emerald-500/10'
                  : 'border-white/10 bg-[#08121D]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-extrabold text-amber-400">#{index + 1}</span>
                {b.isPrimary && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {t(lang, 'الفرع النشط', 'LIVE')}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-white truncate">{b.branchName}</div>
              <div className="font-mono text-xl font-extrabold text-emerald-400 tabular-nums">
                {b.esgScore} <span className="text-[10px] text-slate-400">ESG</span>
              </div>
              <div className="space-y-0.5 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span>{t(lang, 'CO2 موفر:', 'CO2 Saved:')}</span>
                  <span className="font-mono text-cyan-300">{b.co2Kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span>{t(lang, 'شمسية:', 'Solar:')}</span>
                  <span className="font-mono text-amber-300">{b.solarKw} kW</span>
                </div>
                <div className="flex justify-between">
                  <span>{t(lang, 'حصة EV:', 'EV Share:')}</span>
                  <span className="font-mono text-emerald-300 flex items-center gap-0.5">
                    <Leaf className="h-3 w-3" /> {b.evSharePct}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
