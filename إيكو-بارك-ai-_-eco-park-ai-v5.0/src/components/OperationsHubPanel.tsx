import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileCheck2,
  Flame,
  Network,
  Play,
  Plus,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react';
import {
  ActiveMergedEventState,
  ActiveMergedTourState,
  AdminWastePolicy,
  AnprScanRecord,
  EmergencyDrillRun,
  FleetPermit,
  Language,
  MaintenanceWorkOrder,
  ParkingSpot,
  Reservation,
  RobotChargingSessionLog,
  ShiftHandoverRecord,
  UserRole,
  VehicleType,
} from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS, playHydraulicGateSound, speakGuidance } from '../utils/ecoEngine';
import { AdminWasteReductionPanel, DEFAULT_ADMIN_WASTE_POLICY } from './AdminWasteReductionPanel';
import { ShiftHandoverPanel } from './ShiftHandoverPanel';
import { OperationalStructurePanel } from './OperationalStructurePanel';

interface OperationsHubPanelProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw?: number;
  smokeAlert: boolean;
  currentUserName?: string;
  currentUserRole?: UserRole;
  fleetPermits: FleetPermit[];
  workOrders: MaintenanceWorkOrder[];
  drillHistory: EmergencyDrillRun[];
  reservations?: Reservation[];
  anprScanLogs?: AnprScanRecord[];
  robotChargingLogs?: RobotChargingSessionLog[];
  shiftHandovers?: ShiftHandoverRecord[];
  adminWastePolicy?: AdminWastePolicy;
  onUpdateAdminWastePolicy?: (next: AdminWastePolicy) => void;
  onSignShiftHandover?: (record: ShiftHandoverRecord) => void;
  onAddFleetPermit: (permit: FleetPermit) => void;
  onToggleFleetPermit: (id: string) => void;
  onSimulatePermitGateEntry: (permit: FleetPermit) => void;
  onAddWorkOrder: (order: MaintenanceWorkOrder) => void;
  onAdvanceWorkOrder: (id: string) => void;
  onStartEmergencyDrill: () => number;
  onCompleteEmergencyDrill: (startedAtMs: number) => void;
  activeMergedTour?: ActiveMergedTourState | null;
  activeMergedEvent?: ActiveMergedEventState | null;
  onNotify: (msg: string) => void;
}

