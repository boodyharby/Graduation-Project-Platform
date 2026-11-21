import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock, MailCheck, ShieldAlert } from 'lucide-react';
import { Language, SupervisorAlertIncident } from '../types/parking';
import { t } from '../data/i18n';

interface SupervisorAlertMonitorProps {
  lang: Language;
  bessCharge: number;
  smokeAlert: boolean;
  incidents: SupervisorAlertIncident[];
  onSimulateBessUnder10: () => void;
  onToggleSmokeAlert: () => void;
  onSimulateFiveMinEscalation: (alertType: 'SMOKE_RADAR' | 'BESS_UNDER_10') => void;
}

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const SupervisorAlertMonitor: React.FC<SupervisorAlertMonitorProps> = ({
  lang,
  bessCharge,
  smokeAlert,
  incidents,
  onSimulateBessUnder10,
  onToggleSmokeAlert,
  onSimulateFiveMinEscalation,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeSmokeIncident = incidents.find(
    (i) => i.alertType === 'SMOKE_RADAR' && i.status !== 'resolved'
  );
  const activeBessIncident = incidents.find(
    (i) => i.alertType === 'BESS_UNDER_10' && i.status !== 'resolved'
  );

  const FIVE_MIN_MS = 5 * 60 * 1000;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-400" />
            {t(
              lang,
              'مراقب تصعيد البريد الإلكتروني للمشرفين (Firebase Cloud Functions)',
              'Supervisor Email Escalation Monitor (Firebase Cloud Functions)'
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'يرسل تنبيهاً فورياً عبر البريد للمشرفين عند استمرار إنذار رادار السلامة أو هبوط BESS دون 10% لأكثر من 5 دقائق.',
              'Dispatches automated supervisor email alerts when Safety Radar or BESS < 10% persists for over 5 minutes.'
            )}
          </p>
        </div>
        <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300">
          Cloud Functions v2 · 5m SLA
        </span>
      </div>

      {/* Live 2-Channel Escalation Trackers */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* 1. AI Safety Sentry Radar */}
        <div
          className={`rounded-xl border p-4 space-y-2.5 transition ${
            smokeAlert
              ? 'eco-siren-strobe border-red-500/70 bg-red-950/40'
              : 'border-white/10 bg-[#08121D]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <ShieldAlert className={`h-4 w-4 ${smokeAlert ? 'text-red-400' : 'text-emerald-400'}`} />
              {t(lang, 'حالة رادار السلامة والدخان', 'AI Safety Sentry Radar')}
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                smokeAlert ? 'text-red-300' : 'text-emerald-400'
              }`}
            >
              {smokeAlert ? t(lang, 'إنذار نشط', 'ACTIVE') : t(lang, 'مستقر', 'CLEAR')}
            </span>
          </div>

          {smokeAlert && activeSmokeIncident ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  {t(lang, 'المتبقي للإرسال التلقائي:', 'Email escalation in:')}
                </span>
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {activeSmokeIncident.status === 'escalated'
                    ? t(lang, 'تم التصعيد (+5 د)', 'ESCALATED (>=5m)')
                    : formatCountdown(FIVE_MIN_MS - (nowMs - activeSmokeIncident.startedAtMs))}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-950/70">
                <div
                  className="eco-energy-shimmer h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                  style={{
                    width: `${
                      activeSmokeIncident.status === 'escalated'
                        ? 100
                        : Math.min(
                            100,
                            Math.max(4, ((nowMs - activeSmokeIncident.startedAtMs) / FIVE_MIN_MS) * 100)
                          )
                    }%`,
                  }}
                />
              </div>
              {activeSmokeIncident.status !== 'escalated' && (
                <button
                  type="button"
                  onClick={() => onSimulateFiveMinEscalation('SMOKE_RADAR')}
                  className="w-full rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                >
                  {t(lang, 'محاكاة استمرار 5 دقائق ← تصعيد البريد', 'Fast-Forward >5m Escalation Test')}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleSmokeAlert}
              className="w-full rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
            >
              {t(lang, 'تفعيل إنذار رادار السلامة للاختبار', 'Trigger Safety Radar Test')}
            </button>
          )}
        </div>

        {/* 2. BESS < 10% Emergency Tracker */}
        <div
          className={`rounded-xl border p-4 space-y-2.5 transition ${
            bessCharge < 10
              ? 'eco-siren-strobe border-red-500/70 bg-red-950/40'
              : 'border-white/10 bg-[#08121D]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              {t(lang, 'مراقبة انخفاض BESS دون 10%', 'BESS Critical Drop (< 10%)')}
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                bessCharge < 10 ? 'text-red-300' : 'text-emerald-400'
              }`}
            >
              {bessCharge}%
            </span>
          </div>

          {bessCharge < 10 && activeBessIncident ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  {t(lang, 'المتبقي لإرسال البريد:', 'Email escalation in:')}
                </span>
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {activeBessIncident.status === 'escalated'
                    ? t(lang, 'تم التصعيد (+5 د)', 'ESCALATED (>=5m)')
                    : formatCountdown(FIVE_MIN_MS - (nowMs - activeBessIncident.startedAtMs))}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-950/70">
                <div
                  className="eco-energy-shimmer h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                  style={{
                    width: `${
                      activeBessIncident.status === 'escalated'
                        ? 100
                        : Math.min(
                            100,
                            Math.max(4, ((nowMs - activeBessIncident.startedAtMs) / FIVE_MIN_MS) * 100)
                          )
                    }%`,
                  }}
                />
              </div>
              {activeBessIncident.status !== 'escalated' && (
                <button
                  type="button"
                  onClick={() => onSimulateFiveMinEscalation('BESS_UNDER_10')}
                  className="w-full rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                >
                  {t(lang, 'محاكاة استمرار 5 دقائق ← تصعيد البريد', 'Fast-Forward >5m Escalation Test')}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSimulateBessUnder10}
              className="w-full rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              {t(lang, 'محاكاة BESS = 8% (< 10%)', 'Simulate BESS 8% (< 10%)')}
            </button>
          )}
        </div>
      </div>

      {/* Firestore Synced Cloud Functions Alert Log */}
      {incidents.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <div className="text-xs font-semibold text-slate-300">
            {t(lang, 'سجل تنبيهات Cloud Functions (Firestore)', 'Cloud Functions Incident Log')}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {incidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#08121D] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {inc.status === 'resolved' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <MailCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <span className="truncate text-slate-200">
                    {lang === 'ar' ? inc.summaryAr : inc.summaryEn}
                  </span>
                </div>
                <span
                  className={`font-mono text-[10px] font-bold uppercase ${
                    inc.status === 'escalated'
                      ? 'text-red-300'
                      : inc.status === 'resolved'
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                  }`}
                >
                  {inc.status}
                  {inc.emailDispatched ? ' · EMAIL SENT' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
