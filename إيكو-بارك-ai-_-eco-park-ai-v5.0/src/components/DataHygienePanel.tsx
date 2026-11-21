import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  BatteryCharging,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Eraser,
  FileJson,
  HardDrive,
  Lock,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ClearSystemDataResult } from '../firebase';
import {
  AnprScanRecord,
  AuditLogEntry,
  CarbonTransaction,
  ChargerEfficiencyRatingEntry,
  EcoToggleEvent,
  EmergencyDrillRun,
  FleetPermit,
  Language,
  MaintenanceWorkOrder,
  ParkingSpot,
  Reservation,
  RobotChargingSessionLog,
  ShiftHandoverRecord,
  SupervisorAlertIncident,
  V2GSession,
} from '../types/parking';
import { t } from '../data/i18n';

export interface WipeExecutionOptions {
  wipeOperations: boolean;
  wipeMockSeeds: boolean;
  wipeEnergyAlerts: boolean;
  wipeAuditAndLogs: boolean;
  wipeGreenAssets: boolean;
  resetSpotsTo12: boolean;
  enableZeroMockMode: boolean;
}

export interface WipeReportSummary {
  executedAt: string;
  firestoreDeleted: ClearSystemDataResult | null;
  localClearedCount: number;
  zeroMockActive: boolean;
}

interface DataHygienePanelProps {
  lang: Language;
  reservations: Reservation[];
  transactions: CarbonTransaction[];
  redeemedPoints: number;
  v2gSessions: V2GSession[];
  auditLogs: AuditLogEntry[];
  supervisorAlerts: SupervisorAlertIncident[];
  anprScanLogs: AnprScanRecord[];
  ecoToggleEvents: EcoToggleEvent[];
  chargerRatings: ChargerEfficiencyRatingEntry[];
  robotChargingLogs: RobotChargingSessionLog[];
  shiftHandovers: ShiftHandoverRecord[];
  fleetPermits: FleetPermit[];
  workOrders: MaintenanceWorkOrder[];
  drillHistory: EmergencyDrillRun[];
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  isEmailVerified: boolean;
  isAdminUser: boolean;
  zeroMockMode: boolean;
  onExecuteWipe: (options: WipeExecutionOptions) => Promise<WipeReportSummary>;
  onExportFullBackup: () => void;
  onSeedRealisticDemo: () => Promise<void>;
  onPruneRecords: (mode: 'completed_reservations' | 'resolved_work_orders' | 'trim_logs_15') => void;
  onNotify: (msg: string) => void;
}

interface LocalKeyEntry {
  key: string;
  labelAr: string;
  labelEn: string;
  bytes: number;
  protectedKey: boolean;
}

const KNOWN_STORAGE_KEYS: { key: string; labelAr: string; labelEn: string; protectedKey?: boolean }[] = [
  { key: 'ecopark_zero_mock_mode', labelAr: 'علم وضع صفر-بيانات-وهمية', labelEn: 'Zero-Mock Mode Flag' },
  { key: 'ecopark_fleet_permits', labelAr: 'تصاريح الأساطيل المخصصة', labelEn: 'Fleet Permits Cache' },
  { key: 'ecopark_work_orders', labelAr: 'أوامر الصيانة المحلية', labelEn: 'Work Orders Cache' },
  { key: 'ecopark_robot_charging_logs', labelAr: 'سجلات روبوت الشحن', labelEn: 'Robot Charging Logs' },
  { key: 'ecopark_anpr_scan_logs', labelAr: 'سجل مسوحات ANPR', labelEn: 'ANPR Scan Logs' },
  { key: 'ecopark_eco_toggle_events', labelAr: 'أحداث ترشيد Eco', labelEn: 'Eco Toggle Events' },
  { key: 'ecopark_charger_ratings', labelAr: 'تقييمات الشواحن', labelEn: 'Charger Ratings' },
  { key: 'ecopark_charger_manual_notes', labelAr: 'ملاحظات معايرة الشواحن', labelEn: 'Charger Manual Notes' },
  { key: 'ecopark_shift_handovers', labelAr: 'محاضر تسليم الورديات', labelEn: 'Shift Handover Logs' },
  { key: 'ecopark_offline_gate_queue', labelAr: 'طابور البوابة غير المتصل', labelEn: 'Offline Gate Buffer' },
  { key: 'ecopark_green_assets', labelAr: 'أرصدة التشجير البيوفيلي', labelEn: 'Green Flora Assets' },
  { key: 'ecopark_redeemed_pts', labelAr: 'النقاط الكربونية المستبدلة', labelEn: 'Redeemed Carbon Points' },
  { key: 'ecopark_admin_waste_policy', labelAr: 'سياسات ترشيد الفاقد', labelEn: 'Admin Waste Policy', protectedKey: true },
  { key: 'ecopark_project_settings', labelAr: 'هوية المشروع وفريق Team 19', labelEn: 'Project & Team Identity', protectedKey: true },
  { key: 'ecopark_lang', labelAr: 'لغة الواجهة', labelEn: 'Interface Language', protectedKey: true },
];

