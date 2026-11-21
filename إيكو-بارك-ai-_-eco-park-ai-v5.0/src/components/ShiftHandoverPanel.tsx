import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Shield, UserCheck } from 'lucide-react';
import {
  Language,
  MaintenanceWorkOrder,
  ParkingSpot,
  RobotChargingSessionLog,
  ShiftHandoverRecord,
  UserRole,
} from '../types/parking';
import { t } from '../data/i18n';

interface ShiftHandoverPanelProps {
  lang: Language;
  currentUserName: string;
  currentUserRole: UserRole;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  workOrders: MaintenanceWorkOrder[];
  robotChargingLogs: RobotChargingSessionLog[];
  handovers: ShiftHandoverRecord[];
  onSignHandover: (record: ShiftHandoverRecord) => void;
}

const INCOMING_ROLES: UserRole[] = [
  'Parking Manager',
  'Operator',
  'Maintenance & Energy',
  'Security',
  'Super Admin',
];

export const ShiftHandoverPanel: React.FC<ShiftHandoverPanelProps> = ({
  lang,
  currentUserName,
  currentUserRole,
  spots,
  bessCharge,
  solarKw,
  workOrders,
  robotChargingLogs,
  handovers,
  onSignHandover,
}) => {
  const [incomingSupervisor, setIncomingSupervisor] = useState('م. سارة العتيبي');
  const [incomingRole, setIncomingRole] = useState<UserRole>('Operator');
  const [checklistBessVerified, setChecklistBessVerified] = useState(true);
  const [checklistAnprClean, setChecklistAnprClean] = useState(true);
  const [checklistExitsClear, setChecklistExitsClear] = useState(true);
  const [notes, setNotes] = useState('');

  const openOrdersCount = workOrders.filter((w) => w.status !== 'resolved').length;
  const occupiedBaysCount = spots.filter((s) => s.status !== 'available').length;
  const totalRobotKwh = Number(
    robotChargingLogs.reduce((acc, r) => acc + r.energyDeliveredKwh, 0).toFixed(1)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingSupervisor.trim()) return;

    const record: ShiftHandoverRecord = {
      id: `SH-${Date.now()}`,
      outgoingSupervisor: currentUserName,
      outgoingRole: currentUserRole,
      incomingSupervisor: incomingSupervisor.trim(),
      incomingRole,
      bessChargePct: bessCharge,
      solarKw,
      openWorkOrdersCount: openOrdersCount,
      occupiedBaysCount,
      robotKwhDelivered: totalRobotKwh,
      checklistBessVerified,
      checklistAnprClean,
      checklistExitsClear,
      handoverNotes:
        notes.trim() ||
        t(
          lang,
          'الأنظمة مستقرة وجميع المواقف والبوابات تحت المراقبة الاعتيادية.',
          'All bays, BESS racks, and ANPR gate lanes operating normally.'
        ),
      signedAt: new Date().toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    onSignHandover(record);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-400" />
              {t(
                lang,
                'محضر تسليم واستلام الورديات متعدد الأدوار (Shift Handover & RBAC Log)',
                'Multi-Role Supervisor Shift Handover & Sign-Off'
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'يوثق حالة بطاريات BESS والأعطال المفتوحة وإنتاج روبوت الشحن لحظياً لتسليم الوردية للمشرف القادم بأمان.',
                'Captures live BESS %, open maintenance tickets, and EcoCharge Bot totals for verified multi-role shift handovers.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span>
              {currentUserName} · {currentUserRole}
            </span>
          </div>
        </div>

        {/* Live Shift Snapshot Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-[#08121D] p-3.5">
            <div className="text-[11px] text-slate-400">BESS / Solar</div>
            <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
              {bessCharge}% · {solarKw} kW
            </div>
          </div>
          <div className="rounded-xl bg-[#08121D] p-3.5">
            <div className="text-[11px] text-slate-400">
              {t(lang, 'الأعطال والتذاكر المفتوحة', 'Open Work Orders')}
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold text-amber-300 tabular-nums">
              {openOrdersCount}
            </div>
          </div>
          <div className="rounded-xl bg-[#08121D] p-3.5">
            <div className="text-[11px] text-slate-400">
              {t(lang, 'إشغال المواقف', 'Occupied Bays')}
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold text-cyan-300 tabular-nums">
              {occupiedBaysCount} / {spots.length}
            </div>
          </div>
          <div className="rounded-xl bg-[#08121D] p-3.5">
            <div className="text-[11px] text-slate-400">
              {t(lang, 'طاقة EcoCharge Bot', 'EcoCharge Bot Energy')}
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums">
              {totalRobotKwh} kWh
            </div>
          </div>
        </div>

        {/* Handover Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {t(lang, 'اسم المشرف المستلم للوردية', 'Incoming Shift Supervisor Name')}
              </label>
              <input
                type="text"
                value={incomingSupervisor}
                onChange={(e) => setIncomingSupervisor(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {t(lang, 'الدور والصلاحية (RBAC Role)', 'Incoming Role Assignment')}
              </label>
              <select
                value={incomingRole}
                onChange={(e) => setIncomingRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                {INCOMING_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={checklistBessVerified}
                onChange={(e) => setChecklistBessVerified(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>{t(lang, 'تم فحص BESS والعاكسات الشمسية', 'BESS & PV inverters checked')}</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={checklistAnprClean}
                onChange={(e) => setChecklistAnprClean(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>{t(lang, 'كاميرات ANPR وبوابة QR جاهزة', 'ANPR & QR gate lenses clean')}</span>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={checklistExitsClear}
                onChange={(e) => setChecklistExitsClear(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>{t(lang, 'مخارج الطوارئ وروبوت الإخلاء سالكة', 'Evacuation lanes verified')}</span>
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t(lang, 'ملاحظات وتوصيات التسليم للمشرف القادم', 'Handover Notes & Action Items')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                lang,
                'مثال: يرجى متابعة تنظيف الألواح أو استلام مركبة VIP الساعة 06:00...',
                'e.g. Follow up on Sector B-04 sensor or scheduled VIP fleet arrival...'
              )}
              className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition"
          >
            <UserCheck className="h-4 w-4" />
            {t(lang, 'توقيع وتوثيق محضر تسليم الوردية', 'Sign & Record Shift Handover')}
          </button>
        </form>
      </div>

      {/* Signed Shift Handover Archive */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">
          {t(lang, 'سجل تسليم الورديات الموثق', 'Verified Shift Handover Log')}
        </h3>
        {handovers.length === 0 ? (
          <p className="py-4 text-xs text-slate-400">
            {t(lang, 'لا توجد محاضر تسليم مسجلة بعد في قاعدة البيانات.', 'No signed shift handovers recorded yet.')}
          </p>
        ) : (
          <div className="space-y-2.5">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>
                      {h.outgoingSupervisor} ({h.outgoingRole}) → {h.incomingSupervisor} ({h.incomingRole})
                    </span>
                  </div>
                  <span className="font-mono text-slate-400 tabular-nums">{h.signedAt}</span>
                </div>
                <p className="text-slate-300">{h.handoverNotes}</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>BESS: {h.bessChargePct}%</span>
                  <span>·</span>
                  <span>Solar: {h.solarKw} kW</span>
                  <span>·</span>
                  <span>
                    {t(lang, 'تذاكر مفتوحة:', 'Open WO:')} {h.openWorkOrdersCount}
                  </span>
                  <span>·</span>
                  <span>Bot: {h.robotKwhDelivered} kWh</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
