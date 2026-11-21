import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BatteryCharging, Car, Pause, Play, Zap } from 'lucide-react';
import { ChargingRobotState, Language, ParkingSpot } from '../types/parking';
import { t } from '../data/i18n';

interface BayPowerTelemetryChartProps {
  lang: Language;
  spots: ParkingSpot[];
  solarKw: number;
  ecoConservation: boolean;
  chargingRobot?: ChargingRobotState;
  autoLoadBalance?: boolean;
  smartNightActive?: boolean;
  nightPowerReductionPct?: number;
}

export const BayPowerTelemetryChart: React.FC<BayPowerTelemetryChartProps> = ({
  lang,
  spots,
  solarKw,
  ecoConservation,
  chargingRobot,
  autoLoadBalance = true,
  smartNightActive = false,
  nightPowerReductionPct = 40,
}) => {
  const [liveStreaming, setLiveStreaming] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!liveStreaming) return;
    const timer = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1600);
    return () => clearInterval(timer);
  }, [liveStreaming]);

  const bayMetrics = useMemo(() => {
    return spots.map((spot, idx) => {
      const isBusy = spot.status !== 'available';
      const hasRobotHere =
        chargingRobot?.phase === 'charging' && chargingRobot.targetSpotId === spot.id;
      const wave = Math.sin(tick * 0.9 + idx * 1.3);
      const ecoFactor = ecoConservation ? 0.72 : autoLoadBalance ? 0.88 : 1.0;
      const nightFactor = smartNightActive
        ? Math.max(0.35, 1 - Math.max(0, Math.min(65, nightPowerReductionPct)) / 100)
        : 1.0;
      const evNightFactor = smartNightActive ? Math.max(0.7, nightFactor) : 1.0;

      let powerKw = 0;
      if (spot.hasCharger) {
        if (hasRobotHere) {
          powerKw = Math.max(12, Math.round((45 + wave * 3.2) * ecoFactor * evNightFactor * 10) / 10);
        } else if (isBusy) {
          const baseDraw =
            spot.vehicleType === 'ELECTRIC'
              ? spot.chargerKw * 0.68
              : spot.vehicleType === 'HYBRID'
                ? Math.min(22, spot.chargerKw * 0.32)
                : 1.4;
          powerKw = Math.max(0.5, Number(((baseDraw + wave * 2.4) * ecoFactor * evNightFactor).toFixed(2)));
        } else {
          powerKw = Number(((0.45 + Math.abs(wave) * 0.12) * nightFactor).toFixed(2));
        }
      } else {
        // Standard parking bay: LED canopy + ultrasonic/gas sensors + ventilation
        if (isBusy) {
          powerKw = Number(((1.65 + wave * 0.25) * ecoFactor * nightFactor).toFixed(2));
        } else {
          powerKw = Number(((0.28 + Math.abs(wave) * 0.06) * ecoFactor * nightFactor).toFixed(2));
        }
      }

      return {
        id: spot.id,
        label: spot.label,
        isEvCharger: spot.hasCharger,
        status: spot.status,
        plate: spot.vehiclePlate,
        hasRobotHere,
        powerKw,
        categoryLabel: spot.hasCharger
          ? t(lang, 'موقف شحن كهربائي ⚡', 'EV Charging Bay ⚡')
          : t(lang, 'موقف عادي 🅿️', 'Standard Bay 🅿️'),
      };
    });
  }, [spots, tick, ecoConservation, chargingRobot, autoLoadBalance, smartNightActive, nightPowerReductionPct, lang]);

  const totals = useMemo(() => {
    const evKw = bayMetrics
      .filter((b) => b.isEvCharger)
      .reduce((acc, b) => acc + b.powerKw, 0);
    const stdKw = bayMetrics
      .filter((b) => !b.isEvCharger)
      .reduce((acc, b) => acc + b.powerKw, 0);
    const totalKw = evKw + stdKw;
    const netGridKw = Math.max(0, totalKw - solarKw);
    return {
      evKw: Number(evKw.toFixed(1)),
      stdKw: Number(stdKw.toFixed(1)),
      totalKw: Number(totalKw.toFixed(1)),
      netGridKw: Number(netGridKw.toFixed(1)),
    };
  }, [bayMetrics, solarKw]);

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-[#0D1E2E] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {t(
                lang,
                'الاستهلاك اللحظي للطاقة لكل موقف ذكي (شحن كهربائي مقابل عادي)',
                'Real-Time Per-Bay Power Telemetry (EV Chargers vs Standard Bays)'
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                  liveStreaming
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    liveStreaming ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'
                  }`}
                />
                {liveStreaming ? t(lang, 'مباشر', 'LIVE') : t(lang, 'متوقف', 'PAUSED')}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                lang,
                'تحديث لحظي كل 1.6 ثانية يميز بين مواقف الشحن السريع (سماوي/أخضر) والمواقف العادية (كهرماني).',
                'Moment-by-moment 1.6s stream separating EV charging pedestals (cyan/emerald) from standard bays (amber).'
              )}
              {smartNightActive && (
                <span className="ms-2 font-mono font-semibold text-indigo-300 tabular-nums">
                  · {t(lang, `الوضع الليلي الذكي (-${nightPowerReductionPct}%)`, `Smart Night (-${nightPowerReductionPct}%)`)}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLiveStreaming((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#08121D] px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-cyan-400/50"
        >
          {liveStreaming ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
          {liveStreaming ? t(lang, 'إيقاف التحديث مؤقتاً', 'Pause Stream') : t(lang, 'استئناف البث اللحظي', 'Resume Stream')}
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-cyan-500/30 bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'حمل مواقف الشحن الكهربائي', 'EV Charging Bays Load')}</span>
            <BatteryCharging className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-cyan-400 tabular-nums">
            {totals.evKw} kW
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'حمل المواقف العادية', 'Standard Bays Load')}</span>
            <Car className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
            {totals.stdKw} kW
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'إجمالي استهلاك الساحة', 'Total Lot Demand')}</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-white tabular-nums">
            {totals.totalKw} kW
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(lang, 'صافي السحب بعد الطاقة الشمسية', 'Net Grid Draw After Solar')}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
            {totals.netGridKw} kW
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
          <span className="h-3 w-3 rounded bg-cyan-400 inline-block" />
          {t(lang, 'موقف شحن كهربائي نشط', 'Active EV Charger')}
        </span>
        <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
          <span className="h-3 w-3 rounded bg-emerald-500 inline-block" />
          {t(lang, 'موقف شحن كهربائي متاح (استعداد)', 'Idle EV Charger')}
        </span>
        <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
          <span className="h-3 w-3 rounded bg-amber-400 inline-block" />
          {t(lang, 'موقف عادي (إنارة وحساسات)', 'Standard Bay (LED & Sensors)')}
        </span>
      </div>

      {/* Recharts Live Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bayMetrics} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A52" />
            <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} unit=" kW" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#08121D',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '10px',
                fontSize: '12px',
              }}
              formatter={(value, _name, item) => {
                const payload = item?.payload as { categoryLabel?: string; plate?: string } | undefined;
                const extra = payload?.plate ? ` · ${payload.plate}` : '';
                return [`${value ?? 0} kW`, `${payload?.categoryLabel || ''}${extra}`];
              }}
            />
            <Bar dataKey="powerKw" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {bayMetrics.map((entry) => {
                const fill = entry.isEvCharger
                  ? entry.status !== 'available' || entry.hasRobotHere
                    ? '#22D3EE'
                    : '#10B981'
                  : entry.status !== 'available'
                    ? '#F59E0B'
                    : '#64748B';
                return <Cell key={entry.id} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-bay compact telemetry badges */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {bayMetrics.map((b) => (
          <div
            key={b.id}
            className={`rounded-lg border px-3 py-2 text-xs ${
              b.isEvCharger
                ? 'border-cyan-500/35 bg-cyan-950/20'
                : 'border-amber-500/25 bg-amber-950/15'
            }`}
          >
            <div className="flex items-center justify-between font-mono font-bold">
              <span className="text-white">
                {b.label} {b.isEvCharger ? '⚡' : '🅿️'}
              </span>
              <span className={b.isEvCharger ? 'text-cyan-300' : 'text-amber-300'}>
                {b.powerKw} kW
              </span>
            </div>
            <div className="mt-0.5 truncate text-[10px] text-slate-400">
              {b.hasRobotHere
                ? t(lang, 'شحن بالروبوت', 'Robot Charging')
                : b.plate || (b.isEvCharger ? t(lang, 'شاحن ذكي', 'EV Charger') : t(lang, 'موقف عادي', 'Standard'))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
