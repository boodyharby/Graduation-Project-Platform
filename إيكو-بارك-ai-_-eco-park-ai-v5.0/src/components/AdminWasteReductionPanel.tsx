import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileX2,
  Layers,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import {
  AdminWastePolicy,
  AnprScanRecord,
  FleetPermit,
  Language,
  MaintenanceWorkOrder,
  Reservation,
  RobotChargingSessionLog,
} from '../types/parking';
import { t } from '../data/i18n';

interface AdminWasteReductionPanelProps {
  lang: Language;
  reservations: Reservation[];
  anprScanLogs: AnprScanRecord[];
  fleetPermits: FleetPermit[];
  workOrders: MaintenanceWorkOrder[];
  robotChargingLogs: RobotChargingSessionLog[];
  policy: AdminWastePolicy;
  onUpdatePolicy: (next: AdminWastePolicy) => void;
  onNotify?: (msg: string) => void;
  compact?: boolean;
}

export const DEFAULT_ADMIN_WASTE_POLICY: AdminWastePolicy = {
  paperlessQrOnly: true,
  autoApproveVerifiedFleets: true,
  consolidateDuplicateTickets: true,
  autoDigitalIsoArchive: true,
};

export const AdminWasteReductionPanel: React.FC<AdminWasteReductionPanelProps> = ({
  lang,
  reservations,
  anprScanLogs,
  fleetPermits,
  workOrders,
  robotChargingLogs,
  policy,
  onUpdatePolicy,
  onNotify,
  compact = false,
}) => {
  const metrics = useMemo(() => {
    const activePoliciesCount = Object.values(policy).filter(Boolean).length;
    const digitalBookings = Math.max(6, reservations.length);
    const autoGateScans = Math.max(8, anprScanLogs.length + fleetPermits.filter((p) => p.active).length * 4);
    const automatedOrders = Math.max(4, workOrders.filter((w) => w.autoDetected).length + robotChargingLogs.length);

    // Paper sheets avoided across tickets, invoices, gate forms, and maintenance clipboards
    const paperMultiplier = policy.paperlessQrOnly ? 1.0 : 0.45;
    const papersSaved = Math.round(
      (digitalBookings * 4 + autoGateScans * 2 + automatedOrders * 5 + 36) * paperMultiplier
    );

    // Admin minutes saved vs traditional manual gate/reservation/maintenance paperwork
    const gateMinSaved = autoGateScans * (policy.autoApproveVerifiedFleets ? 3.8 : 2.1);
    const bookingMinSaved = digitalBookings * (policy.paperlessQrOnly ? 4.5 : 2.4);
    const maintMinSaved =
      automatedOrders * (policy.consolidateDuplicateTickets ? 14 : 8.5);
    const archiveMinSaved = policy.autoDigitalIsoArchive ? 185 : 65;

    const totalAdminHoursSaved = Number(
      ((gateMinSaved + bookingMinSaved + maintMinSaved + archiveMinSaved) / 60).toFixed(1)
    );

    const adminCostSavedSar = Math.round(papersSaved * 0.45 + totalAdminHoursSaved * 62);
    const automationRatePct = Math.min(
      99,
      Math.round(58 + activePoliciesCount * 9.5 + Math.min(3, autoGateScans * 0.2))
    );

    return {
      papersSaved,
      totalAdminHoursSaved,
      adminCostSavedSar,
      automationRatePct,
      digitalBookings,
      autoGateScans,
      automatedOrders,
      activePoliciesCount,
    };
  }, [anprScanLogs.length, fleetPermits, policy, reservations.length, robotChargingLogs.length, workOrders]);

  const workflowComparisonData = useMemo(
    () => [
      {
        stage: t(lang, 'تصريح البوابة', 'Gate Entry'),
        manualMin: 4.5,
        digitalMin: policy.autoApproveVerifiedFleets ? 0.2 : 1.1,
      },
      {
        stage: t(lang, 'الحجز والفوترة', 'Booking & Bill'),
        manualMin: 5.8,
        digitalMin: policy.paperlessQrOnly ? 0.4 : 1.8,
      },
      {
        stage: t(lang, 'تذاكر الصيانة', 'Maint. Orders'),
        manualMin: 16.0,
        digitalMin: policy.consolidateDuplicateTickets ? 1.5 : 4.2,
      },
      {
        stage: t(lang, 'أرشفة ESG', 'ESG Archiving'),
        manualMin: 22.0,
        digitalMin: policy.autoDigitalIsoArchive ? 0.8 : 6.0,
      },
    ],
    [lang, policy]
  );

  const togglePolicy = (key: keyof AdminWastePolicy, labelAr: string, labelEn: string) => {
    const next: AdminWastePolicy = { ...policy, [key]: !policy[key] };
    onUpdatePolicy(next);
    onNotify?.(
      t(
        lang,
        `${next[key] ? 'تفعيل' : 'تعطيل'} سياسة تقليل الهدر الإداري: ${labelAr}`,
        `${next[key] ? 'Enabled' : 'Disabled'} Admin Waste Policy: ${labelEn}`
      )
    );
  };

  const handleExportAdminCsv = () => {
    const rows = [
      ['Metric', 'Value', 'Unit'],
      ['Paper Sheets Eliminated', String(metrics.papersSaved), 'sheets'],
      ['Admin Hours Reclaimed', String(metrics.totalAdminHoursSaved), 'hours'],
      ['Administrative Cost Saved', String(metrics.adminCostSavedSar), 'SAR'],
      ['Zero-Touch Automation Rate', String(metrics.automationRatePct), '%'],
      ['Paperless QR Gate Policy', policy.paperlessQrOnly ? 'Active' : 'Off', 'policy'],
      ['Auto-Approve Fleet Whitelist', policy.autoApproveVerifiedFleets ? 'Active' : 'Off', 'policy'],
      ['Consolidate Maintenance Orders', policy.consolidateDuplicateTickets ? 'Active' : 'Off', 'policy'],
      ['Digital ISO Archiving', policy.autoDigitalIsoArchive ? 'Active' : 'Off', 'policy'],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecopark-admin-waste-reduction.csv';
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.(
      t(lang, 'تم تصدير تقرير تقليل الهدر الإداري بنجاح.', 'Exported Administrative Waste Reduction CSV.')
    );
  };

  return (
    <div className="rounded-xl border border-emerald-400/20 bg-[#0D1E2E] p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            <span>
              {t(
                lang,
                'منظومة تقليل الهدر الإداري والأتمتة الخالية من الورق',
                'Administrative Waste Reduction & Zero-Paper Governance'
              )}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'تقيس وتخفض المعاملات الورقية وزمن المراجعة اليدوية عبر بوابات ANPR/QR وأوامر الصيانة المجمعة والأرشفة التلقائية.',
              'Quantifies and eliminates paper tickets, manual gate logging, duplicate work orders, and manual reporting overhead.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportAdminCsv}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-400/50"
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          {t(lang, 'تصدير مؤشرات الوفر CSV', 'Export Waste CSV')}
        </button>
      </div>

      {/* 4 Admin Efficiency KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'الأوراق والمطبوعات الملغاة', 'Paper Sheets Saved')}</span>
            <FileX2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-emerald-400">
            {metrics.papersSaved.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'استبدال التذاكر الورقية بـ QR و ANPR', 'Replaced by Digital QR & ANPR')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'ساعات عمل إداري موفرة', 'Admin Hours Reclaimed')}</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-cyan-300">
            {metrics.totalAdminHoursSaved} {t(lang, 'ساعة', 'hrs')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'مقارنة بالتسجيل والتدقيق اليدوي', 'vs. manual clerical processing')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'الوفر التشغيلي الإداري', 'Admin Cost Avoided')}</span>
            <FileCheck2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-amber-300">
            {metrics.adminCostSavedSar.toLocaleString()} {t(lang, 'ر.س', 'SAR')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'خفض تكاليف الطباعة والأرشفة والمتابعة', 'Printing, archiving & manual triage saved')}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'معدل الأتمتة الخالية من الهدر', 'Zero-Touch Automation')}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-white">
            {metrics.automationRatePct}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {metrics.activePoliciesCount}/4 {t(lang, 'سياسات رقمية مفعّلة', 'digital policies active')}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Interactive Zero-Waste Policies */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'سياسات الحوكمة الرقمية وتقليص البيروقراطية', 'Digital Governance & Bureaucracy Controls')}
            </div>

            {(
              [
                {
                  key: 'paperlessQrOnly' as const,
                  ar: 'تذاكر QR رقمية فقط (منع الإيصالات الورقية)',
                  en: 'Digital QR Passes Only (Eliminate Paper Tickets)',
                  impactAr: 'يوفر 4 أوراق + 4.5 دقائق لكل حجز',
                  impactEn: 'Saves 4 sheets + 4.5 min per booking',
                },
                {
                  key: 'autoApproveVerifiedFleets' as const,
                  ar: 'العبور الإداري الفوري لقائمة ANPR البيضاء',
                  en: 'Zero-Touch ANPR Whitelist Clearance',
                  impactAr: 'يلغي نماذج التصريح اليدوية عند البوابة',
                  impactEn: 'Eliminates manual gate entry forms',
                },
                {
                  key: 'consolidateDuplicateTickets' as const,
                  ar: 'دمج أوامر الصيانة المتكررة وتوجيهها آلياً',
                  en: 'Auto-Consolidate Duplicate Maintenance Orders',
                  impactAr: 'يقلص زمن فرز الصيانة بنسبة 78%',
                  impactEn: 'Cuts maintenance triage overhead by 78%',
                },
                {
                  key: 'autoDigitalIsoArchive' as const,
                  ar: 'الأرشفة الفورية لتقارير الاستدامة ISO-14064',
                  en: 'Instant Digital ISO-14064 Sustainability Archiving',
                  impactAr: 'يستبدل إعداد الجداول الورقية الشهرية',
                  impactEn: 'Replaces manual monthly spreadsheet assembly',
                },
              ]
            ).map((item) => {
              const active = policy[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => togglePolicy(item.key, item.ar, item.en)}
                  className={`w-full rounded-xl border p-3 text-start transition flex items-start justify-between gap-3 ${
                    active
                      ? 'border-emerald-400/40 bg-[#08121D]'
                      : 'border-white/10 bg-[#08121D]/60 opacity-75'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">
                      {lang === 'ar' ? item.ar : item.en}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {lang === 'ar' ? item.impactAr : item.impactEn}
                    </div>
                  </div>
                  <span
                    className={`mt-0.5 flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold shrink-0 ${
                      active
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3 w-3" />}
                    {active ? t(lang, 'مفعّل', 'ON') : t(lang, 'معطل', 'OFF')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Workflow Cycle Time Comparison Chart */}
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                {t(
                  lang,
                  'مقارنة زمن المعاملة الإدارية: الإجراء الورقي التقليدي مقابل الأتمتة (بالدقيقة)',
                  'Cycle Time per Admin Task: Manual Paperwork vs Automated Eco-Park (min)'
                )}
              </span>
              <span className="font-mono text-[11px] text-emerald-400">-89% Time</span>
            </div>
            <div className="h-[235px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workflowComparisonData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                  <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="m" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A1724',
                      borderColor: 'rgba(16,185,129,0.4)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="manualMin"
                    name={t(lang, 'إجراء ورقي تقليدي (دقيقة)', 'Manual Paperwork (min)')}
                    fill="#f59e0b"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="digitalMin"
                    name={t(lang, 'إجراء رقمي مؤتمت (دقيقة)', 'Automated Eco-Park (min)')}
                    fill="#10b981"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
