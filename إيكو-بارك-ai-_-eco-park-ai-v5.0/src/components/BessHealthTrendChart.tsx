import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BatteryCharging, Leaf, Power, ShieldCheck } from 'lucide-react';
import { EcoToggleEvent, Language } from '../types/parking';
import { t } from '../data/i18n';

interface BessHealthTrendChartProps {
  lang: Language;
  bessCharge: number;
  solarKw: number;
  ecoConservation: boolean;
  ecoToggleEvents: EcoToggleEvent[];
  onToggleEcoConservation: () => void;
}

interface BessHealthPoint {
  hour: string;
  hourIndex: number;
  bessChargePct: number;
  healthSohPct: number;
  ecoOnMarker: number | null;
  ecoOffMarker: number | null;
  markerSummary?: string;
}

export const BessHealthTrendChart: React.FC<BessHealthTrendChartProps> = ({
  lang,
  bessCharge,
  solarKw,
  ecoConservation,
  ecoToggleEvents,
  onToggleEcoConservation,
}) => {
  const [rangeFilter, setRangeFilter] = useState<'24h' | '12h'>('24h');

  // Map Eco-Conservation toggles per hour (merge baseline historical toggles + live user toggles)
  const effectiveEvents = useMemo<EcoToggleEvent[]>(() => {
    const baseline: EcoToggleEvent[] = [
      {
        id: 'base-eco-on-02',
        hourIndex: 2,
        hourLabel: '02:00',
        timestamp: t(lang, '02:00 ص (ليلاً)', '02:00 AM'),
        enabled: true,
        bessAtToggle: 42,
      },
      {
        id: 'base-eco-off-09',
        hourIndex: 9,
        hourLabel: '09:00',
        timestamp: t(lang, '09:00 ص (ذروة شمسية)', '09:00 AM'),
        enabled: false,
        bessAtToggle: 68,
      },
    ];
    const combined = [...baseline, ...ecoToggleEvents];
    return combined;
  }, [ecoToggleEvents, lang]);

  const data = useMemo<BessHealthPoint[]>(() => {
    const nowHour = new Date().getHours();
    const eventsByHour = new Map<number, EcoToggleEvent>();
    effectiveEvents.forEach((ev) => {
      eventsByHour.set(ev.hourIndex, ev);
    });

    const points: BessHealthPoint[] = [];
    let soc = Math.max(24, Math.min(92, bessCharge - 6));
    let soh = 98.4;

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      const isNightDrain = h < 6 || h >= 19;
      const solarLift = h >= 7 && h <= 17 ? Math.sin(((h - 7) / 10) * Math.PI) * (solarKw > 0 ? 7.5 : 5.2) : -3.4;
      const ev = eventsByHour.get(h);
      const ecoRelief = ev?.enabled ? 2.4 : isNightDrain ? -1.8 : 0.6;

      if (h === nowHour) {
        soc = bessCharge;
      } else {
        soc = Math.max(8, Math.min(100, Math.round(soc + solarLift + ecoRelief)));
      }

      // Battery State of Health (SoH) gently fluctuates with thermal load and stabilizes when Eco Mode engages
      const deepDischargePenalty = soc < 20 ? -0.35 : soc < 40 ? -0.1 : 0.08;
      const ecoThermalBonus = ev?.enabled || ecoConservation ? 0.14 : -0.04;
      soh = Math.max(89.0, Math.min(99.5, Number((soh + deepDischargePenalty + ecoThermalBonus).toFixed(1))));

      const finalCharge = h === nowHour ? bessCharge : soc;

      points.push({
        hour: hourLabel,
        hourIndex: h,
        bessChargePct: finalCharge,
        healthSohPct: soh,
        ecoOnMarker: ev && ev.enabled ? finalCharge : null,
        ecoOffMarker: ev && !ev.enabled ? finalCharge : null,
        markerSummary: ev
          ? ev.enabled
            ? t(lang, `تفعيل وضع الترشيد عند ${finalCharge}%`, `Eco-Conservation ON at ${finalCharge}%`)
            : t(lang, `إيقاف وضع الترشيد عند ${finalCharge}%`, `Eco-Conservation OFF at ${finalCharge}%`)
          : undefined,
      });
    }

    if (rangeFilter === '12h') {
      const startIdx = Math.max(0, nowHour - 11);
      const slice = points.slice(startIdx, nowHour + 1);
      return slice.length >= 6 ? slice : points.slice(-12);
    }
    return points;
  }, [bessCharge, solarKw, ecoConservation, effectiveEvents, rangeFilter, lang]);

  const stats = useMemo(() => {
    const charges = data.map((d) => d.bessChargePct);
    const peakSoc = Math.max(...charges);
    const minSoc = Math.min(...charges);
    const latestSoh = data[data.length - 1]?.healthSohPct ?? 97.8;
    const toggleCount = effectiveEvents.length;
    return { peakSoc, minSoc, latestSoh, toggleCount };
  }, [data, effectiveEvents.length]);

  const markerHours = useMemo(() => {
    const visibleHours = new Set(data.map((d) => d.hour));
    return effectiveEvents.filter((ev) => visibleHours.has(ev.hourLabel));
  }, [data, effectiveEvents]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>
              {t(
                lang,
                'منحنى صحة وشحن بطاريات BESS خلال 24 ساعة مع علامات وضع الترشيد',
                '24h BESS Charge Health Trend & Eco-Conservation Toggle Markers'
              )}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'يتابع حالة الشحن (SoC %) ومؤشر صحة البطارية (SoH %) مع علامات مرجعية لحظة تفعيل أو إيقاف وضع ترشيد الاستهلاك.',
              'Tracks State of Charge (SoC %) and Battery Health (SoH %) with timeline markers whenever Eco-Conservation mode was toggled.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[#08121D] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setRangeFilter('24h')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                rangeFilter === '24h'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t(lang, '24 ساعة', '24 Hours')}
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter('12h')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                rangeFilter === '12h'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t(lang, 'آخر 12 ساعة', 'Last 12h')}
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleEcoConservation}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              ecoConservation
                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {ecoConservation
              ? t(lang, 'إيقاف الترشيد (تسجيل علامة)', 'Toggle Eco OFF (Mark)')
              : t(lang, 'تفعيل الترشيد (تسجيل علامة)', 'Toggle Eco ON (Mark)')}
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t(lang, 'مؤشر صحة البطارية (SoH)', 'Battery Health (SoH)')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
            {stats.latestSoh}%
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <BatteryCharging className="h-3.5 w-3.5 text-cyan-400" />
            <span>{t(lang, 'أعلى شحن خلال 24 ساعة', '24h Peak Charge')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-cyan-300 tabular-nums">
            {stats.peakSoc}%
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="text-slate-400">{t(lang, 'أدنى شحن مسجل', 'Lowest Recorded SoC')}</div>
          <div
            className={`mt-1 font-mono text-lg font-extrabold tabular-nums ${
              stats.minSoc < 10
                ? 'text-red-400'
                : stats.minSoc < 20
                  ? 'text-amber-300'
                  : 'text-slate-100'
            }`}
          >
            {stats.minSoc}%
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Leaf className="h-3.5 w-3.5 text-amber-400" />
            <span>{t(lang, 'تبديلات وضع الترشيد', 'Eco-Mode Toggles')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-amber-300 tabular-nums">
            {stats.toggleCount}
          </div>
        </div>
      </div>

      {/* Recharts 24h BESS Health & Toggle Markers */}
      <div className="h-72 w-full rounded-xl border border-white/5 bg-[#08121D] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="bessHealthSocGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
            <XAxis
              dataKey="hour"
              stroke="#94a3b8"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              interval={rangeFilter === '24h' ? 2 : 1}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#94a3b8"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              unit="%"
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#0A1724',
                borderColor: 'rgba(16,185,129,0.4)',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
              formatter={(value, name) => {
                if (value === null || value === undefined) return ['—', String(name)];
                return [`${value}%`, String(name)];
              }}
              labelFormatter={(label, payload) => {
                const entry = payload?.[0]?.payload as BessHealthPoint | undefined;
                return entry?.markerSummary ? `${label} · ${entry.markerSummary}` : String(label);
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />

            <ReferenceLine
              y={20}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: '20% Warning',
                fill: '#fbbf24',
                fontSize: 10,
                position: 'insideTopLeft',
              }}
            />
            <ReferenceLine
              y={10}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{
                value: '10% Critical',
                fill: '#f87171',
                fontSize: 10,
                position: 'insideBottomLeft',
              }}
            />

            {markerHours.map((ev) => (
              <ReferenceLine
                key={ev.id}
                x={ev.hourLabel}
                stroke={ev.enabled ? '#34d399' : '#fbbf24'}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: ev.enabled ? 'ECO ON' : 'ECO OFF',
                  fill: ev.enabled ? '#34d399' : '#fbbf24',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="bessChargePct"
              name={t(lang, 'شحن بطارية BESS (%)', 'BESS Charge (%)')}
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#bessHealthSocGrad)"
            />
            <Line
              type="monotone"
              dataKey="healthSohPct"
              name={t(lang, 'صحة البطارية SoH (%)', 'Battery Health SoH (%)')}
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Scatter
              dataKey="ecoOnMarker"
              name={t(lang, 'تشغيل الترشيد (ECO ON)', 'Eco-Conservation ON')}
              fill="#34d399"
            />
            <Scatter
              dataKey="ecoOffMarker"
              name={t(lang, 'إيقاف الترشيد (ECO OFF)', 'Eco-Conservation OFF')}
              fill="#f59e0b"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Eco-Conservation Toggle Log Timeline */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">
          {t(lang, 'سجل تبديلات وضع ترشيد الاستهلاك (Eco-Conservation Markers)', 'Eco-Conservation Toggle Log')}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          {effectiveEvents.slice(-6).map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5"
            >
              <span className={`font-bold ${ev.enabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ev.enabled ? t(lang, 'تفعيل الترشيد', 'ECO ON') : t(lang, 'إيقاف الترشيد', 'ECO OFF')}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono tabular-nums text-slate-300">{ev.timestamp}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono tabular-nums text-cyan-300">{ev.bessAtToggle}% BESS</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
