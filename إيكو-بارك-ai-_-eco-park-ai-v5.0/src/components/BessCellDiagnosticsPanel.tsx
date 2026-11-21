import React, { useMemo, useState } from 'react';
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
import { Activity, BatteryCharging, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { Language, MaintenanceWorkOrder } from '../types/parking';
import { t } from '../data/i18n';

interface BessCellDiagnosticsPanelProps {
  lang: Language;
  bessCharge: number;
  ecoConservation: boolean;
  supervisorName: string;
  onCreateWorkOrder?: (order: MaintenanceWorkOrder) => void;
  onLogAudit?: (actionAr: string, actionEn: string) => void;
  onNotify: (msg: string) => void;
}

interface RackDiagnostics {
  id: string;
  name: string;
  chemistry: string;
  sohPct: number;
  cycleCount: number;
  maxCellTempC: number;
  internalResistanceMohm: number;
  voltageDeltaMv: number;
  estimatedRulYears: number;
}

export const BessCellDiagnosticsPanel: React.FC<BessCellDiagnosticsPanelProps> = ({
  lang,
  bessCharge,
  ecoConservation,
  supervisorName,
  onCreateWorkOrder,
  onLogAudit,
  onNotify,
}) => {
  const [balancingOffsetMv, setBalancingOffsetMv] = useState<number>(0);
  const [lastBalancedAt, setLastBalancedAt] = useState<string | null>(null);

  const racks = useMemo<RackDiagnostics[]>(() => {
    const deepStress = bessCharge < 20 ? 1.8 : 0;
    const ecoBonus = ecoConservation ? -0.4 : 0;
    return [
      {
        id: 'rack-a1',
        name: 'BESS-Rack A1',
        chemistry: 'LFP 480V',
        sohPct: 98.4,
        cycleCount: 412,
        maxCellTempC: Number((31.2 + deepStress + ecoBonus).toFixed(1)),
        internalResistanceMohm: 1.42,
        voltageDeltaMv: Math.max(4, 14 - balancingOffsetMv),
        estimatedRulYears: 9.2,
      },
      {
        id: 'rack-a2',
        name: 'BESS-Rack A2',
        chemistry: 'LFP 480V',
        sohPct: 96.9,
        cycleCount: 498,
        maxCellTempC: Number((33.1 + deepStress + ecoBonus).toFixed(1)),
        internalResistanceMohm: 1.68,
        voltageDeltaMv: Math.max(5, 21 - balancingOffsetMv),
        estimatedRulYears: 8.4,
      },
      {
        id: 'rack-b1',
        name: 'BESS-Rack B1',
        chemistry: 'LFP 480V',
        sohPct: 93.8,
        cycleCount: 684,
        maxCellTempC: Number((36.4 + deepStress + ecoBonus).toFixed(1)),
        internalResistanceMohm: 2.05,
        voltageDeltaMv: Math.max(7, 34 - balancingOffsetMv),
        estimatedRulYears: 6.9,
      },
      {
        id: 'rack-b2',
        name: 'BESS-Rack B2',
        chemistry: 'LFP 480V',
        sohPct: 97.6,
        cycleCount: 445,
        maxCellTempC: Number((32.0 + deepStress + ecoBonus).toFixed(1)),
        internalResistanceMohm: 1.51,
        voltageDeltaMv: Math.max(4, 17 - balancingOffsetMv),
        estimatedRulYears: 8.8,
      },
    ];
  }, [balancingOffsetMv, bessCharge, ecoConservation]);

  const fleetAvgSoh = useMemo(
    () => Number((racks.reduce((a, r) => a + r.sohPct, 0) / racks.length).toFixed(1)),
    [racks]
  );

  const handleRunBalancing = () => {
    setBalancingOffsetMv(18);
    setLastBalancedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    onLogAudit?.(
      'تشغيل معايرة توازن خلايا BESS لجميع وحدات الرفوف',
      'Executed active BESS cell-balancing sweep across battery racks'
    );
    onNotify(
      t(
        lang,
        'تمت معايرة توازن خلايا البطاريات (ΔmV) بنجاح لتمديد العمر الافتراضي.',
        'Active BESS cell voltage balancing completed — cell delta minimized.'
      )
    );
  };

  const handleFlagRack = (rack: RackDiagnostics) => {
    if (!onCreateWorkOrder) return;
    const wo: MaintenanceWorkOrder = {
      id: `WO-BESS-${Math.floor(100 + Math.random() * 899)}`,
      bayId: rack.name,
      issueAr: `فحص تدهور خلايا ${rack.name} (SoH ${rack.sohPct}% · مقاومة ${rack.internalResistanceMohm} mΩ · فرق جهد ${rack.voltageDeltaMv} mV)`,
      issueEn: `Inspect cell degradation on ${rack.name} (SoH ${rack.sohPct}% · ESR ${rack.internalResistanceMohm} mΩ · ΔV ${rack.voltageDeltaMv} mV)`,
      priority: rack.sohPct < 94.5 ? 'high' : 'routine',
      assignee: supervisorName,
      status: 'open',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      autoDetected: false,
    };
    onCreateWorkOrder(wo);
    onNotify(
      t(
        lang,
        `تم إصدار تذكرة صيانة للوحدة ${rack.name} (${wo.id}).`,
        `Issued BESS rack inspection order ${wo.id} for ${rack.name}.`
      )
    );
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BatteryCharging className="h-5 w-5 text-emerald-400" />
            {t(
              lang,
              'تحليلات صحة خلايا بطاريات التخزين وتدهور الأداء (BESS Cell SoH & RUL)',
              'BESS Cell Health, Internal Resistance & Degradation Diagnostics'
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'مراقبة دورات الشحن، عدم اتزان الفولتية (mV)، والمقاومة الداخلية لكل رف مع التنبؤ بالعمر التشغيلي المتبقي.',
              'Monitors cycle depth, voltage imbalance (ΔmV), and cell ESR across LFP battery racks to forecast remaining useful life.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-mono text-slate-300 tabular-nums">
            {t(lang, 'متوسط صحة الأسطول:', 'Fleet SoH:')}{' '}
            <strong className="text-emerald-400">{fleetAvgSoh}%</strong>
            {lastBalancedAt && (
              <span className="text-cyan-300"> · {t(lang, `آخر موازنة ${lastBalancedAt}`, `Balanced ${lastBalancedAt}`)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleRunBalancing}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t(lang, 'معايرة توازن الخلايا ΔV', 'Balance Cell Voltages')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Rack Table / Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {racks.map((rack) => {
            const needsWatch = rack.sohPct < 95 || rack.voltageDeltaMv > 25;
            return (
              <div
                key={rack.id}
                className={`rounded-xl border bg-[#08121D] p-3.5 space-y-2 ${
                  needsWatch ? 'border-amber-400/45' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-white">{rack.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {rack.chemistry} · {rack.cycleCount} {t(lang, 'دورة', 'cycles')}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-base font-extrabold tabular-nums ${
                      needsWatch ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {rack.sohPct}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono tabular-nums">
                  <div>
                    <div className="text-slate-500">{t(lang, 'الحرارة', 'Temp')}</div>
                    <div className="text-slate-200 font-bold">{rack.maxCellTempC}°C</div>
                  </div>
                  <div>
                    <div className="text-slate-500">ΔV</div>
                    <div className={rack.voltageDeltaMv > 25 ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                      {rack.voltageDeltaMv} mV
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">{t(lang, 'العمر المتبقي', 'RUL')}</div>
                    <div className="text-emerald-300 font-bold">{rack.estimatedRulYears}y</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[11px]">
                  <span className="text-slate-400 font-mono">ESR: {rack.internalResistanceMohm} mΩ</span>
                  {onCreateWorkOrder && (
                    <button
                      type="button"
                      onClick={() => handleFlagRack(rack)}
                      className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-semibold"
                    >
                      <Wrench className="h-3 w-3" />
                      {t(lang, 'أمر فحص', 'Inspect')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Chart */}
        <div className="lg:col-span-5 rounded-xl bg-[#08121D] p-3.5 flex flex-col justify-between">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'مقارنة صحة الرفوف SoH (%)', 'Rack State of Health (%)')}
            </span>
            <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-amber-400" />
              {t(lang, 'عتبة التنبيه: 95%', 'Watch: 95%')}
            </span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={racks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[85, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1927',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="sohPct" radius={[6, 6, 0, 0]} name={t(lang, 'صحة الخلايا %', 'SoH %')}>
                  {racks.map((entry) => (
                    <Cell key={entry.id} fill={entry.sohPct < 95 ? '#F59E0B' : '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