export const OperationsHubPanel: React.FC<OperationsHubPanelProps> = ({
  lang,
  spots,
  bessCharge,
  solarKw = 180,
  smokeAlert,
  currentUserName = 'المشرف المناوب',
  currentUserRole = 'Operator',
  fleetPermits,
  workOrders,
  drillHistory,
  reservations = [],
  anprScanLogs = [],
  robotChargingLogs = [],
  shiftHandovers = [],
  adminWastePolicy = DEFAULT_ADMIN_WASTE_POLICY,
  onUpdateAdminWastePolicy,
  onSignShiftHandover,
  onAddFleetPermit,
  onToggleFleetPermit,
  onSimulatePermitGateEntry,
  onAddWorkOrder,
  onAdvanceWorkOrder,
  onStartEmergencyDrill,
  onCompleteEmergencyDrill,
  activeMergedTour = null,
  activeMergedEvent = null,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'fleets' | 'workorders' | 'drills' | 'admin_waste' | 'shift_handover' | 'structure'>('fleets');

  // Fleet Form
  const [plate, setPlate] = useState('');
  const [owner, setOwner] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('ELECTRIC');
  const [tier, setTier] = useState<FleetPermit['tier']>('VIP_EXECUTIVE');

  // Work Order Form
  const [woBay, setWoBay] = useState(spots[0]?.id || 'A-01');
  const [woIssue, setWoIssue] = useState('');
  const [woAssignee, setWoAssignee] = useState('م. طارق المنصور');
  const [woPriority, setWoPriority] = useState<MaintenanceWorkOrder['priority']>('high');

  // Drill Timer
  const [activeDrillStart, setActiveDrillStart] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!activeDrillStart) {
      setElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - activeDrillStart) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [activeDrillStart]);

  const handleCreatePermit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !owner.trim()) return;
    const permit: FleetPermit = {
      id: `flt-${Date.now()}`,
      plateNumber: plate.trim().toUpperCase(),
      companyOrOwner: owner.trim(),
      vehicleType,
      tier,
      autoGateEnabled: true,
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      active: true,
    };
    onAddFleetPermit(permit);
    setPlate('');
    setOwner('');
  };

  const handleCreateWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!woIssue.trim()) return;
    const order: MaintenanceWorkOrder = {
      id: `WO-${Math.floor(1000 + Math.random() * 8999)}`,
      bayId: woBay,
      issueAr: woIssue.trim(),
      issueEn: woIssue.trim(),
      priority: woPriority,
      assignee: woAssignee.trim() || 'Team 19 Tech',
      status: 'open',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      autoDetected: false,
    };
    onAddWorkOrder(order);
    setWoIssue('');
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0D1E2E] p-2">
        <button
          type="button"
          onClick={() => setSubTab('fleets')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'fleets'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Crown className="h-4 w-4" />
          {t(lang, 'الأساطيل وتصاريح VIP التلقائية', 'Fleets & ANPR VIP Permits')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('workorders')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'workorders'
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Wrench className="h-4 w-4" />
          {t(lang, `تذاكر الصيانة الوقائية (${workOrders.length})`, `Predictive Work Orders (${workOrders.length})`)}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('drills')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'drills'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Flame className="h-4 w-4" />
          {t(lang, 'مناورات الطوارئ والاستجابة', 'Emergency Drills & Chaos Test')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('admin_waste')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'admin_waste'
              ? 'bg-teal-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          {t(lang, 'تقليل الهدر الإداري (Zero-Paper Admin)', 'Admin Waste Reduction (Zero-Paper)')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('shift_handover')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'shift_handover'
              ? 'bg-purple-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          {t(lang, `تسليم الورديات (${shiftHandovers.length})`, `Shift Handover (${shiftHandovers.length})`)}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('structure')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            subTab === 'structure'
              ? 'bg-emerald-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Network className="h-4 w-4" />
          {t(lang, 'الهيكل التشغيلي للمشروع', 'Operational Structure')}
        </button>
      </div>

      {/* 1. FLEETS & VIP ANPR WHITELIST */}
      {subTab === 'fleets' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreatePermit}
            className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {t(lang, 'إضافة تصريح عبور تلقائي (ANPR Whitelist / VIP)', 'Register Auto-Gate ANPR Fleet / VIP Permit')}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder={t(lang, 'رقم اللوحة (مثال: VIP-900)', 'Plate (e.g. VIP-900)')}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-400"
                required
              />
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={t(lang, 'الشركة أو اسم VIP', 'Fleet / VIP Owner')}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                required
              />
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none"
              >
                {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
                  <option key={vt} value={vt}>
                    {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
                  </option>
                ))}
              </select>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as FleetPermit['tier'])}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none"
              >
                <option value="VIP_EXECUTIVE">{t(lang, 'عضوية VIP تنفيذية', 'VIP Executive')}</option>
                <option value="CORPORATE_FLEET">{t(lang, 'أسطول شركات أخضر', 'Corporate Green Fleet')}</option>
                <option value="MONTHLY_GREEN">{t(lang, 'اشتراك شهري مستدام', 'Monthly Eco Pass')}</option>
              </select>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <Plus className="h-4 w-4" />
                {t(lang, 'تسجيل التصريح', 'Add Permit')}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fleetPermits.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  p.active
                    ? 'border-emerald-400/35 bg-[#0D1E2E]'
                    : 'border-white/10 bg-[#08121D] opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-extrabold text-amber-300">
                    {p.plateNumber}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    {p.tier}
                  </span>
                </div>
                <div className="text-xs text-white font-semibold">{p.companyOrOwner}</div>
                <div className="text-[11px] text-slate-400">
                  {p.vehicleType} · {t(lang, 'صالح حتى:', 'Valid:')} {p.validUntil}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!p.active}
                    onClick={() => {
                      playHydraulicGateSound();
                      onSimulatePermitGateEntry(p);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
                  >
                    <Car className="h-3.5 w-3.5" />
                    {t(lang, 'فتح البوابة ANPR', 'Auto-Gate Entry')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFleetPermit(p.id)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                  >
                    {p.active ? t(lang, 'إيقاف', 'Pause') : t(lang, 'تفعيل', 'Enable')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. PREDICTIVE WORK ORDERS */}
      {subTab === 'workorders' && (
        <div className="space-y-6">
          {(smokeAlert || bessCharge < 20) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <span>
                  {t(
                    lang,
                    'رصد النظام حالة حرجة نشطة (رادار دخان أو هبوط BESS). يمكنك توليد تذكرة صيانة وقائية فورية.',
                    'Active telemetry anomaly detected (Smoke Radar or Low BESS). Auto-generate a work order now.'
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddWorkOrder({
                    id: `WO-AUTO-${Math.floor(100 + Math.random() * 899)}`,
                    bayId: smokeAlert ? 'B-04' : 'BESS-MAIN',
                    issueAr: smokeAlert
                      ? 'فحص حساس الدخان والعزل الحراري في القطاع B-04'
                      : `فحص خلايا بطارية BESS بعد الهبوط إلى ${bessCharge}%`,
                    issueEn: smokeAlert
                      ? 'Inspect smoke & thermal probe at Sector B-04'
                      : `Inspect BESS battery rack after drop to ${bessCharge}%`,
                    priority: 'critical',
                    assignee: 'فريق الطوارئ الهندسي',
                    status: 'open',
                    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    autoDetected: true,
                  });
                }}
                className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                {t(lang, '+ إنشاء تذكرة تلقائية للعطل', '+ Auto-Create Anomaly Ticket')}
              </button>
            </div>
          )}

          <form
            onSubmit={handleCreateWorkOrder}
            className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-cyan-400" />
              {t(lang, 'فتح أمر عمل وصيانة جديد', 'Create Predictive Maintenance Work Order')}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={woBay}
                onChange={(e) => setWoBay(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none"
              >
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.zone})
                  </option>
                ))}
                <option value="BESS-MAIN">BESS-MAIN</option>
                <option value="SOLAR-CANOPY">SOLAR-CANOPY</option>
              </select>
              <input
                type="text"
                value={woIssue}
                onChange={(e) => setWoIssue(e.target.value)}
                placeholder={t(lang, 'وصف العطل أو الفحص الوقائي', 'Issue or preventive check')}
                className="lg:col-span-2 rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                required
              />
              <select
                value={woPriority}
                onChange={(e) => setWoPriority(e.target.value as MaintenanceWorkOrder['priority'])}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none"
              >
                <option value="critical">{t(lang, 'حرجة (Critical)', 'Critical')}</option>
                <option value="high">{t(lang, 'عالية (High)', 'High')}</option>
                <option value="routine">{t(lang, 'دورية (Routine)', 'Routine')}</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                {t(lang, 'إصدار التذكرة', 'Create Ticket')}
              </button>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{t(lang, 'المسؤول المعين:', 'Assigned Technician:')}</span>
              <input
                type="text"
                value={woAssignee}
                onChange={(e) => setWoAssignee(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1 text-xs text-white outline-none"
              />
            </div>
          </form>

          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400">{wo.id}</span>
                    <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white">
                      {wo.bayId}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        wo.priority === 'critical'
                          ? 'bg-red-500/20 text-red-300'
                          : wo.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {wo.priority}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {lang === 'ar' ? wo.issueAr : wo.issueEn}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {wo.assignee} · {wo.createdAt}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                      wo.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : wo.status === 'in_progress'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {wo.status}
                  </span>
                  {wo.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => onAdvanceWorkOrder(wo.id)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {wo.status === 'open'
                        ? t(lang, 'بدء المعالجة', 'Start Repair')
                        : t(lang, 'إغلاق التذكرة', 'Mark Resolved')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. EMERGENCY DRILL SIMULATOR */}
      {subTab === 'drills' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/35 bg-[#0D1E2E] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Timer className="h-5 w-5 text-amber-400" />
                  {t(lang, 'محاكي مناورات الطوارئ وقياس زمن الاستجابة', 'Emergency Drill & Response Time Simulator')}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {t(
                    lang,
                    'يختبر جاهزية الفريق عبر محاكاة هبوط BESS وإنذار دخان B-04 مع احتساب الزمن والتقييم في سجل التدقيق.',
                    'Benchmarks team readiness by triggering a controlled BESS drop & smoke drill and logging response grade.'
                  )}
                </p>
              </div>

              {activeDrillStart ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-red-400/50 bg-red-500/15 px-4 py-2 font-mono text-lg font-extrabold text-red-300 tabular-nums">
                    {elapsedSec}s
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const start = activeDrillStart;
                      setActiveDrillStart(null);
                      onCompleteEmergencyDrill(start);
                      speakGuidance(
                        lang === 'ar'
                          ? 'انتهت مناورة الطوارئ بنجاح وتم توثيق زمن الاستجابة.'
                          : 'Emergency drill completed and response time logged.',
                        lang
                      );
                    }}
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    {t(lang, 'إنهاء المناورة وتأكيد الأمان', 'Complete Drill & Restore')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const started = onStartEmergencyDrill();
                    setActiveDrillStart(started);
                    onNotify(
                      t(
                        lang,
                        'بدأت مناورة الطوارئ! راقب التوقيت وأكّد الأمان لاحتساب التقييم.',
                        'Emergency drill active! Complete restoration to record response grade.'
                      )
                    );
                  }}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  <Play className="h-4 w-4" />
                  {t(lang, 'بدء مناورة طوارئ متكاملة', 'Launch Full Emergency Drill')}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">
              {t(lang, 'سجل نتائج المناورات التدريبية', 'Recorded Drill Benchmarks')}
            </h3>
            {drillHistory.length === 0 ? (
              <p className="py-4 text-xs text-slate-400">
                {t(lang, 'لم تُجرَ مناورات تدريبية في هذه الجلسة بعد.', 'No emergency drills executed in this session yet.')}
              </p>
            ) : (
              <div className="space-y-2">
                {drillHistory.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#08121D] px-4 py-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {lang === 'ar' ? d.scenarioAr : d.scenarioEn}
                      </div>
                      <div className="text-slate-400">{d.completedAt}</div>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-cyan-300 font-bold">{d.durationSec}s</span>
                      <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-extrabold text-emerald-300">
                        {t(lang, `تقييم ${d.grade}`, `Grade ${d.grade}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ADMINISTRATIVE WASTE REDUCTION & ZERO-PAPER AUTOMATION */}
      {subTab === 'admin_waste' && (
        <AdminWasteReductionPanel
          lang={lang}
          reservations={reservations}
          anprScanLogs={anprScanLogs}
          fleetPermits={fleetPermits}
          workOrders={workOrders}
          robotChargingLogs={robotChargingLogs}
          policy={adminWastePolicy}
          onUpdatePolicy={(next) => {
            onUpdateAdminWastePolicy?.(next);
          }}
          onNotify={onNotify}
        />
      )}

      {/* 5. MULTI-ROLE SHIFT HANDOVER & LOGBOOK */}
      {subTab === 'shift_handover' && (
        <ShiftHandoverPanel
          lang={lang}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
          spots={spots}
          bessCharge={bessCharge}
          solarKw={solarKw}
          workOrders={workOrders}
          robotChargingLogs={robotChargingLogs}
          handovers={shiftHandovers}
          onSignHandover={(rec) => {
            onSignShiftHandover?.(rec);
          }}
        />
      )}

      {/* 6. OPERATIONAL STRUCTURE & GOVERNANCE BLUEPRINT */}
      {subTab === 'structure' && (
        <OperationalStructurePanel
          lang={lang}
          spots={spots}
          bessCharge={bessCharge}
          solarKw={solarKw}
          smokeAlert={smokeAlert}
          fleetPermits={fleetPermits}
          workOrders={workOrders}
          drillHistory={drillHistory}
          reservations={reservations}
          anprScanLogs={anprScanLogs}
          robotChargingLogs={robotChargingLogs}
          shiftHandovers={shiftHandovers}
          activeMergedTour={activeMergedTour}
          activeMergedEvent={activeMergedEvent}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};
