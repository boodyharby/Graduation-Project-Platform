import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BatteryCharging,
  Bot,
  CheckCircle2,
  Download,
  Gauge,
  Zap,
} from 'lucide-react';
import { Language, ParkingSpot, RobotChargingSessionLog } from '../types/parking';
import { t } from '../data/i18n';

interface RobotChargingLogsSectionProps {
  lang: Language;
  spots: ParkingSpot[];
  logs: RobotChargingSessionLog[];
  onVerifySession?: (logId: string) => void;
  onSimulateBotSession?: (bayId: string) => void;
}

export const RobotChargingLogsSection: React.FC<RobotChargingLogsSectionProps> = ({
  lang,
  spots,
  logs,
  onVerifySession,
  onSimulateBotSession,
}) => {
  const [selectedBayFilter, setSelectedBayFilter] = useState<string>('ALL');
  const [dispatchBayId, setDispatchBayId] = useState<string>(spots[0]?.id || 'A-01');

  const bayOptions = useMemo(() => {
    const unique: Record<string, string> = {};
    logs.forEach((l) => {
      unique[l.bayId] = l.bayLabel;
    });
    spots.forEach((s) => {
      unique[s.id] = s.label;
    });
    return Object.entries(unique).map(([id, label]) => ({ id, label }));
  }, [logs, spots]);

  const filteredLogs = useMemo(() => {
    if (selectedBayFilter === 'ALL') return logs;
    return logs.filter((l) => l.bayId === selectedBayFilter);
  }, [logs, selectedBayFilter]);

  const summary = useMemo(() => {
    const totalDeliveredKwh = Number(
      filteredLogs.reduce((acc, s) => acc + s.energyDeliveredKwh, 0).toFixed(1)
    );
    const totalConsumedKwh = Number(
      filteredLogs.reduce((acc, s) => acc + s.energyConsumedKwh, 0).toFixed(1)
    );
    const avgEfficiencyPct =
      filteredLogs.length > 0
        ? Number(
            (
              filteredLogs.reduce((acc, s) => acc + s.efficiencyPct, 0) / filteredLogs.length
            ).toFixed(1)
          )
        : 0;

    // Aggregate delivered kWh by bay
    const byBay: Record<
      string,
      { bayLabel: string; totalDeliveredKwh: number; totalConsumedKwh: number; sessions: number; effSum: number }
    > = {};
    logs.forEach((l) => {
      if (!byBay[l.bayId]) {
        byBay[l.bayId] = {
          bayLabel: l.bayLabel,
          totalDeliveredKwh: 0,
          totalConsumedKwh: 0,
          sessions: 0,
          effSum: 0,
        };
      }
      byBay[l.bayId].totalDeliveredKwh += l.energyDeliveredKwh;
      byBay[l.bayId].totalConsumedKwh += l.energyConsumedKwh;
      byBay[l.bayId].sessions += 1;
      byBay[l.bayId].effSum += l.efficiencyPct;
    });

    const perBayChartData = Object.values(byBay)
      .map((item) => ({
        bay: item.bayLabel,
        deliveredKwh: Number(item.totalDeliveredKwh.toFixed(1)),
        avgEfficiencyPct: Number((item.effSum / Math.max(1, item.sessions)).toFixed(1)),
        sessions: item.sessions,
      }))
      .sort((a, b) => b.deliveredKwh - a.deliveredKwh);

    const topBay = perBayChartData[0] || null;

    return {
      totalDeliveredKwh,
      totalConsumedKwh,
      avgEfficiencyPct,
      sessionsCount: filteredLogs.length,
      perBayChartData,
      topBay,
    };
  }, [filteredLogs, logs]);

  const handleExportLogsCsv = () => {
    const headers = [
      'Session ID',
      'Robot Name',
      'Bay',
      'Plate',
      'Delivered kWh',
      'Consumed kWh',
      'Efficiency %',
      'Power kW',
      'Duration Min',
      'Completed At',
      'Supervisor Verified',
    ];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.robotName,
      l.bayLabel,
      l.vehiclePlate,
      String(l.energyDeliveredKwh),
      String(l.energyConsumedKwh),
      String(l.efficiencyPct),
      String(l.powerKw),
      String(l.durationMinutes),
      l.completedAt,
      l.supervisorVerified ? 'Verified' : 'Pending',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecocharge-bot-charging-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-[#0D1E2E] p-5 space-y-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-400" />
            <span>
              {t(
                lang,
                'سجلات شحن الروبوت المتنقل وكفاءة الطاقة لكل جلسة (Charging Logs)',
                'EcoCharge Bot Charging Logs & Per-Session Bay Efficiency'
              )}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'تتبع إجمالي الطاقة المسلمة من روبوت EcoCharge Bot إلى المواقف المحددة ومراقبة كفاءة التحويل % لكل جلسة شحن.',
              'Tracks total kWh delivered by the EcoCharge Bot to specific bays and monitors energy transfer efficiency per session.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBayFilter}
            onChange={(e) => setSelectedBayFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-cyan-400"
          >
            <option value="ALL">{t(lang, 'جميع المواقف', 'All Bays')}</option>
            {bayOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {t(lang, `موقف ${b.label}`, `Bay ${b.label}`)}
              </option>
            ))}
          </select>

          {onSimulateBotSession && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08121D] p-1">
              <select
                value={dispatchBayId}
                onChange={(e) => setDispatchBayId(e.target.value)}
                className="bg-transparent px-2 py-1 font-mono text-xs text-white outline-none"
              >
                {spots.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#08121D]">
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onSimulateBotSession(dispatchBayId)}
                className="flex items-center gap-1 rounded-md bg-cyan-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                <Zap className="h-3 w-3" />
                {t(lang, 'تسجيل جلسة EcoCharge', 'Log Robot Session')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportLogsCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            {t(lang, 'تصدير CSV', 'Export CSV')}
          </button>
        </div>
      </div>

      {/* 4 Charging Logs KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'إجمالي الطاقة المسلمة', 'Total Energy Delivered')}</span>
            <BatteryCharging className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-emerald-400">
            {summary.totalDeliveredKwh} kWh
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums">
            {t(lang, 'مسحوب من الروبوت:', 'Robot Drawn:')} {summary.totalConsumedKwh} kWh
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'متوسط كفاءة الجلسات', 'Mean Session Efficiency')}</span>
            <Gauge className="h-4 w-4 text-cyan-400" />
          </div>
          <div
            className={`mt-1.5 font-mono text-2xl font-extrabold tabular-nums ${
              summary.avgEfficiencyPct >= 92
                ? 'text-emerald-400'
                : summary.avgEfficiencyPct >= 86
                  ? 'text-cyan-300'
                  : 'text-amber-300'
            }`}
          >
            {summary.avgEfficiencyPct}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'نسبة الطاقة الواصلة للمركبة', 'Net energy delivered / battery draw')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'عدد جلسات EcoCharge', 'Completed Bot Sessions')}</span>
            <Bot className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-white">
            {summary.sessionsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'المجموع الكلي المسجل', 'Recorded mobile charge deliveries')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'أعلى موقف استهلاكاً للروبوت', 'Top Served Bay')}</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-amber-300">
            {summary.topBay ? `${summary.topBay.bay} (${summary.topBay.deliveredKwh} kWh)` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary.topBay
              ? t(
                  lang,
                  `متوسط الكفاءة: ${summary.topBay.avgEfficiencyPct}%`,
                  `Bay Avg Efficiency: ${summary.topBay.avgEfficiencyPct}%`
                )
              : t(lang, 'بانتظار أول جلسة شحن', 'Awaiting first session')}
          </div>
        </div>
      </div>

      {/* Per-Bay Energy Delivered & Efficiency Chart */}
      {summary.perBayChartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200">
              {t(
                lang,
                'توزيع الطاقة المسلمة من EcoCharge Bot حسب الموقف ومتوسط الكفاءة %',
                'EcoCharge Bot Total Energy Delivered per Bay (kWh) & Efficiency (%)'
              )}
            </span>
            <span className="font-mono text-[11px] text-cyan-400">kWh · %</span>
          </div>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={summary.perBayChartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="bay" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} unit="kWh" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[70, 100]}
                  tick={{ fill: '#38bdf8', fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1724',
                    borderColor: 'rgba(34,211,238,0.4)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="deliveredKwh"
                  name={t(lang, 'الطاقة المسلمة (kWh)', 'Delivered Energy (kWh)')}
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgEfficiencyPct"
                  name={t(lang, 'كفاءة الجلسة %', 'Efficiency %')}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#38bdf8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Session Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-2.5 pe-3 text-start font-semibold">{t(lang, 'الجلسة والروبوت', 'Session / Robot')}</th>
              <th className="py-2.5 pe-3 text-start font-semibold">{t(lang, 'الموقف والمركبة', 'Bay & Plate')}</th>
              <th className="py-2.5 pe-3 text-center font-semibold">{t(lang, 'الطاقة المسلمة / المسحوبة', 'Delivered / Drawn')}</th>
              <th className="py-2.5 pe-3 text-center font-semibold">{t(lang, 'كفاءة الجلسة %', 'Session Efficiency')}</th>
              <th className="py-2.5 pe-3 text-center font-semibold">{t(lang, 'القدرة والمدة', 'Power & Time')}</th>
              <th className="py-2.5 text-end font-semibold">{t(lang, 'مراجعة المشرف', 'Supervisor Check')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {t(
                    lang,
                    'لا توجد جلسات شحن روبوتي مسجلة لهذا الموقف بعد.',
                    'No EcoCharge Bot charging sessions recorded for this bay yet.'
                  )}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const effColor =
                  log.efficiencyPct >= 92
                    ? 'text-emerald-400'
                    : log.efficiencyPct >= 87
                      ? 'text-cyan-300'
                      : 'text-amber-300';
                const effBar =
                  log.efficiencyPct >= 92
                    ? 'bg-emerald-400'
                    : log.efficiencyPct >= 87
                      ? 'bg-cyan-400'
                      : 'bg-amber-400';

                return (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 pe-3">
                      <div className="font-mono font-bold text-white">{log.robotName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{log.completedAt}</div>
                    </td>
                    <td className="py-3 pe-3">
                      <span className="font-mono font-bold text-cyan-300">{log.bayLabel}</span>
                      <span className="mx-1.5 text-slate-500">·</span>
                      <span className="font-mono text-slate-200">{log.vehiclePlate}</span>
                    </td>
                    <td className="py-3 pe-3 text-center font-mono tabular-nums">
                      <span className="font-bold text-emerald-400">{log.energyDeliveredKwh} kWh</span>
                      <span className="text-slate-500"> / {log.energyConsumedKwh} kWh</span>
                    </td>
                    <td className="py-3 pe-3">
                      <div className="mx-auto w-28 space-y-1">
                        <div className={`text-center font-mono font-bold tabular-nums ${effColor}`}>
                          {log.efficiencyPct}%
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className={`h-full rounded-full ${effBar}`} style={{ width: `${log.efficiencyPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pe-3 text-center font-mono tabular-nums text-slate-300">
                      {log.powerKw} kW · {log.durationMinutes} {t(lang, 'د', 'm')}
                    </td>
                    <td className="py-3 text-end">
                      {log.supervisorVerified ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t(lang, 'معتمد', 'Verified')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onVerifySession?.(log.id)}
                          className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                        >
                          {t(lang, 'اعتماد الكفاءة', 'Verify')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