export const DataHygienePanel: React.FC<DataHygienePanelProps> = ({
  lang,
  reservations,
  transactions,
  redeemedPoints,
  v2gSessions,
  auditLogs,
  supervisorAlerts,
  anprScanLogs,
  ecoToggleEvents,
  chargerRatings,
  robotChargingLogs,
  shiftHandovers,
  fleetPermits,
  workOrders,
  drillHistory,
  spots,
  bessCharge,
  solarKw,
  isEmailVerified,
  isAdminUser,
  zeroMockMode,
  onExecuteWipe,
  onExportFullBackup,
  onSeedRealisticDemo,
  onPruneRecords,
  onNotify,
}) => {
  const [options, setOptions] = useState<WipeExecutionOptions>({
    wipeOperations: true,
    wipeMockSeeds: true,
    wipeEnergyAlerts: true,
    wipeAuditAndLogs: true,
    wipeGreenAssets: true,
    resetSpotsTo12: true,
    enableZeroMockMode: true,
  });

  const [confirmMode, setConfirmMode] = useState<'none' | 'full' | 'selective'>('none');
  const [busyWipe, setBusyWipe] = useState(false);
  const [busySeed, setBusySeed] = useState(false);
  const [lastReport, setLastReport] = useState<WipeReportSummary | null>(null);
  const [storageRefreshTick, setStorageRefreshTick] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onWiped = () => setStorageRefreshTick((n) => n + 1);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('ecopark-data-wiped', onWiped);
    window.addEventListener('ecopark-green-assets-updated', onWiped);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('ecopark-data-wiped', onWiped);
      window.removeEventListener('ecopark-green-assets-updated', onWiped);
    };
  }, []);

  // Inspect live localStorage footprint & green assets
  const { storageEntries, totalBytes, greenFloraTotal, offlineQueueCount } = useMemo(() => {
    void storageRefreshTick;
    const entries: LocalKeyEntry[] = [];
    let bytesSum = 0;
    let greenSum = 0;
    let offlineCount = 0;

    if (typeof window !== 'undefined') {
      KNOWN_STORAGE_KEYS.forEach((meta) => {
        const val = window.localStorage.getItem(meta.key);
        if (val !== null) {
          const byteLen = new Blob([val]).size;
          bytesSum += byteLen;
          entries.push({
            key: meta.key,
            labelAr: meta.labelAr,
            labelEn: meta.labelEn,
            bytes: byteLen,
            protectedKey: Boolean(meta.protectedKey),
          });
          if (meta.key === 'ecopark_green_assets') {
            try {
              const parsed = JSON.parse(val) as Record<string, number>;
              greenSum = Object.values(parsed).reduce((acc, n) => acc + (Number(n) || 0), 0);
            } catch {
              greenSum = 0;
            }
          }
          if (meta.key === 'ecopark_offline_gate_queue') {
            try {
              const parsed = JSON.parse(val) as unknown[];
              offlineCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch {
              offlineCount = 0;
            }
          }
        }
      });

      // Fallback if green assets haven't been explicitly saved yet & not zero-mock
      if (window.localStorage.getItem('ecopark_green_assets') === null && !zeroMockMode) {
        greenSum = 46;
      }
    }

    return {
      storageEntries: entries,
      totalBytes: bytesSum,
      greenFloraTotal: greenSum,
      offlineQueueCount: offlineCount,
    };
  }, [storageRefreshTick, zeroMockMode]);

  const seedItemsCount = useMemo(() => {
    const seedRobots = robotChargingLogs.filter((r) => r.id.startsWith('seed-')).length;
    const seedFleets = fleetPermits.filter((f) => f.id === 'flt-vip-1' || f.id === 'flt-corp-2').length;
    const seedWorkOrders = workOrders.filter((w) => w.id === 'WO-1042').length;
    return seedRobots + seedFleets + seedWorkOrders;
  }, [fleetPermits, robotChargingLogs, workOrders]);

  const totalLiveRecords =
    reservations.length +
    transactions.length +
    v2gSessions.length +
    auditLogs.length +
    supervisorAlerts.length +
    anprScanLogs.length +
    ecoToggleEvents.length +
    chargerRatings.length +
    robotChargingLogs.length +
    shiftHandovers.length +
    fleetPermits.length +
    workOrders.length +
    drillHistory.length +
    offlineQueueCount;

  const isCleanZeroMockState =
    totalLiveRecords === 0 &&
    greenFloraTotal === 0 &&
    redeemedPoints === 0 &&
    spots.length === 12 &&
    spots.every((s) => s.status === 'available');

  const runWipe = useCallback(
    async (wipeOpts: WipeExecutionOptions) => {
      setBusyWipe(true);
      try {
        const report = await onExecuteWipe(wipeOpts);
        setLastReport(report);
        setConfirmMode('none');
        setStorageRefreshTick((n) => n + 1);
      } finally {
        setBusyWipe(false);
      }
    },
    [onExecuteWipe]
  );

  const handleFullZeroMockWipe = () => {
    void runWipe({
      wipeOperations: true,
      wipeMockSeeds: true,
      wipeEnergyAlerts: true,
      wipeAuditAndLogs: true,
      wipeGreenAssets: true,
      resetSpotsTo12: true,
      enableZeroMockMode: true,
    });
  };

  const handleSelectiveWipe = () => {
    void runWipe(options);
  };

  const handleDeleteSingleLocalKey = (key: string) => {
    try {
      window.localStorage.removeItem(key);
      if (key === 'ecopark_green_assets') {
        window.dispatchEvent(new Event('ecopark-green-assets-updated'));
      } else if (key === 'ecopark_offline_gate_queue' || key === 'ecopark_charger_manual_notes') {
        window.dispatchEvent(new Event('ecopark-data-wiped'));
      }
      setStorageRefreshTick((n) => n + 1);
      onNotify(
        t(
          lang,
          `تم حذف المفتاح المحلي (${key}) بنجاح.`,
          `Removed local storage key (${key}).`
        )
      );
    } catch {
      onNotify(t(lang, 'تعذر حذف المفتاح المحلي.', 'Failed to delete local key.'));
    }
  };

  const completedReservationsCount = reservations.filter(
    (r) => r.status === 'completed' || r.status === 'cancelled'
  ).length;
  const resolvedWorkOrdersCount = workOrders.filter((w) => w.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* 1. Hero Header & 1-Click Zero-Mock Wipe */}
      <div
        className={`rounded-2xl border p-6 space-y-5 ${
          isCleanZeroMockState
            ? 'border-emerald-400/45 bg-gradient-to-br from-[#0C2621] via-[#0B1B29] to-[#08121D]'
            : 'border-rose-500/35 bg-gradient-to-br from-[#23121E] via-[#101A29] to-[#08121D]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                isCleanZeroMockState
                  ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-400'
                  : 'border-rose-400/45 bg-rose-500/15 text-rose-400'
              }`}
            >
              {isCleanZeroMockState ? <ShieldCheck className="h-7 w-7" /> : <Eraser className="h-7 w-7" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 border ${
                    isCleanZeroMockState
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {isCleanZeroMockState
                    ? t(lang, 'حالة الإنتاج النظيفة: صفر بيانات وهمية', 'Clean Production Mode: ZERO MOCK DATA')
                    : t(
                        lang,
                        `يوجد ${totalLiveRecords} سجل نشط (${seedItemsCount} بذور افتراضية)`,
                        `${totalLiveRecords} Active Records (${seedItemsCount} Mock Seeds)`
                      )}
                </span>
                {zeroMockMode && (
                  <span className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-cyan-300">
                    Zero-Mock Guard: ON
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-xl font-extrabold text-white">
                {t(
                  lang,
                  'قسم مسح كل البيانات الوهمية ومركز نظافة المنظومة (Zero-Mock Data Studio)',
                  'Complete Mock Data Purge & Data Hygiene Studio'
                )}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
                {t(
                  lang,
                  'إزالة شاملة ونهائية لجميع البيانات الوهمية والمبدئية (الحجوزات الاختبارية، سجلات الروبوت الوهمية، تصاريح VIP الافتراضية، أمر العمل WO-1042، التشجير المبدئي، وطابور البوابة) من السحابة والمتصفح مع الحفاظ التام على حسابك وهوية فريق Team 19.',
                  'Permanently wipe all mock, seeded, and sample test records across Firestore and local cache (seed robot logs, initial fleet permits, WO-1042, sample flora, offline buffer, and test bookings) while keeping your account & Team 19 settings intact.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onExportFullBackup}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition"
            >
              <Download className="h-4 w-4" />
              {t(lang, 'حفظ نسخة احتياطية JSON أولاً', 'Export JSON Backup First')}
            </button>

            <button
              type="button"
              disabled={busyWipe}
              onClick={() => setConfirmMode((m) => (m === 'full' ? 'none' : 'full'))}
              className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-rose-950/50 hover:bg-rose-400 transition disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {t(lang, 'مسح كل البيانات الوهمية نهائياً', 'Wipe All Mock Data Now')}
            </button>
          </div>
        </div>

        {/* Inline Two-Step Safety Confirmation for Full Wipe */}
        {confirmMode === 'full' && (
          <div className="rounded-xl border border-rose-400/60 bg-rose-950/50 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-100 space-y-1">
                <div className="font-extrabold text-white">
                  {t(
                    lang,
                    'تأكيد التنظيف الكامل إلى الصفر (Zero-Mock Production Reset)',
                    'Confirm Complete Zero-Mock Production Reset'
                  )}
                </div>
                <div className="text-rose-200/85">
                  {t(
                    lang,
                    'سيتم حذف كافة الحجوزات والمعاملات وجلسات V2G وسجلات الروبوت وتصاريح الأساطيل وأوامر الصيانة والتنبيهات والتشجير المبدئي وإعادة المواقف إلى 12 موقفاً فارغاً مع تفعيل قفل منع عودة البيانات الوهمية عند إعادة التحميل.',
                    'All reservations, carbon entries, V2G sessions, robot seeds, fleet seeds, work orders, alerts, and mock flora will be deleted across Firestore & LocalStorage, resetting to 12 clean empty bays.'
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyWipe}
                onClick={() => setConfirmMode('none')}
                className="rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                {t(lang, 'تراجع', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={busyWipe}
                onClick={handleFullZeroMockWipe}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {busyWipe
                  ? t(lang, 'جاري التنظيف الشامل...', 'Wiping Everything...')
                  : t(lang, 'نعم، امسح الكل نهائياً', 'Yes, Confirm Zero-Mock Wipe')}
              </button>
            </div>
          </div>
        )}

        {/* Assurance Strip + Latest Wipe Execution Report */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {t(
                lang,
                'حماية تلقائية: لن يتم تسجيل خروجك ولن تُحذف إعدادات المشروع وهوية الفريق (Team 19).',
                'Safe Purge Guarantee: Your Auth session & Team 19 Project Identity remain protected.'
              )}
            </span>
          </div>
          <div className="font-mono text-slate-400">
            {isEmailVerified
              ? t(
                  lang,
                  isAdminUser ? 'صلاحية Firestore: Admin شامل' : 'صلاحية Firestore: حساب موثق',
                  isAdminUser ? 'Firestore Scope: Full Admin' : 'Firestore Scope: Verified Owner'
                )
              : t(lang, 'تنظيف محلي فقط (البريد غير موثق سحابياً)', 'Local Wipe Only (Email Unverified)')}
          </div>
        </div>

        {lastReport && (
          <div className="rounded-xl border border-emerald-400/45 bg-emerald-500/10 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {t(
                    lang,
                    `تم تنفيذ التنظيف بنجاح الساعة ${lastReport.executedAt}`,
                    `Data Hygiene Execution Completed at ${lastReport.executedAt}`
                  )}
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-200">
                {t(lang, `مفاتيح محلية مُزالة: ${lastReport.localClearedCount}`, `Local keys cleared: ${lastReport.localClearedCount}`)}
              </span>
            </div>
            {lastReport.firestoreDeleted && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px] text-slate-200">
                <div className="rounded-lg bg-[#08121D] px-2.5 py-1.5">
                  Reservations: <strong className="text-emerald-400">{lastReport.firestoreDeleted.deletedReservations}</strong>
                </div>
                <div className="rounded-lg bg-[#08121D] px-2.5 py-1.5">
                  Carbon Tx: <strong className="text-emerald-400">{lastReport.firestoreDeleted.deletedTransactions}</strong>
                </div>
                <div className="rounded-lg bg-[#08121D] px-2.5 py-1.5">
                  V2G & Alerts:{' '}
                  <strong className="text-emerald-400">
                    {lastReport.firestoreDeleted.deletedV2gSessions + lastReport.firestoreDeleted.deletedSupervisorAlerts}
                  </strong>
                </div>
                <div className="rounded-lg bg-[#08121D] px-2.5 py-1.5">
                  Logs & Robots:{' '}
                  <strong className="text-emerald-400">
                    {lastReport.firestoreDeleted.deletedAuditLogs +
                      lastReport.firestoreDeleted.deletedRobotLogs +
                      lastReport.firestoreDeleted.deletedShiftHandovers +
                      lastReport.firestoreDeleted.deletedChargerRatings}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Live Mock & Record Inventory Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'الحجوزات والكربون (101 & Eco-Park)', 'Reservations & Carbon Ledger')}</span>
            <Database className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white tabular-nums">
            {reservations.length} <span className="text-xs font-normal text-slate-400">{t(lang, 'حجز', 'bookings')}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{transactions.length} {t(lang, 'معاملة كربون', 'carbon tx')}</span>
            <span>{redeemedPoints} {t(lang, 'نقطة مستبدلة', 'pts redeemed')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'البذور الافتراضية (أسطول/صيانة/روبوت)', 'Default Seeds (Fleet / WO / Robots)')}</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
            {fleetPermits.length + workOrders.length + robotChargingLogs.length}{' '}
            <span className="text-xs font-normal text-slate-400">
              ({seedItemsCount} {t(lang, 'بذرة أولية', 'seeds')})
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{fleetPermits.length} {t(lang, 'تصريح', 'permits')}</span>
            <span>{workOrders.length} WO</span>
            <span>{robotChargingLogs.length} {t(lang, 'سجل روبوت', 'bot logs')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'طاقة V2G وبلاغات المشرفين والطوارئ', 'V2G Energy, Alerts & Drills')}</span>
            <BatteryCharging className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-cyan-300 tabular-nums">
            {v2gSessions.length + supervisorAlerts.length + drillHistory.length}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>BESS {bessCharge}%</span>
            <span>Solar {solarKw} kW</span>
            <span>{supervisorAlerts.length} {t(lang, 'تنبيه', 'alerts')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'مسوحات ANPR والورديات والتدقيق', 'ANPR Scans, Handovers & Audit')}</span>
            <ShieldCheck className="h-4 w-4 text-sky-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-sky-300 tabular-nums">
            {anprScanLogs.length + auditLogs.length + shiftHandovers.length}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{anprScanLogs.length} ANPR</span>
            <span>{auditLogs.length} {t(lang, 'تدقيق', 'audit')}</span>
            <span>{shiftHandovers.length} {t(lang, 'تسليم', 'handover')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'التشجير المبدئي وسعة المواقف', 'Green Flora & Parking Bays')}</span>
            <Sprout className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
            {greenFloraTotal} <span className="text-xs font-normal text-slate-400">{t(lang, 'نبتة', 'flora')}</span> ·{' '}
            {spots.length} <span className="text-xs font-normal text-slate-400">{t(lang, 'موقف', 'bays')}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{chargerRatings.length} {t(lang, 'تقييم شاحن', 'ratings')}</span>
            <span>{ecoToggleEvents.length} Eco</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'ذاكرة المتصفح وطابور البوابة', 'Browser Cache & Gate Buffer')}</span>
            <HardDrive className="h-4 w-4 text-purple-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-purple-300 tabular-nums">
            {(totalBytes / 1024).toFixed(2)} KB
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{storageEntries.length} {t(lang, 'مفتاح محلي', 'keys')}</span>
            <span>{offlineQueueCount} {t(lang, 'بالطابور', 'queued')}</span>
          </div>
        </div>
      </div>

      {/* 3. Granular Selective Purge Studio */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Eraser className="h-4 w-4 text-rose-400" />
              <span>{t(lang, 'التنظيف الانتقائي المخصص (Selective Purge Control)', 'Selective Category Purge Control')}</span>
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'اختر بدقة الفئات التي تريد مسحها دون المساس ببقية أجزاء المنظومة.',
                'Choose specific data scopes to clean while leaving untouched sections active.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                setOptions({
                  wipeOperations: true,
                  wipeMockSeeds: true,
                  wipeEnergyAlerts: true,
                  wipeAuditAndLogs: true,
                  wipeGreenAssets: true,
                  resetSpotsTo12: true,
                  enableZeroMockMode: true,
                })
              }
              className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 font-semibold text-slate-200 hover:border-rose-400/50"
            >
              {t(lang, 'تحديد الكل', 'Select All')}
            </button>
            <button
              type="button"
              onClick={() =>
                setOptions({
                  wipeOperations: false,
                  wipeMockSeeds: true,
                  wipeEnergyAlerts: false,
                  wipeAuditAndLogs: false,
                  wipeGreenAssets: true,
                  resetSpotsTo12: false,
                  enableZeroMockMode: true,
                })
              }
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              {t(lang, 'البذور الوهمية فقط', 'Mock Seeds Only')}
            </button>
            <button
              type="button"
              onClick={() =>
                setOptions({
                  wipeOperations: false,
                  wipeMockSeeds: false,
                  wipeEnergyAlerts: false,
                  wipeAuditAndLogs: true,
                  wipeGreenAssets: false,
                  resetSpotsTo12: false,
                  enableZeroMockMode: false,
                })
              }
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              {t(lang, 'السجلات والتدقيق فقط', 'Audit & Logs Only')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 text-xs">
          {(
            [
              {
                key: 'wipeOperations',
                ar: 'الحجوزات والتذاكر ومعاملات الكربون والنقاط',
                en: 'Reservations, Tickets, Carbon Ledger & Redeemed Points',
              },
              {
                key: 'wipeMockSeeds',
                ar: 'البذور المبدئية (تصاريح الأساطيل، WO-1042، سجلات الروبوت)',
                en: 'Mock Seeds (VIP Fleet, WO-1042, Seed Robot Logs)',
              },
              {
                key: 'wipeEnergyAlerts',
                ar: 'جلسات V2G وبلاغات المشرفين والمناورات + تصفير BESS 100%',
                en: 'V2G Sessions, Supervisor Alerts, Drills + Reset BESS 100%',
              },
              {
                key: 'wipeAuditAndLogs',
                ar: 'سجلات ANPR والتدقيق والورديات وتقييمات وملاحظات الشواحن',
                en: 'ANPR Logs, Audit, Shift Handovers, Ratings & Gate Buffer',
              },
              {
                key: 'wipeGreenAssets',
                ar: 'تصفير رصيد التشجير المبدئي (46 وحدة → 0)',
                en: 'Reset Seeded Green Flora Assets (46 units → 0)',
              },
              {
                key: 'resetSpotsTo12',
                ar: 'إعادة مواقف الساحة إلى 12 موقفاً أساسياً متاحاً بالكامل',
                en: 'Reset Lot Capacity Back to 12 Clean Available Bays',
              },
            ] as const
          ).map((item) => (
            <label
              key={item.key}
              className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                options[item.key]
                  ? 'border-rose-400/45 bg-rose-500/10 text-white'
                  : 'border-white/10 bg-[#08121D] text-slate-400'
              }`}
            >
              <input
                type="checkbox"
                checked={options[item.key]}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, [item.key]: e.target.checked }))
                }
                className="mt-0.5 accent-rose-500"
              />
              <span className="leading-relaxed font-medium">{t(lang, item.ar, item.en)}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.enableZeroMockMode}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, enableZeroMockMode: e.target.checked }))
              }
              className="accent-emerald-400"
            />
            <span>
              {t(
                lang,
                'تفعيل قفل Zero-Mock الدائم لمنع إعادة تحميل البذور الوهمية بعد تحديث الصفحة',
                'Keep Zero-Mock Guard enabled so default seeds never reappear after page reload'
              )}
            </span>
          </label>

          <button
            type="button"
            disabled={busyWipe}
            onClick={() => setConfirmMode((m) => (m === 'selective' ? 'none' : 'selective'))}
            className="flex items-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            <Eraser className="h-3.5 w-3.5" />
            {t(lang, 'تنفيذ المسح المحدد', 'Execute Selected Purge')}
          </button>
        </div>

        {confirmMode === 'selective' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-xs">
            <span className="font-semibold text-amber-200">
              {t(
                lang,
                'هل أنت متأكد من مسح الفئات المحددة أعلاه الآن؟',
                'Proceed with purging the selected categories above?'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmMode('none')}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-200 hover:bg-white/10"
              >
                {t(lang, 'إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={busyWipe}
                onClick={handleSelectiveWipe}
                className="rounded-lg bg-amber-400 px-3.5 py-1.5 font-extrabold text-slate-950 hover:bg-amber-300"
              >
                {busyWipe ? t(lang, 'جاري التنفيذ...', 'Running...') : t(lang, 'تأكيد المسح المحدد', 'Confirm Selective Purge')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Extra Companion Additions ("شوية إضافات أخرى") */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Addition A: Backup Snapshot + Smart Demo Re-Seeder + Log Pruner */}
        <div className="rounded-2xl border border-white/10 bg-[#0D1E2E] p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArchiveRestore className="h-4 w-4 text-cyan-400" />
              <span>{t(lang, 'أدوات النسخ الاحتياطي وإعادة الضبط الذكي', 'Snapshot Backup, Smart Demo Seeder & Log Pruner')}</span>
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'إضافات تشغيلية لحفظ الحالة قبل المسح، أو توليد بيانات عرض واقعية للمناقشة، أو تشذيب السجلات المتراكمة دون تصفير النظام.',
                'Operational utilities to archive live state before a purge, generate realistic presentation test records, or trim accumulated logs without resetting.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onExportFullBackup}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-cyan-400/35 bg-[#08121D] p-3.5 text-start hover:border-cyan-400 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <FileJson className="h-4 w-4" />
                {t(lang, 'تصدير نسخة JSON كاملة', 'Full JSON State Backup')}
              </div>
              <p className="text-[11px] text-slate-400">
                {t(
                  lang,
                  'تحميل أرشيف شامل لجميع الحجوزات، الطاقة، الروبوتات، التشجير والإعدادات.',
                  'Downloads timestamped archive of bookings, energy, robots, flora & settings.'
                )}
              </p>
            </button>

            <button
              type="button"
              disabled={busySeed}
              onClick={async () => {
                setBusySeed(true);
                try {
                  await onSeedRealisticDemo();
                  setStorageRefreshTick((n) => n + 1);
                } finally {
                  setBusySeed(false);
                }
              }}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-emerald-400/35 bg-[#08121D] p-3.5 text-start hover:border-emerald-400 transition disabled:opacity-60"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <RefreshCw className={`h-4 w-4 ${busySeed ? 'animate-spin' : ''}`} />
                {busySeed
                  ? t(lang, 'جاري التوليد...', 'Seeding Demo Pack...')
                  : t(lang, 'توليد باقة اختبار واقعية', 'Seed Realistic Demo Pack')}
              </div>
              <p className="text-[11px] text-slate-400">
                {t(
                  lang,
                  'إنشاء حجوزات وبيانات طاقة وتشجير متكاملة لعرضها أمام لجنة التحكيم ثم مسحها لاحقاً.',
                  'Populates live bookings, ANPR, V2G, robot & green assets for jury demos.'
                )}
              </p>
            </button>
          </div>

          {/* Smart Pruner */}
          <div className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Scissors className="h-4 w-4 text-amber-400" />
              <span>{t(lang, 'تشذيب السجلات المتراكمة تلقائياً (دون مسح شامل)', 'Smart Log Pruner (Keep Active Ops Intact)')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={completedReservationsCount === 0}
                onClick={() => onPruneRecords('completed_reservations')}
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-amber-400/50 disabled:opacity-40"
              >
                {t(
                  lang,
                  `حذف الحجوزات المنتهية فقط (${completedReservationsCount})`,
                  `Prune Completed Bookings (${completedReservationsCount})`
                )}
              </button>
              <button
                type="button"
                disabled={resolvedWorkOrdersCount === 0}
                onClick={() => onPruneRecords('resolved_work_orders')}
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-amber-400/50 disabled:opacity-40"
              >
                {t(
                  lang,
                  `تنظيف أوامر العمل المغلقة (${resolvedWorkOrdersCount})`,
                  `Clear Resolved Work Orders (${resolvedWorkOrdersCount})`
                )}
              </button>
              <button
                type="button"
                disabled={auditLogs.length <= 15 && anprScanLogs.length <= 15}
                onClick={() => onPruneRecords('trim_logs_15')}
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-amber-400/50 disabled:opacity-40"
              >
                {t(
                  lang,
                  'تقليم التدقيق و ANPR لأحدث 15 سجل',
                  'Trim Audit & ANPR to Latest 15'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Addition B: LocalStorage Key Inspector & Cloud Sync Health */}
        <div className="rounded-2xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-purple-400" />
              <span>{t(lang, 'فاحص ذاكرة المتصفح والمزامنة السحابية', 'Browser Storage & Cloud Sync Inspector')}</span>
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                isOnline
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? t(lang, 'المتصفح متصل بالشبكة', 'Network Online') : t(lang, 'وضع غير متصل', 'Offline Mode')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-[#08121D] p-3">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-cyan-400" />
                {t(lang, 'حالة توثيق Firebase Auth', 'Firebase Auth Status')}
              </div>
              <div className={`mt-1 font-bold ${isEmailVerified ? 'text-emerald-400' : 'text-amber-300'}`}>
                {isEmailVerified
                  ? t(lang, 'موثّق · المزامنة والمسح السحابي متاح', 'Verified · Cloud Sync Active')
                  : t(lang, 'غير موثّق · الوضع المحلي نشط', 'Unverified · Local Mode')}
              </div>
            </div>

            <div className="rounded-xl bg-[#08121D] p-3">
              <div className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-purple-400" />
                {t(lang, 'استهلاك ذاكرة LocalStorage', 'LocalStorage Footprint')}
              </div>
              <div className="mt-1 font-mono font-bold text-white tabular-nums">
                {(totalBytes / 1024).toFixed(2)} KB{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  ({Math.min(100, (totalBytes / (5 * 1024 * 1024)) * 100).toFixed(3)}% / 5 MB)
                </span>
              </div>
            </div>
          </div>

          {/* Individual Key Breakdown Table */}
          <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#08121D] divide-y divide-white/5">
            {storageEntries.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {t(lang, 'لا توجد أي مفاتيح بيانات مخزنة محلياً حالياً.', 'Zero Eco-Park local storage keys currently present.')}
              </div>
            ) : (
              storageEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">
                      {lang === 'ar' ? entry.labelAr : entry.labelEn}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{entry.key}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
                      {entry.bytes < 1024 ? `${entry.bytes} B` : `${(entry.bytes / 1024).toFixed(1)} KB`}
                    </span>
                    {entry.protectedKey ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"
                        title={t(lang, 'مفتاح محمي للإعدادات', 'Protected config key')}
                      >
                        <Lock className="h-2.5 w-2.5" />
                        {t(lang, 'محمي', 'Safe')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleLocalKey(entry.key)}
                        className="rounded-md border border-rose-400/30 bg-rose-500/10 p-1 text-rose-300 hover:bg-rose-500/25"
                        title={t(lang, 'حذف هذا المفتاح فقط', 'Delete this key')}
                        aria-label={`Delete ${entry.key}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
