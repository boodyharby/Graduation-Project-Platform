import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BatteryCharging, Sun, Zap } from 'lucide-react';
import { Language } from '../types/parking';
import { t } from '../data/i18n';

interface EnergyAnalyticsChartProps {
  lang: Language;
  solarKw: number;
  bessCharge: number;
  ecoConservation: boolean;
  occupiedCount: number;
  v2gCount: number;
}

interface HourlyEnergyPoint {
  hour: string;
  solarKw: number;
  bessPct: number;
  consumptionKw: number;
  bessDrawKw: number;
}

export const EnergyAnalyticsChart: React.FC<EnergyAnalyticsChartProps> = ({
  lang,
  solarKw,
  bessCharge,
  ecoConservation,
  occupiedCount,
  v2gCount,
}) => {
  const [focusMode, setFocusMode] = useState<'all' | 'solar' | 'bess'>('all');

  const data = useMemo<HourlyEnergyPoint[]>(() => {
    const currentHour = new Date().getHours();
    const peakSolarBase = Math.max(solarKw, 120);
    const loadMultiplier = 1 + occupiedCount * 0.04 + v2gCount * 0.06;

    const points: HourlyEnergyPoint[] = [];
    let simulatedSoc = Math.max(12, Math.min(95, bessCharge + 8));

    for (let h = 0; h < 24; h++) {
      // Realistic solar irradiance bell curve (06:00 -> 18:30, peak around 12:30)
      const daylight = h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) : 0;
      const hourlySolar =
        h === currentHour
          ? solarKw
          : Math.round(peakSolarBase * Math.pow(Math.max(0, daylight), 1.25));

      // Station load & EV charging consumption profile across 24 hours
      const morningPeak = Math.exp(-Math.pow((h - 9) / 2.6, 2)) * 42;
      const eveningPeak = Math.exp(-Math.pow((h - 19) / 3.1, 2)) * 68;
      const baseLoad = ecoConservation ? 16 : 26;
      const consumptionKw = Math.round((baseLoad + morningPeak + eveningPeak) * loadMultiplier);

      // BESS charge/discharge balance
      const netKw = hourlySolar - consumptionKw;
      const deltaPct = netKw / 8.5;
      simulatedSoc =
        h === currentHour
          ? bessCharge
          : Math.max(4, Math.min(100, Math.round(simulatedSoc + deltaPct)));

      const bessDrawKw = Math.max(0, consumptionKw - hourlySolar);

      points.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        solarKw: hourlySolar,
        bessPct: simulatedSoc,
        consumptionKw,
        bessDrawKw,
      });
    }
    return points;
  }, [bessCharge, ecoConservation, occupiedCount, solarKw, v2gCount]);

  const metrics = useMemo(() => {
    const peakSolar = Math.max(...data.map((d) => d.solarKw));
    const minBess = Math.min(...data.map((d) => d.bessPct));
    const totalSolarKwh = data.reduce((acc, d) => acc + d.solarKw, 0);
    const totalLoadKwh = data.reduce((acc, d) => acc + d.consumptionKw, 0);
    return { peakSolar, minBess, totalSolarKwh, totalLoadKwh };
  }, [data]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-400" />
            {t(
              lang,
              'التحليل الساعي للطاقة: إنتاج المظلات الشمسية وشحن/استهلاك BESS (24 ساعة)',
              '24h Energy Analytics: Solar Canopy Output & BESS Charge / Consumption'
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'منحنى ديناميكي مرتبط بلحظة التشغيل الحالية، حمل الشواحن، وعتبة الإنذار الحرج (10% و 20%).',
              'Dynamic 24h curve synced to live telemetry, EV bay load, and critical 10% / 20% BESS alert thresholds.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFocusMode('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              focusMode === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {t(lang, 'المنحنى الشامل', 'Combined View')}
          </button>
          <button
            type="button"
            onClick={() => setFocusMode('solar')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              focusMode === 'solar'
                ? 'bg-amber-400 text-slate-950'
                : 'border border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {t(lang, 'الإنتاج الشمسي', 'Solar Curve')}
          </button>
          <button
            type="button"
            onClick={() => setFocusMode('bess')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              focusMode === 'bess'
                ? 'bg-cyan-400 text-slate-950'
                : 'border border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {t(lang, 'بطاريات BESS', 'BESS & Load')}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span>{t(lang, 'ذروة الإنتاج الشمسي', 'Peak Solar Output')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-amber-300 tabular-nums">
            {metrics.peakSolar} kW
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t(lang, 'أدنى مستوى BESS متوقع', '24h Min BESS SoC')}</span>
          </div>
          <div
            className={`mt-1 font-mono text-lg font-extrabold tabular-nums ${
              metrics.minBess < 10
                ? 'text-red-400'
                : metrics.minBess < 20
                  ? 'text-amber-300'
                  : 'text-emerald-400'
            }`}
          >
            {metrics.minBess}%
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span>{t(lang, 'الطاقة الشمسية اليومية', '24h Solar Yield')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-cyan-300 tabular-nums">
            {metrics.totalSolarKwh} kWh
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="text-slate-400">{t(lang, 'استهلاك المحطة اليومي', '24h Station Load')}</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-slate-100 tabular-nums">
            {metrics.totalLoadKwh} kWh
          </div>
        </div>
      </div>

      {/* Recharts 24-Hour Curve */}
      <div className="h-72 w-full rounded-xl border border-white/5 bg-[#08121D] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="solarOutputGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="bessDrawGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
            <XAxis
              dataKey="hour"
              stroke="#94a3b8"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              interval={2}
            />
            <YAxis
              yAxisId="kw"
              stroke="#f59e0b"
              tick={{ fontSize: 11, fill: '#fbbf24' }}
              label={{
                value: 'kW',
                angle: -90,
                position: 'insideLeft',
                fill: '#fbbf24',
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              stroke="#10b981"
              tick={{ fontSize: 11, fill: '#34d399' }}
              label={{
                value: 'BESS %',
                angle: 90,
                position: 'insideRight',
                fill: '#34d399',
                fontSize: 11,
              }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#0A1724',
                borderColor: 'rgba(16,185,129,0.4)',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />

            {(focusMode === 'all' || focusMode === 'bess') && (
              <ReferenceLine
                yAxisId="pct"
                y={10}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{
                  value: '10% Email Escalation',
                  fill: '#f87171',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {(focusMode === 'all' || focusMode === 'solar') && (
              <Area
                yAxisId="kw"
                type="monotone"
                dataKey="solarKw"
                name={t(lang, 'إنتاج الطاقة الشمسية (kW)', 'Solar Output (kW)')}
                stroke="#f59e0b"
                strokeWidth={2.4}
                fill="url(#solarOutputGrad)"
              />
            )}

            {(focusMode === 'all' || focusMode === 'bess') && (
              <Bar
                yAxisId="kw"
                dataKey="consumptionKw"
                name={t(lang, 'استهلاك المحطة والشواحن (kW)', 'Station Consumption (kW)')}
                fill="#06b6d4"
                fillOpacity={0.45}
                radius={[4, 4, 0, 0]}
                barSize={12}
              />
            )}

            {(focusMode === 'all' || focusMode === 'bess') && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="bessPct"
                name={t(lang, 'مستوى شحن BESS (%)', 'BESS Charge (%)')}
                stroke="#10b981"
                strokeWidth={2.8}
                dot={{ r: 2.5, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
