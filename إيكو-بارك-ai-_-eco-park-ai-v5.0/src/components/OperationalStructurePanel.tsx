import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Download,
  Leaf,
  Network,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
} from 'lucide-react';
import {
  ActiveMergedEventState,
  ActiveMergedTourState,
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
} from '../types/parking';
import { t } from '../data/i18n';

interface OperationalStructurePanelProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  smokeAlert: boolean;
  fleetPermits: FleetPermit[];
  workOrders: MaintenanceWorkOrder[];
  drillHistory: EmergencyDrillRun[];
  reservations: Reservation[];
  anprScanLogs: AnprScanRecord[];
  robotChargingLogs: RobotChargingSessionLog[];
  shiftHandovers: ShiftHandoverRecord[];
  activeMergedTour?: ActiveMergedTourState | null;
  activeMergedEvent?: ActiveMergedEventState | null;
  onNotify: (msg: string) => void;
}

interface RoleBlueprint {
  role: UserRole;
  tier: 'command' | 'field' | 'eco';
  titleAr: string;
  titleEn: string;
  scopeAr: string;
  scopeEn: string;
  modulesAr: string[];
  modulesEn: string[];
  kpiAr: string;
  kpiEn: string;
}

const ROLE_BLUEPRINTS: RoleBlueprint[] = [
  {
    role: 'Super Admin',
    tier: 'command',
    titleAr: 'المدير الأعلى للمنظومة',
    titleEn: 'Super Admin',
    scopeAr: 'حوكمة شاملة، اعتماد حسابات الفريق، ضبط السياسات، وإدارة قواعد Firestore.',
    scopeEn: 'Full platform governance, staff onboarding approvals, system settings, and security rules.',
    modulesAr: ['إدارة المستخدمين RBAC', 'الإعدادات والوضع الليلي', 'سجل التدقيق الكامل', 'التقارير السنوية PDF'],
    modulesEn: ['Users & RBAC', 'System & Smart Night', 'Audit Ledger', 'Annual ESG Reports'],
    kpiAr: 'جاهزية المنظومة ≥ 99.9% وامتثال أمني كامل',
    kpiEn: 'System Uptime ≥ 99.9% & Zero Security Drift',
  },
  {
    role: 'Parking Manager',
    tier: 'command',
    titleAr: 'مدير تشغيل المواقف',
    titleEn: 'Parking Manager',
    scopeAr: 'إدارة السعة، التوسع الديناميكي للمواقف، تصاريح VIP، ومراقبة الذروة والفروع.',
    scopeEn: 'Bay capacity governance, dynamic bay expansion, fleet VIP permits, and multi-branch flow.',
    modulesAr: ['مصفوفة المواقف 2D/3D', 'مركز العمليات والورديات', 'التنبؤ بالذروة', 'خريطة الفروع الحية'],
    modulesEn: ['Bay Matrix & 2D/3D', 'Operations & Handovers', 'Demand Forecast', 'Live Branch Map'],
    kpiAr: 'تقليل زمن البحث عن موقف إلى < 45 ثانية',
    kpiEn: 'Cut Bay Search Time to < 45s',
  },
  {
    role: 'Finance',
    tier: 'command',
    titleAr: 'المالية والتسعير الذكي',
    titleEn: 'Finance',
    scopeAr: 'إدارة التعرفة الديناميكية، تحصيل ضريبة الكربون، ومراجعة عوائد V2G ومحفظة النقاط.',
    scopeEn: 'Dynamic BESS-aware tariff rules, carbon tax allocation, and V2G settlement.',
    modulesAr: ['التسعير والفوترة الذكية', 'تقارير الإيرادات والكربون', 'ضريبة تمويل التشجير'],
    modulesEn: ['Smart Dynamic Billing', 'Revenue & Tax Ledger', 'Afforestation Carbon Fund'],
    kpiAr: 'تعظيم العائد وقت الذروة وتحويل 100% من ضريبة الكربون للتشجير',
    kpiEn: 'Peak Tariff Optimization & 100% Carbon Tax Allocation',
  },
  {
    role: 'Operator',
    tier: 'field',
    titleAr: 'مشغّل البوابات والميدان',
    titleEn: 'Gate & Field Operator',
    scopeAr: 'إدارة دخول وخروج المركبات عبر ANPR وQuick Scan، تشغيل كشك البوابة، وتسليم الوردية.',
    scopeEn: 'ANPR/QR gate operation, Quick Scan check-ins, offline queue sync, and shift handovers.',
    modulesAr: ['بوابة ANPR والكشك', 'المسح السريع Quick Scan', 'المحاكي 2D/3D', 'تسليم الورديات'],
    modulesEn: ['ANPR & Gate Kiosk', 'Quick Scan Check-In', '2D/3D Twin Controls', 'Shift Handover'],
    kpiAr: 'فتح البوابة < 2.5 ثانية وتصفير الطابور غير المتصل',
    kpiEn: 'Gate Latency < 2.5s & Zero Unsynced Offline Scans',
  },
  {
    role: 'Security',
    tier: 'field',
    titleAr: 'الأمن والسلامة والطوارئ',
    titleEn: 'Security & Safety',
    scopeAr: 'متابعة رادار الدخان والحرارة، إطلاق روبوت الإخلاء SafeGuard R2، وتنفيذ مناورات الطوارئ.',
    scopeEn: 'Smoke/thermal radar monitoring, SafeGuard R2 evacuation escorts, and chaos response drills.',
    modulesAr: ['إنذارات الدخان وNFPA-72', 'روبوت الإخلاء R2', 'مناورات الطوارئ', 'مراقب تصعيد المشرفين'],
    modulesEn: ['Smoke & NFPA-72 Alarms', 'SafeGuard Evac-Bot R2', 'Emergency Drills', '5-Min Escalation Monitor'],
    kpiAr: 'استجابة إنذار ≤ 60 ثانية وتقييم مناورة A+',
    kpiEn: 'Alarm Response ≤ 60s & Drill Grade A+',
  },
  {
    role: 'Maintenance & Energy',
    tier: 'field',
    titleAr: 'هندسة الصيانة والطاقة',
    titleEn: 'Maintenance & Energy',
    scopeAr: 'إدارة المظلات الشمسية 250kW، خلايا BESS، V2G، تنظيف الألواح، ومعايرة الشواحن.',
    scopeEn: '250kW PV canopies, BESS cell diagnostics, V2G dispatch, dry solar cleaning, and charger calibration.',
    modulesAr: ['مراقب الشمس والطقس المتطرف', 'تشخيص خلايا BESS', 'مناورات الأعطال', 'جدول الشواحن وسجلات الروبوت'],
    modulesEn: ['Solar & Extreme Weather', 'BESS Cell Diagnostics', 'Grid Fault Drills', 'Chargers & Robot Logs'],
    kpiAr: 'كفاءة شمسية ≥ 70% وكفاءة شحن روبوتي ≥ 90%',
    kpiEn: 'PV Efficiency ≥ 70% & Robot Delivery ≥ 90%',
  },
  {
    role: 'Sustainability',
    tier: 'eco',
    titleAr: 'إدارة الاستدامة والبيئة الخضراء',
    titleEn: 'Sustainability & ESG',
    scopeAr: 'متابعة البيئة المستدامة الخضراء، امتصاص CO₂، الري المعاد تدويره، وتقارير ESG Scope 3.',
    scopeEn: 'Biophilic flora expansion, bio-CO₂ sequestration, recycled drip irrigation, and Scope 3 reporting.',
    modulesAr: ['مركز البيئة المستدامة الخضراء', 'تقرير CO₂ الشهري', 'تقرير الاستدامة السنوي PDF'],
    modulesEn: ['Green Sustainability Hub', 'Monthly CO₂ Offset', 'Annual ESG PDF Report'],
    kpiAr: 'خفض الحرارة الموضعية -2°C إلى -4.8°C ورفع الاكتفاء المائي',
    kpiEn: 'Microclimate Cooling -2°C to -4.8°C & Water Self-Sufficiency',
  },
  {
    role: 'Driver',
    tier: 'eco',
    titleAr: 'السائق / مالك المركبة الكهربائية',
    titleEn: 'EV & Eco Driver',
    scopeAr: 'حجز المواقف، المسار الأخضر، متابعة شحن EV، واستبدال نقاط محفظة الكربون.',
    scopeEn: 'Smart bay booking, EV navigation via Live Map, Green Ticket QR, and Carbon Wallet rewards.',
    modulesAr: ['حجز وتذكرة QR الخضراء', 'خريطة الفروع بمدى البطارية', 'محفظة الكربون والحاسبة'],
    modulesEn: ['Green Booking & QR', 'EV Range Branch Map', 'Carbon Wallet & Calculator'],
    kpiAr: 'تعظيم نقاط الكربون والاستفادة من شحن EcoCharge',
    kpiEn: 'Maximize Carbon Points & Green Priority Bays',
  },
  {
    role: 'Guest',
    tier: 'eco',
    titleAr: 'زائر مؤقت',
    titleEn: 'Guest Visitor',
    scopeAr: 'استعراض التوافر الحي، الخريطة العالمية للفروع، والحجز السريع بدون تعقيد.',
    scopeEn: 'View live bay availability, branch map distances, and quick visitor ticket preview.',
    modulesAr: ['لوحة الحالة الحية', 'خريطة الفروع', 'المحاكي التفاعلي'],
    modulesEn: ['Live Status Preview', 'Branch Map', 'Interactive Twin Preview'],
    kpiAr: 'دخول سلس وتجربة خالية من الانبعاثات الزائدة',
    kpiEn: 'Zero-Friction Arrival & Guided Bay Entry',
  },
];

