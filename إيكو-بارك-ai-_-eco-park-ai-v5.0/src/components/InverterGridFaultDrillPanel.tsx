import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  PowerOff,
  RotateCcw,
  ShieldCheck,
  ZapOff,
} from 'lucide-react';
import { GridFaultDrillLog, Language, MaintenanceWorkOrder } from '../types/parking';
import { t } from '../data/i18n';
import { playBessCriticalSiren, stopAllAlarms } from '../utils/ecoEngine';

interface InverterGridFaultDrillPanelProps {
  lang: Language;
  solarKw: number;
  bessCharge: number;
  supervisorName: string;
  onAdjustSolarKw: (kw: number) => void;
  onAdjustBessCharge: (pct: number) => void;
  onCreateWorkOrder?: (order: MaintenanceWorkOrder) => void;
  onLogAudit?: (actionAr: string, actionEn: string) => void;
  onNotify: (msg: string) => void;
}

type FaultScenarioId = GridFaultDrillLog['scenarioId'];

export const InverterGridFaultDrillPanel: React.FC<InverterGridFaultDrillPanelProps> = ({
  lang,
  solarKw,
  bessCharge,
  supervisorName,
  onAdjustSolarKw,
  onAdjustBessCharge,
  onCreateWorkOrder,
  onLogAudit,
  onNotify,
}) => {
  const [activeFault, setActiveFault] = useState<FaultScenarioId | null>(null);
  const [preFaultSolarKw, setPreFaultSolarKw] = useState<number>(solarKw);
  const [faultStartedMs, setFaultStartedMs] = useState<number>(0);
  const [failoverLatencyMs, setFailoverLatencyMs] = useState<number>(14);
  const [logs, setLogs] = useState<GridFaultDrillLog[]>([
    {
      id: 'gf-init-1',
      scenarioId: 'grid_blackout_island',
      scenarioAr: 'انقطاع الشبكة الرئيسية — عزل تلقائي لـ BESS',
      scenarioEn: 'Main Grid Blackout — BESS Islanding Transfer',
      failoverMs: 13,
      islandRuntimeHours: 14.5,
      restoredAt: '09:15',
      grade: 'A+',
    },
  ]);

  const islandRuntimeHours = useMemo(() => {
    const usableKwh = (bessCharge / 100) * 420;
    const baseCriticalLoadKw = activeFault === 'grid_blackout_island' ? 24 : 18;
    return Number((usableKwh / Math.max(10, baseCriticalLoadKw)).toFixed(1));
  }, [activeFault, bessCharge]);

  const triggerFault = (scenarioId: FaultScenarioId) => {
    setPreFaultSolarKw(solarKw > 20 ? solarKw : 180);
    setActiveFault(scenarioId);
    setFaultStartedMs(Date.now());
    const reactionMs =
      scenarioId === 'grid_blackout_island' ? 12 : scenarioId === 'pv_inverter_trip' ? 18 : 22;
    setFailoverLatencyMs(reactionMs);

    if (scenarioId === 'pv_inverter_trip') {
      onAdjustSolarKw(Math.max(15, Math.round(solarKw * 0.48)));
      onNotify(
        t(
          lang,
          'اختبار عطل عاكس PV #1: تم عزل السلسلة المصابة وتحويل الفارق إلى BESS خلال 18 مللي ثانية!',
          'PV Inverter #1 Trip Drill: Isolated faulted string and transferred deficit to BESS in 18 ms!'
        )
      );
    } else if (scenarioId === 'grid_blackout_island') {
      playBessCriticalSiren();
      onAdjustBessCharge(Math.max(12, bessCharge - 4));
      onNotify(
        t(
          lang,
          `وضع العزل المستقل (Islanding Mode): البوابات والرادار والشواحن الحرجة تعمل على BESS لمدة ${islandRuntimeHours} ساعة!`,
          `Grid Blackout Islanding Active: Gate ANPR, safety radar & essential EV bays sustained for ${islandRuntimeHours}h!`
        )
      );
    } else {
      onAdjustSolarKw(Math.max(30, Math.round(solarKw * 0.65)));
      onNotify(
        t(
          lang,
          'اختبار ارتفاع حرارة المحول (>85°C): تم تخفيض حمل الشواحن السريعة DC تلقائياً لحماية الشبكة.',
          'Transformer Overheat Drill (>85°C): Auto-throttled DC fast chargers to stabilize core temperature.'
        )
      );
    }

    onLogAudit?.(
      `تشغيل اختبار صمود الشبكة/العاكس (${scenarioId}) بزمن تحويل ${reactionMs}ms`,
      `Launched inverter/grid fault resilience drill (${scenarioId}) with ${reactionMs}ms transfer`
    );
  };

  const restoreNormalGrid = (createTicket = false) => {
    if (!activeFault) return;
    stopAllAlarms();
    const elapsedSec = Math.max(1, Math.round((Date.now() - faultStartedMs) / 1000));
    const names: Record<FaultScenarioId, { ar: string; en: string }> = {
      pv_inverter_trip: {
        ar: 'عطل عاكس PV رقم 1 وتحويل الأحمال',
        en: 'PV Inverter #1 String Trip & Failover',
      },
      grid_blackout_island: {
        ar: 'انقطاع الشبكة الرئيسية — عزل مستقل BESS',
        en: 'Main Grid Blackout — BESS Islanding Mode',
      },
      transformer_overheat: {
        ar: 'ارتفاع حرارة المحول الرئيسي وتقنين الحمل',
        en: 'Transformer Overheat & Dynamic Load Shedding',
      },
    };

    const entry: GridFaultDrillLog = {
      id: `gf-${Date.now()}`,
      scenarioId: activeFault,
      scenarioAr: names[activeFault].ar,
      scenarioEn: names[activeFault].en,
      failoverMs: failoverLatencyMs,
      islandRuntimeHours,
      restoredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      grade: elapsedSec <= 30 ? 'A+' : 'A',
    };

    setLogs((prev) => [entry, ...prev].slice(0, 6));
    onAdjustSolarKw(preFaultSolarKw);

    if (createTicket && onCreateWorkOrder) {
      onCreateWorkOrder({
        id: `WO-INV-${Math.floor(100 + Math.random() * 899)}`,
        bayId: 'INVERTER-GRID',
        issueAr: `تقرير اختبار العطل (${names[activeFault].ar}) — فحص قواطع التحويل السريع (${failoverLatencyMs}ms)`,
        issueEn: `Fault drill follow-up (${names[activeFault].en}) — verify ATS breaker (${failoverLatencyMs}ms)`,
        priority: 'high',
        assignee: supervisorName,
        status: 'open',
        createdAt: entry.restoredAt,
        autoDetected: true,
      });
    }

    setActiveFault(null);
    onLogAudit?.(
      `استعادة الشبكة بعد اختبار الصمود (${entry.scenarioAr}) بتقييم ${entry.grade}`,
      `Restored grid synchronization after ${entry.scenarioEn} (Grade ${entry.grade})`
    );
    onNotify(
      t(
        lang,
        `تمت استعادة التزامن مع الشبكة الرئيسية بنجاح (تقييم الاستجابة ${entry.grade}).`,
        `Grid synchronization restored smoothly (Response Grade ${entry.grade}).`
      )
    );
  };

  return (
    <div
      className={`rounded-xl border bg-[#0D1E2E] p-5 space-y-4 transition ${
        activeFault ? 'border-red-500/70' : 'border-white/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className={`h-5 w-5 ${activeFault ? 'text-red-400' : 'text-cyan-400'}`} />
            {t(
              lang,
              'محاكي حوادث الأعطال الفجائية في العاكس والمحول الكهربائي (Grid/Inverter Fault Drill)',
              'Inverter Trip & Main Grid Blackout Failover Simulator'
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'اختبر قدرة الموقف على التحول اللحظي إلى نظام الجزيرة المستقلة (BESS Islanding) دون انقطاع بوابات ANPR أو الشواحن الحرجة.',
              'Tests automatic microgrid islanding transfer speed to BESS when a PV inverter trips, utility grid drops, or transformer overheats.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-slate-300">
            {t(lang, 'استقلالية BESS المتوقعة:', 'Island Autonomy:')}{' '}
            <strong className="text-emerald-400">{islandRuntimeHours}h</strong>
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-cyan-300">ATS: {failoverLatencyMs}ms</span>
        </div>
      </div>

      {/* Fault Scenario Trigger Buttons */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => triggerFault('pv_inverter_trip')}
          className={`flex items-start gap-3 rounded-xl border p-3.5 text-start transition ${
            activeFault === 'pv_inverter_trip'
              ? 'border-amber-400 bg-amber-500/15'
              : 'border-white/10 bg-[#08121D] hover:border-amber-400/50'
          }`}
        >
          <ZapOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white">
              {t(lang, 'محاكاة خروج عاكس شمسي #1', 'Simulate PV Inverter #1 Trip')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {t(lang, 'فقدان 52% من التوليد الشمسي وتعويض فوري من BESS', 'Cuts PV array 52% & shifts deficit to BESS')}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerFault('grid_blackout_island')}
          className={`flex items-start gap-3 rounded-xl border p-3.5 text-start transition ${
            activeFault === 'grid_blackout_island'
              ? 'border-red-500 bg-red-500/20'
              : 'border-white/10 bg-[#08121D] hover:border-red-400/50'
          }`}
        >
          <PowerOff className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white">
              {t(lang, 'اختبار انقطاع الشبكة العامة (عزل)', 'Simulate Grid Blackout (Islanding)')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {t(lang, 'تشغيل البوابات والمواقف 100% على BESS والعاكس', 'Isolates hub to 100% autonomous BESS microgrid')}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerFault('transformer_overheat')}
          className={`flex items-start gap-3 rounded-xl border p-3.5 text-start transition ${
            activeFault === 'transformer_overheat'
              ? 'border-orange-400 bg-orange-500/15'
              : 'border-white/10 bg-[#08121D] hover:border-orange-400/50'
          }`}
        >
          <Flame className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white">
              {t(lang, 'اختبار ارتفاع حرارة المحول >85°C', 'Simulate Transformer Overheat')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {t(lang, 'تخفيف حمل الشحن السريع DC تلقائياً وحماية المعدات', 'Auto load-shedding on high-kW DC bays')}
            </div>
          </div>
        </button>
      </div>

      {/* Active Failover Banner */}
      {activeFault ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5 text-red-100">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <div className="font-bold">
                {t(
                  lang,
                  `حالة طوارئ محاكاة نشطة — زمن التحويل الفعلي إلى BESS: ${failoverLatencyMs} مللي ثانية`,
                  `Active Failover Drill — Seamless ATS Switch to BESS completed in ${failoverLatencyMs}ms`
                )}
              </div>
              <div className="text-red-200/80">
                {t(
                  lang,
                  'البوابات الذكية وكاميرات ANPR ونظام الإنذار مستقرة تماماً دون انقطاع.',
                  'Gate ANPR cameras, fire radar, and priority EV bays kept 100% online.'
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onCreateWorkOrder && (
              <button
                type="button"
                onClick={() => restoreNormalGrid(true)}
                className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 font-bold text-amber-200 hover:bg-amber-500/30"
              >
                {t(lang, 'استعادة + فتح تذكرة صيانة', 'Restore & Open Ticket')}
              </button>
            )}
            <button
              type="button"
              onClick={() => restoreNormalGrid(false)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 font-extrabold text-slate-950 hover:bg-emerald-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t(lang, 'استعادة الشبكة وتوثيق الاختبار', 'Restore Grid & Log Drill')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            {t(
              lang,
              'الشبكة الرئيسية والعاكسات الشمسية متزامنة بشكل طبيعي · قاطع التحويل ATS جاهز (12-18ms)',
              'Utility grid & PV inverters synchronized nominally · Static ATS transfer ready (12-18ms)'
            )}
          </span>
          <span className="font-mono font-bold text-emerald-300">GRID SYNC OK</span>
        </div>
      )}

      {/* Recorded Drill Results */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {logs.slice(0, 4).map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#08121D] px-3.5 py-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">
                  {lang === 'ar' ? l.scenarioAr : l.scenarioEn}
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {l.failoverMs}ms · {l.islandRuntimeHours}h BESS · {l.restoredAt}
                </div>
              </div>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono font-extrabold text-emerald-300 shrink-0">
              {l.grade}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