export const OperationalStructurePanel: React.FC<OperationalStructurePanelProps> = ({
  lang,
  spots,
  bessCharge,
  solarKw,
  smokeAlert,
  fleetPermits,
  workOrders,
  drillHistory,
  reservations,
  anprScanLogs,
  robotChargingLogs,
  shiftHandovers,
  activeMergedTour = null,
  activeMergedEvent = null,
  onNotify,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Super Admin');
  const [tierFilter, setTierFilter] = useState<'all' | 'command' | 'field' | 'eco'>('all');

  const occupiedCount = spots.filter((s) => s.status !== 'available').length;
  const openOrdersCount = workOrders.filter((w) => w.status !== 'resolved').length;
  const activePermitsCount = fleetPermits.filter((p) => p.active).length;

  const filteredRoles = useMemo(
    () =>
      tierFilter === 'all'
        ? ROLE_BLUEPRINTS
        : ROLE_BLUEPRINTS.filter((r) => r.tier === tierFilter),
    [tierFilter]
  );

  const activeBlueprint = useMemo(
    () => ROLE_BLUEPRINTS.find((r) => r.role === selectedRole) ?? ROLE_BLUEPRINTS[0],
    [selectedRole]
  );

  const stages = useMemo(
    () => [
      {
        step: '01',
        icon: ScanLine,
        accent: 'text-cyan-400 border-cyan-500/30',
        titleAr: 'بوابة الدخول والتحقق الذكي',
        titleEn: 'Intake & Edge Gate Control',
        descAr: 'قراءة لوحات ANPR بالذكاء الاصطناعي + المسح السريع لتذاكر QR + تصاريح الأساطيل وطابور عدم الاتصال.',
        descEn: 'AI ANPR vision, camera Quick Scan QR check-in, fleet whitelist & offline sync queue.',
        liveStat: `${anprScanLogs.length} ${t(lang, 'حركة مسح', 'scans')} · ${activePermitsCount} ${t(lang, 'تصريح VIP', 'permits')}`,
      },
      {
        step: '02',
        icon: Cpu,
        accent: 'text-emerald-400 border-emerald-500/30',
        titleAr: 'التوجيه والتسعير والتوأم الرقمي + 101/107',
        titleEn: 'Bay Allocation, 101/107 & Digital Twin',
        descAr: 'توجيه تلقائي للموقف الأنسب، ربط مسارات 101 وفعاليات 107، وتوسعة آلية في المحاكيين 2D & 3D.',
        descEn: 'Optimal bay routing, Project 101/107 flow binding & synchronized 2D/3D auto-expansion.',
        liveStat: `${occupiedCount}/${spots.length} ${t(lang, 'موقف مشغول', 'bays busy')} · ${reservations.length} ${t(lang, 'حجز', 'bookings')}${activeMergedEvent ? ` · 107: -${activeMergedEvent.wasteReductionPct}%` : ''}${activeMergedTour ? ` · 101: ${activeMergedTour.totalKm}km` : ''}`,
      },
      {
        step: '03',
        icon: Sun,
        accent: 'text-amber-400 border-amber-500/30',
        titleAr: 'الشبكة الشمسية والروبوتات والطقس',
        titleEn: 'PV Microgrid, BESS & Robotics',
        descAr: 'توليد شمسي 250kW، شحن V2G، روبوت الشحن EcoCharge X1 (45kW)، وتنظيف جاف بعد العواصف.',
        descEn: '250kW PV canopy monitoring, V2G dispatch, 45kW EcoCharge X1 bot & dry PV cleaning.',
        liveStat: `${solarKw} kW · BESS ${bessCharge}% · ${robotChargingLogs.length} ${t(lang, 'جلسة روبوت', 'bot runs')}`,
      },
      {
        step: '04',
        icon: Wrench,
        accent: 'text-purple-400 border-purple-500/30',
        titleAr: 'الموثوقية، الصيانة، وتسليم الورديات',
        titleEn: 'Maintenance, Drills & Shift Continuity',
        descAr: 'أوامر عمل تنبؤية، تقييم الشواحن بالنجوم، مناورات أعطال الشبكة والدخان، وتوقيع تسليم الوردية.',
        descEn: 'Predictive work orders, star efficiency ratings, fault/fire drills & signed handovers.',
        liveStat: `${openOrdersCount} ${t(lang, 'أمر مفتوح', 'open WO')} · ${shiftHandovers.length} ${t(lang, 'وردية مسلّمة', 'handovers')}`,
      },
      {
        step: '05',
        icon: Leaf,
        accent: 'text-teal-300 border-teal-400/30',
        titleAr: 'البيئة الخضراء وحوكمة ESG والتقارير',
        titleEn: 'Biophilic Flora, Wallet & ESG Reports',
        descAr: 'تحويل ضريبة الكربون لتشجير وتبريد بيوفيلي، محفظة نقاط السائق، وتوليد تقرير الاستدامة PDF.',
        descEn: 'Carbon-tax afforestation, recycled irrigation, Carbon Wallet store & annual PDF reports.',
        liveStat: `${drillHistory.length} ${t(lang, 'مناورة موثقة', 'drills')} · ${smokeAlert ? t(lang, 'طوارئ نشطة', 'ALERT') : t(lang, 'النظام آمن', 'Nominal')}`,
      },
    ],
    [
      activeMergedEvent,
      activeMergedTour,
      activePermitsCount,
      anprScanLogs.length,
      bessCharge,
      drillHistory.length,
      lang,
      occupiedCount,
      openOrdersCount,
      reservations.length,
      robotChargingLogs.length,
      shiftHandovers.length,
      smokeAlert,
      solarKw,
      spots.length,
    ]
  );

  const slaRows = [
    {
      domainAr: 'بوابة ANPR وتذاكر QR',
      domainEn: 'ANPR Gate & QR Check-In',
      triggerAr: 'عبور مركبة أو انقطاع الإنترنت',
      triggerEn: 'Vehicle arrival or network drop',
      actionAr: 'فتح هيدروليكي < 2.5 ث، أو حفظ في طابور عدم الاتصال ومزامنة تلقائية عند العودة',
      actionEn: 'Hydraulic open < 2.5s or offline queue persistence with auto cloud flush',
      ownerAr: 'المشغّل (Operator)',
      ownerEn: 'Operator',
    },
    {
      domainAr: 'بطاريات BESS ورادار الدخان',
      domainEn: 'BESS Reserve & Smoke Radar',
      triggerAr: 'BESS < 20% / < 10% أو كشف دخان B-04',
      triggerEn: 'BESS < 20% / < 10% or Sector B-04 smoke',
      actionAr: 'إنذار Klaxon/NFPA-72، إيقاف V2G، إطلاق SafeGuard R2، وتصعيد للمشرفين بعد 5 دقائق',
      actionEn: 'Klaxon/NFPA-72 siren, pause V2G, dispatch R2 evac bot, >5m email escalation',
      ownerAr: 'الأمن والطاقة',
      ownerEn: 'Security & Energy',
    },
    {
      domainAr: 'الألواح الشمسية والطقس المتطرف',
      domainEn: 'PV Canopies & Sandstorms',
      triggerAr: 'هبوط الكفاءة < 70% مقارنة بالمتوسط',
      triggerEn: 'Output < 70% of weather baseline',
      actionAr: 'تنبيه صيانة تنبؤي وتفعيل التنظيف الجاف الآلي بشرط سرعة الرياح ≤ 35 كم/س',
      actionEn: 'Predictive alert & dry brush deployment gated by wind ≤ 35 km/h',
      ownerAr: 'الصيانة والطاقة',
      ownerEn: 'Maintenance & Energy',
    },
    {
      domainAr: 'تشبع المواقف والبيئة الخضراء',
      domainEn: 'Bay Saturation & Biophilic Belt',
      triggerAr: 'إشغال 100% أو تحصيل ضريبة كربون',
      triggerEn: '100% bay occupancy or carbon tax collected',
      actionAr: 'توسعة آلية في 2D/3D، توجيه EcoCharge X1، وتمويل وحدة تشجير كل 20 ريال ضريبة',
      actionEn: 'Auto-expand bay in 2D/3D, dispatch EcoCharge X1 & fund 1 flora unit per 20 SAR tax',
      ownerAr: 'مدير المواقف والاستدامة',
      ownerEn: 'Manager & Sustainability',
    },
  ];

  const handleExportSop = () => {
    const lines = [
      '=== ECO-PARK AI v5.0 — OPERATIONAL STRUCTURE & SOP BLUEPRINT ===',
      `Generated: ${new Date().toISOString()}`,
      `Live Telemetry: Bays=${occupiedCount}/${spots.length} | BESS=${bessCharge}% | PV=${solarKw}kW | OpenWO=${openOrdersCount} | Handovers=${shiftHandovers.length}`,
      '',
      '--- 5-STAGE OPERATIONAL PIPELINE ---',
      ...stages.map((s) => `[${s.step}] ${s.titleEn} / ${s.titleAr} -> ${s.liveStat}`),
      '',
      '--- 9-ROLE RBAC GOVERNANCE ---',
      ...ROLE_BLUEPRINTS.map((r) => `- ${r.role} (${r.tier.toUpperCase()}): ${r.scopeEn} | KPI: ${r.kpiEn}`),
      '',
      '--- SLA & ESCALATION MATRIX ---',
      ...slaRows.map((row) => `* ${row.domainEn}: ${row.triggerEn} => ${row.actionEn} [${row.ownerEn}]`),
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eco-park-operational-structure.txt';
    a.click();
    URL.revokeObjectURL(url);
    onNotify(
      t(
        lang,
        'تم تصدير وثيقة الهيكل التشغيلي ودليل التشغيل القياسي (SOP).',
        'Operational Structure & SOP blueprint exported.'
      )
    );
  };

  const FlowArrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Network className="h-5 w-5 text-emerald-400" />
            {t(
              lang,
              'الهيكل التشغيلي القياسي للمشروع (Operational Structure & Governance Blueprint)',
              'Eco-Park AI Operational Structure, Pipeline & Governance Blueprint'
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'خريطة الربط الحية بين التدفق التشغيلي خماسي المراحل، هيكل الأدوار التسعة RBAC، واتفاقيات الاستجابة الآلية SLA.',
              'Live architectural view unifying the 5-stage operational pipeline, 9-role RBAC hierarchy, and automated SLA escalations.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportSop}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition"
        >
          <Download className="h-3.5 w-3.5" />
          {t(lang, 'تصدير الهيكل ودليل SOP', 'Export SOP Blueprint')}
        </button>
      </div>

      {/* Stage 1: 5-Stage End-to-End Live Pipeline */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            {t(lang, '1. خط التدفق التشغيلي المتكامل (5 مراحل متصلة لحظياً)', '1. End-to-End Live Operational Pipeline (5 Stages)')}
          </h3>
          <span className="font-mono text-[11px] text-emerald-400 tabular-nums">
            {t(lang, 'مرتبط مباشرة بقاعدة البيانات Firestore & Telemetries', 'Bound to live Firestore & Telemetry state')}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {stages.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div key={st.step} className="relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-[#0D1E2E] ${st.accent}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-extrabold text-slate-400 tabular-nums">
                        {st.step}
                      </span>
                      {idx < stages.length - 1 && (
                        <FlowArrow className="hidden lg:block h-3.5 w-3.5 text-slate-600" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs font-bold text-white">
                    {lang === 'ar' ? st.titleAr : st.titleEn}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    {lang === 'ar' ? st.descAr : st.descEn}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-2.5 font-mono text-[10px] font-semibold text-emerald-300 tabular-nums">
                  {st.liveStat}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage 2: 3-Tier Organizational Structure & RBAC Inspector */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            {t(lang, '2. الهيكل التنظيمي ومصفوفة الصلاحيات (3 مستويات · 9 أدوار)', '2. Organizational Hierarchy & RBAC Matrix (3 Tiers · 9 Roles)')}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', labelAr: 'الكل (9)', labelEn: 'All (9)' },
                { id: 'command', labelAr: 'القيادة والحوكمة', labelEn: 'Executive Command' },
                { id: 'field', labelAr: 'التشغيل والميدان', labelEn: 'Field Operations' },
                { id: 'eco', labelAr: 'الاستدامة والمستفيدون', labelEn: 'Eco & Drivers' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTierFilter(f.id)}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                  tierFilter === f.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#08121D] text-slate-300 hover:bg-white/5'
                }`}
              >
                {lang === 'ar' ? f.labelAr : f.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {filteredRoles.map((item) => {
              const active = item.role === selectedRole;
              const tierBadge =
                item.tier === 'command'
                  ? 'text-amber-300'
                  : item.tier === 'field'
                    ? 'text-cyan-300'
                    : 'text-emerald-300';
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => setSelectedRole(item.role)}
                  className={`rounded-xl border p-3 text-start transition ${
                    active
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : 'border-white/10 bg-[#08121D] hover:border-white/25'
                  }`}
                >
                  <div className={`font-mono text-[10px] font-bold uppercase ${tierBadge}`}>
                    {item.tier}
                  </div>
                  <div className="mt-1 text-xs font-bold text-white">{item.role}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                    {lang === 'ar' ? item.titleAr : item.titleEn}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-5 rounded-xl border border-emerald-400/30 bg-[#08121D] p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-emerald-400">
                    {activeBlueprint.role}
                  </div>
                  <h4 className="text-sm font-extrabold text-white">
                    {lang === 'ar' ? activeBlueprint.titleAr : activeBlueprint.titleEn}
                  </h4>
                </div>
                <Building2 className="h-5 w-5 text-emerald-400/80" />
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {lang === 'ar' ? activeBlueprint.scopeAr : activeBlueprint.scopeEn}
              </p>

              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                  {t(lang, 'الوحدات والمحاور المرتبطة:', 'Assigned System Modules:')}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(lang === 'ar' ? activeBlueprint.modulesAr : activeBlueprint.modulesEn).map((mod) => (
                    <div
                      key={mod}
                      className="flex items-center gap-1.5 rounded-lg bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] text-slate-200"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
              <span className="font-bold">{t(lang, 'مؤشر الأداء المستهدف (KPI): ', 'Target KPI: ')}</span>
              {lang === 'ar' ? activeBlueprint.kpiAr : activeBlueprint.kpiEn}
            </div>
          </div>
        </div>
      </div>

      {/* Stage 3: SLA & Automated Escalation Rules */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            {t(lang, '3. مصفوفة الاستجابة القياسية والتصعيد التلقائي (SLA Matrix)', '3. Automated SLA & Escalation Protocol Matrix')}
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1"><BatteryCharging className="h-3.5 w-3.5 text-emerald-400" /> BESS {bessCharge}%</span>
            <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5 text-cyan-400" /> EcoCharge + R2</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-amber-300" /> Firestore Rules</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[11px] text-slate-400">
                <th className="py-2.5 pe-3 text-start font-semibold">{t(lang, 'النطاق التشغيلي', 'Operational Domain')}</th>
                <th className="py-2.5 pe-3 text-start font-semibold">{t(lang, 'شرط التفعيل (Trigger)', 'Trigger Condition')}</th>
                <th className="py-2.5 pe-3 text-start font-semibold">{t(lang, 'الإجراء التنفيذي التلقائي', 'Automated SOP Action')}</th>
                <th className="py-2.5 text-start font-semibold">{t(lang, 'الجهة المسؤولة', 'Owner Role')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {slaRows.map((row) => (
                <tr key={row.domainEn} className="hover:bg-white/[0.02]">
                  <td className="py-3 pe-3 font-bold text-white whitespace-nowrap">
                    {lang === 'ar' ? row.domainAr : row.domainEn}
                  </td>
                  <td className="py-3 pe-3 font-mono text-[11px] text-amber-300">
                    {lang === 'ar' ? row.triggerAr : row.triggerEn}
                  </td>
                  <td className="py-3 pe-3 text-slate-300">
                    {lang === 'ar' ? row.actionAr : row.actionEn}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {lang === 'ar' ? row.ownerAr : row.ownerEn}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
