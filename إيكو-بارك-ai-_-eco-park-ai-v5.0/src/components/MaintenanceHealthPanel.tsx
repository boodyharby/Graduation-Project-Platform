import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardEdit,
  Cpu,
  Droplets,
  Flame,
  Gauge,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Sun,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  ChargerEfficiencyRatingEntry,
  ChargerManualMaintenanceRecord,
  Language,
  MaintenanceWorkOrder,
  ParkingSpot,
  RobotChargingSessionLog,
} from '../types/parking';
import { t } from '../data/i18n';
import {
  buildQrMatrix,
  computeLotThermalStats,
  playSensorHeartbeatTick,
  speakGuidance,
} from '../utils/ecoEngine';
import { RobotChargingLogsSection } from './RobotChargingLogsSection';

interface MaintenanceHealthPanelProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  smokeAlert: boolean;
  autoLoadBalance?: boolean;
  thermalGuardLimitC?: number;
  supervisorName?: string;
  chargerRatings?: ChargerEfficiencyRatingEntry[];
  robotChargingLogs?: RobotChargingSessionLog[];
  onVerifyRobotSession?: (logId: string) => void;
  onSimulateBotSession?: (bayId: string) => void;
  onSaveChargerRating?: (entry: ChargerEfficiencyRatingEntry) => void;
  onToggleLoadBalance?: () => void;
  onLogMaintenanceAudit: (actionAr: string, actionEn: string) => void;
  onCreateWorkOrder?: (order: MaintenanceWorkOrder) => void;
  onDispatchSupervisorAlert?: (
    bayLabel: string,
    healthPct: number,
    reasonAr: string,
    reasonEn: string
  ) => void;
  onNotify: (msg: string) => void;
}

interface ChargerPredictiveMetric {
  id: string;
  label: string;
  chargerKw: number;
  balancedKw: number;
  loadThrottled: boolean;
  status: ParkingSpot['status'];
  coilTempC: number;
  thdPct: number;
  impedanceMohm: number;
  healthPct: number;
  rulDays: number;
  predictedWindowAr: string;
  predictedWindowEn: string;
  offPeakSlotAr: string;
  offPeakSlotEn: string;
  tier: 'healthy' | 'approaching' | 'critical';
}

interface PredictiveNoticeRecord {
  id: string;
  bayLabel: string;
  timestamp: string;
  healthPct: number;
  summaryAr: string;
  summaryEn: string;
}

export const MaintenanceHealthPanel: React.FC<MaintenanceHealthPanelProps> = ({
  lang,
  spots,
  bessCharge,
  solarKw,
  smokeAlert,
  autoLoadBalance = true,
  thermalGuardLimitC = 46,
  supervisorName = 'المشرف المناوب',
  chargerRatings = [],
  robotChargingLogs = [],
  onVerifyRobotSession,
  onSimulateBotSession,
  onSaveChargerRating,
  onToggleLoadBalance,
  onLogMaintenanceAudit,
  onCreateWorkOrder,
  onDispatchSupervisorAlert,
  onNotify,
}) => {
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagProgress, setDiagProgress] = useState(100);
  const [mistingCleaning, setMistingCleaning] = useState(false);
  const [testedBayIds, setTestedBayIds] = useState<Record<string, string>>({});

  // Predictive Maintenance & Technician QR State
  const [liveTelemetry, setLiveTelemetry] = useState(true);
  const [tick, setTick] = useState(0);
  const [maintenanceThreshold, setMaintenanceThreshold] = useState<number>(75);
  const [simulatedWearOffset, setSimulatedWearOffset] = useState<Record<string, number>>({});
  const [supervisorNotices, setSupervisorNotices] = useState<PredictiveNoticeRecord[]>([]);
  const [activeTechChargerId, setActiveTechChargerId] = useState<string | null>(null);
  const [completedServicesCount, setCompletedServicesCount] = useState<number>(0);
  const autoAlertedRef = useRef<Record<string, boolean>>({});

  // Manual Supervisor Maintenance Notes, Expected Date & Calibration Status
  const [manualRecords, setManualRecords] = useState<Record<string, ChargerManualMaintenanceRecord>>(() => {
    try {
      const saved = window.localStorage.getItem('ecopark_charger_manual_notes');
      return saved ? (JSON.parse(saved) as Record<string, ChargerManualMaintenanceRecord>) : {};
    } catch {
      return {};
    }
  });
  const [editingChargerId, setEditingChargerId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string>('');
  const [draftNextDate, setDraftNextDate] = useState<string>(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [draftElevateCalibration, setDraftElevateCalibration] = useState<boolean>(true);

  // Efficiency Star Rating (1-5) per Charger Maintenance Log
  const [ratingChargerId, setRatingChargerId] = useState<string | null>(null);
  const [draftStars, setDraftStars] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [draftRatingNote, setDraftRatingNote] = useState<string>('');

  useEffect(() => {
    try {
      window.localStorage.setItem('ecopark_charger_manual_notes', JSON.stringify(manualRecords));
    } catch {
      // ignore storage quota errors
    }
  }, [manualRecords]);

  useEffect(() => {
    const handleWipe = () => {
      setManualRecords({});
      setSupervisorNotices([]);
      setSimulatedWearOffset({});
      setTestedBayIds({});
      setCompletedServicesCount(0);
      autoAlertedRef.current = {};
      try {
        window.localStorage.removeItem('ecopark_charger_manual_notes');
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener('ecopark-data-wiped', handleWipe);
    return () => window.removeEventListener('ecopark-data-wiped', handleWipe);
  }, []);

  // Merge external persisted ratings (Firestore) + per-charger maintenance log entries cleanly
  const ratingsByBay = useMemo(() => {
    const grouped: Record<string, ChargerEfficiencyRatingEntry[]> = {};
    const addEntry = (entry: ChargerEfficiencyRatingEntry) => {
      if (!grouped[entry.bayId]) grouped[entry.bayId] = [];
      if (!grouped[entry.bayId].some((e) => e.id === entry.id)) {
        grouped[entry.bayId].push(entry);
      }
    };
    chargerRatings.forEach(addEntry);
    Object.values(manualRecords).forEach((rec) => {
      rec.efficiencyRatingsLog?.forEach(addEntry);
    });
    return grouped;
  }, [chargerRatings, manualRecords]);

  useEffect(() => {
    if (!liveTelemetry) return;
    const timer = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [liveTelemetry]);

  const thermal = useMemo(
    () => computeLotThermalStats(spots, true, smokeAlert),
    [spots, smokeAlert]
  );

  const evChargers = useMemo(() => spots.filter((s) => s.hasCharger), [spots]);
  const solarEfficiencyPct = Math.min(100, Math.round((solarKw / 250) * 100));
  const occupancyPct = useMemo(
    () => Math.round((spots.filter((s) => s.status !== 'available').length / Math.max(1, spots.length)) * 100),
    [spots]
  );

  // Compute real-time predictive maintenance & load balancing metrics per EV charger
  const predictiveChargers = useMemo<ChargerPredictiveMetric[]>(() => {
    return evChargers.map((spot, idx) => {
      const bayTemp = thermal.bayTemps[spot.id]?.tempC ?? thermal.avgTempC;
      const wave = Math.sin(tick * 0.75 + idx * 1.4);
      const isChargingBusy = spot.status !== 'available';
      const powerStress = (spot.chargerKw / 50) * (isChargingBusy ? 11.5 : 3.2);
      const bessStress = bessCharge < 20 ? 8.5 : bessCharge < 40 ? 3.5 : 0;
      const mistCooling = mistingCleaning ? -4.2 : 0;
      const wearExtra = simulatedWearOffset[spot.id] ?? 0;

      // Dynamic load balancing relief reduces coil temperature & harmonic stress
      const rawTemp =
        bayTemp + (isChargingBusy ? 9.4 : 2.1) + (spot.chargerKw >= 50 ? 4.2 : 1.5) + mistCooling + wave * 1.1 + wearExtra * 0.35;
      const shouldThrottle = autoLoadBalance && (rawTemp >= thermalGuardLimitC - 4 || bessCharge < 30);
      const balancedKw = shouldThrottle ? Math.max(11, Math.round(spot.chargerKw * 0.65)) : spot.chargerKw;
      const thermalRelief = shouldThrottle ? -3.4 : 0;

      const coilTempC = Number(Math.max(24, rawTemp + thermalRelief).toFixed(1));
      const thdPct = Number(
        Math.max(
          1.1,
          1.8 + (isChargingBusy ? 1.4 : 0.3) + (bessCharge < 20 ? 1.9 : 0) + Math.abs(wave) * 0.45 + wearExtra * 0.09 - (shouldThrottle ? 0.35 : 0)
        ).toFixed(2)
      );
      const impedanceMohm = Math.round(
        18 + idx * 2.5 + powerStress * 0.7 + wearExtra * 0.65 + wave * 1.5
      );

      const tempPenalty = Math.max(0, (coilTempC - 36) * 1.35);
      const thdPenalty = Math.max(0, (thdPct - 2.6) * 4.8);
      const impedancePenalty = Math.max(0, (impedanceMohm - 26) * 0.55);
      const rawHealth = 98 - tempPenalty - thdPenalty - impedancePenalty - bessStress - wearExtra * 0.55;
      const healthPct = Math.max(12, Math.min(99, Math.round(rawHealth)));

      const headroom = Math.max(0, healthPct - (maintenanceThreshold - 18));
      const rulDays = Math.max(1, Math.round(headroom * 0.75));
      const predictedWindowAr =
        healthPct <= maintenanceThreshold - 12
          ? 'صيانة فورية خلال 24 ساعة'
          : healthPct <= maintenanceThreshold
            ? `خلال ${Math.min(7, rulDays)} أيام (قريب من العتبة)`
            : `خلال ${rulDays} يوماً`;
      const predictedWindowEn =
        healthPct <= maintenanceThreshold - 12
          ? 'Immediate within 24h'
          : healthPct <= maintenanceThreshold
            ? `Within ${Math.min(7, rulDays)} days (Near threshold)`
            : `In ${rulDays} days`;

      // AI Off-Peak Maintenance Scheduling Recommendation based on occupancy & solar peak
      const offPeakSlotAr =
        healthPct <= maintenanceThreshold
          ? 'الليلة 02:00 – 03:30 ص (إشغال < 10%)'
          : occupancyPct > 60
            ? 'غداً 01:30 – 03:00 ص (خارج الذروة)'
            : 'اليوم 13:30 – 14:45 م (هدوء الظهيرة)';
      const offPeakSlotEn =
        healthPct <= maintenanceThreshold
          ? 'Tonight 02:00 – 03:30 AM (<10% load)'
          : occupancyPct > 60
            ? 'Tomorrow 01:30 – 03:00 AM (Off-peak)'
            : 'Today 01:30 – 02:45 PM (Midday lull)';

      const tier: ChargerPredictiveMetric['tier'] =
        healthPct <= maintenanceThreshold - 12
          ? 'critical'
          : healthPct <= maintenanceThreshold
            ? 'approaching'
            : 'healthy';

      return {
        id: spot.id,
        label: spot.label,
        chargerKw: spot.chargerKw,
        balancedKw,
        loadThrottled: shouldThrottle,
        status: spot.status,
        coilTempC,
        thdPct,
        impedanceMohm,
        healthPct,
        rulDays,
        predictedWindowAr,
        predictedWindowEn,
        offPeakSlotAr,
        offPeakSlotEn,
        tier,
      };
    });
  }, [
    evChargers,
    thermal,
    tick,
    bessCharge,
    mistingCleaning,
    simulatedWearOffset,
    maintenanceThreshold,
    autoLoadBalance,
    thermalGuardLimitC,
    occupancyPct,
  ]);

  const atRiskChargers = useMemo(
    () => predictiveChargers.filter((c) => c.healthPct <= maintenanceThreshold),
    [predictiveChargers, maintenanceThreshold]
  );

  // Multi-Branch Charger Performance Ranking (live local branch + regional network)
  const branchRankings = useMemo(() => {
    const avgLocalHealth =
      predictiveChargers.length > 0
        ? Math.round(predictiveChargers.reduce((acc, c) => acc + c.healthPct, 0) / predictiveChargers.length)
        : 95;
    const avgRul =
      predictiveChargers.length > 0
        ? Math.round(predictiveChargers.reduce((acc, c) => acc + c.rulDays, 0) / predictiveChargers.length)
        : 28;

    return [
      {
        nameAr: 'فرع كفر الشيخ · المعهد العالي (المحطة الحالية)',
        nameEn: 'Kafr El-Sheikh · Higher Institute (Active)',
        healthPct: avgLocalHealth,
        uptimePct: Math.min(99.9, Number((96.4 + avgLocalHealth * 0.035).toFixed(1))),
        rulDays: avgRul,
        chargersCount: evChargers.length,
        isCurrent: true,
      },
      {
        nameAr: 'الفرع الرئيسي · الرياض الذكي',
        nameEn: 'Riyadh Smart Main Hub',
        healthPct: 94,
        uptimePct: 99.6,
        rulDays: 34,
        chargersCount: 12,
        isCurrent: false,
      },
      {
        nameAr: 'فرع جدة الأخضر · الواجهة البحرية',
        nameEn: 'Jeddah Green Waterfront',
        healthPct: 89,
        uptimePct: 98.4,
        rulDays: 23,
        chargersCount: 8,
        isCurrent: false,
      },
      {
        nameAr: 'فرع الدمام الصناعي · الميناء',
        nameEn: 'Dammam Industrial Port',
        healthPct: 83,
        uptimePct: 97.1,
        rulDays: 16,
        chargersCount: 10,
        isCurrent: false,
      },
    ].sort((a, b) => b.healthPct - a.healthPct);
  }, [predictiveChargers, evChargers.length]);

  const activeTechCharger = useMemo(
    () => predictiveChargers.find((c) => c.id === activeTechChargerId) || null,
    [predictiveChargers, activeTechChargerId]
  );

  const techQrMatrix = useMemo(
    () =>
      activeTechCharger
        ? buildQrMatrix(`TECH-ASSET:${activeTechCharger.id}:${activeTechCharger.chargerKw}KW`)
        : [],
    [activeTechCharger]
  );

  // Automatically alert supervisors once per charger when live sensor health approaches threshold
  useEffect(() => {
    atRiskChargers.forEach((charger) => {
      if (!autoAlertedRef.current[charger.id]) {
        autoAlertedRef.current[charger.id] = true;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const reasonAr = `انخفاض مؤشر صحة الشاحن إلى ${charger.healthPct}% (حرارة الملف ${charger.coilTempC}°C · مقاومة ${charger.impedanceMohm}mΩ)`;
        const reasonEn = `Charger health predicted at ${charger.healthPct}% (Coil ${charger.coilTempC}°C · ${charger.impedanceMohm}mΩ)`;

        setSupervisorNotices((prev) => [
          {
            id: `pred-al-${Date.now()}-${charger.id}`,
            bayLabel: charger.label,
            timestamp: nowStr,
            healthPct: charger.healthPct,
            summaryAr: reasonAr,
            summaryEn: reasonEn,
          },
          ...prev.slice(0, 14),
        ]);
        onDispatchSupervisorAlert?.(charger.label, charger.healthPct, reasonAr, reasonEn);
      }
    });

    predictiveChargers.forEach((c) => {
      if (c.healthPct > maintenanceThreshold + 8 && autoAlertedRef.current[c.id]) {
        autoAlertedRef.current[c.id] = false;
      }
    });
  }, [atRiskChargers, predictiveChargers, maintenanceThreshold, onDispatchSupervisorAlert]);

  const handleDispatchOrderAndAlert = (charger: ChargerPredictiveMetric) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reasonAr = `صيانة تنبؤية لشاحن ${charger.label} (${charger.healthPct}% صحة · ${charger.coilTempC}°C · ${charger.thdPct}% THD)`;
    const reasonEn = `Predictive service for ${charger.label} (${charger.healthPct}% health · ${charger.coilTempC}°C · ${charger.thdPct}% THD)`;

    setSupervisorNotices((prev) => [
      {
        id: `pred-manual-${Date.now()}-${charger.id}`,
        bayLabel: charger.label,
        timestamp: nowStr,
        healthPct: charger.healthPct,
        summaryAr: reasonAr,
        summaryEn: reasonEn,
      },
      ...prev.slice(0, 14),
    ]);

    onDispatchSupervisorAlert?.(charger.label, charger.healthPct, reasonAr, reasonEn);
    onCreateWorkOrder?.({
      id: `WO-PM-${Math.floor(1000 + Math.random() * 8999)}`,
      bayId: charger.id,
      issueAr: `صيانة تنبؤية وقائية للشاحن ${charger.label} (${charger.predictedWindowAr})`,
      issueEn: `Predictive preventive service for ${charger.label} (${charger.predictedWindowEn})`,
      priority: charger.tier === 'critical' ? 'critical' : 'high',
      assignee: 'فريق صيانة الطاقة الذكية',
      status: 'open',
      createdAt: nowStr,
      autoDetected: true,
    });
    playSensorHeartbeatTick();
  };

  const handleScheduleOffPeak = (charger: ChargerPredictiveMetric) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    onCreateWorkOrder?.({
      id: `WO-OP-${Math.floor(1000 + Math.random() * 8999)}`,
      bayId: charger.id,
      issueAr: `صيانة مجدولة خارج الذروة (${charger.offPeakSlotAr}) للشاحن ${charger.label}`,
      issueEn: `Off-peak scheduled service (${charger.offPeakSlotEn}) for ${charger.label}`,
      priority: 'routine',
      assignee: 'المناوبة الليلية للصيانة الذكية',
      status: 'open',
      createdAt: nowStr,
      autoDetected: true,
    });
    onLogMaintenanceAudit(
      `جدولة صيانة ذكية خارج أوقات الذروة للشاحن ${charger.label}: ${charger.offPeakSlotAr}`,
      `Scheduled off-peak AI maintenance for ${charger.label}: ${charger.offPeakSlotEn}`
    );
    playSensorHeartbeatTick();
    onNotify(
      t(
        lang,
        `تمت جدولة صيانة ${charger.label} في الفترة الهادئة: ${charger.offPeakSlotAr}`,
        `Scheduled ${charger.label} maintenance during off-peak window: ${charger.offPeakSlotEn}`
      )
    );
  };

  const handleCompleteFieldService = (charger: ChargerPredictiveMetric) => {
    setSimulatedWearOffset((prev) => ({ ...prev, [charger.id]: 0 }));
    autoAlertedRef.current[charger.id] = false;
    setCompletedServicesCount((c) => c + 1);
    const tStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTestedBayIds((prev) => ({ ...prev, [charger.id]: tStr }));
    onLogMaintenanceAudit(
      `إتمام صيانة ميدانية عبر بطاقة QR الفني للشاحن ${charger.label} وإعادة المعايرة`,
      `Completed QR field service for charger ${charger.label} & recalibrated telemetry`
    );
    playSensorHeartbeatTick();
    setActiveTechChargerId(null);
    onNotify(
      t(
        lang,
        `تم إغلاق الصيانة الميدانية للشاحن ${charger.label} واستعادة الكفاءة!`,
        `Field service completed for ${charger.label} — efficiency restored!`
      )
    );
  };

  const openManualNoteEditor = (charger: ChargerPredictiveMetric) => {
    const existing = manualRecords[charger.id];
    setEditingChargerId(charger.id);
    setDraftNote(existing?.manualNote || '');
    setDraftNextDate(
      existing?.expectedNextDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    );
    setDraftElevateCalibration(true);
  };

  const handleStartCalibration = (charger: ChargerPredictiveMetric) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const existing = manualRecords[charger.id];
    const nextDate =
      existing?.expectedNextDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    setManualRecords((prev) => ({
      ...prev,
      [charger.id]: {
        bayId: charger.id,
        status: 'calibrating',
        manualNote:
          existing?.manualNote ||
          t(
            lang,
            'بدء معايرة الجهد والحرارة ومقاومة الموصلات.',
            'Started voltage, thermal & impedance calibration.'
          ),
        expectedNextDate: nextDate,
        calibrationStartedAt: nowStr,
        updatedAt: nowStr,
        updatedBy: 'المشرف المناوب',
      },
    }));

    onLogMaintenanceAudit(
      `بدء معايرة الشاحن ${charger.label} ورفع حالته إلى «قيد المعايرة»`,
      `Started calibration for charger ${charger.label} — status elevated to Under Calibration`
    );
    playSensorHeartbeatTick();
    onNotify(
      t(
        lang,
        `تم رفع حالة الشاحن ${charger.label} إلى «قيد المعايرة».`,
        `Charger ${charger.label} status elevated to Under Calibration.`
      )
    );
  };

  const handleSaveManualNoteAndStart = (charger: ChargerPredictiveMetric) => {
    const trimmedNote = draftNote.trim();
    if (!trimmedNote || !draftNextDate) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nextStatus = draftElevateCalibration
      ? 'calibrating'
      : manualRecords[charger.id]?.status === 'calibrating'
        ? 'calibrating'
        : charger.healthPct <= maintenanceThreshold
          ? 'service_required'
          : 'operational';

    setManualRecords((prev) => ({
      ...prev,
      [charger.id]: {
        bayId: charger.id,
        status: nextStatus,
        manualNote: trimmedNote,
        expectedNextDate: draftNextDate,
        calibrationStartedAt:
          nextStatus === 'calibrating'
            ? prev[charger.id]?.calibrationStartedAt || nowStr
            : prev[charger.id]?.calibrationStartedAt,
        updatedAt: nowStr,
        updatedBy: 'المشرف المناوب',
      },
    }));

    onCreateWorkOrder?.({
      id: `WO-MAN-${Math.floor(1000 + Math.random() * 8999)}`,
      bayId: charger.id,
      issueAr: `ملاحظة مشرف (${charger.label}): ${trimmedNote} · موعد الصيانة: ${draftNextDate}`,
      issueEn: `Supervisor note (${charger.label}): ${trimmedNote} · Next due: ${draftNextDate}`,
      priority: nextStatus === 'calibrating' ? 'high' : 'routine',
      assignee: 'فريق المعايرة والصيانة',
      status: nextStatus === 'calibrating' ? 'in_progress' : 'open',
      createdAt: nowStr,
      autoDetected: false,
    });

    onLogMaintenanceAudit(
      `إضافة ملاحظة صيانة يدوية للشاحن ${charger.label} (الموعد القادم ${draftNextDate})${
        nextStatus === 'calibrating' ? ' ورفع الحالة إلى «قيد المعايرة»' : ''
      }`,
      `Added manual maintenance note for ${charger.label} (due ${draftNextDate})${
        nextStatus === 'calibrating' ? ' & elevated status to Under Calibration' : ''
      }`
    );
    playSensorHeartbeatTick();
    setEditingChargerId(null);
    onNotify(
      t(
        lang,
        nextStatus === 'calibrating'
          ? `تم حفظ الملاحظة وتحديد الموعد ${draftNextDate} ورفع حالة ${charger.label} إلى «قيد المعايرة».`
          : `تم حفظ ملاحظة الصيانة اليدوية للشاحن ${charger.label} (الموعد القادم: ${draftNextDate}).`,
        nextStatus === 'calibrating'
          ? `Saved manual note (due ${draftNextDate}) and set ${charger.label} to Under Calibration.`
          : `Saved manual maintenance note for ${charger.label} (next due ${draftNextDate}).`
      )
    );
  };

  const handleFinishCalibration = (charger: ChargerPredictiveMetric) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const existing = manualRecords[charger.id];
    setManualRecords((prev) => ({
      ...prev,
      [charger.id]: {
        bayId: charger.id,
        status: 'operational',
        manualNote:
          existing?.manualNote ||
          t(lang, 'اكتملت المعايرة الدورية بنجاح.', 'Routine calibration completed.'),
        expectedNextDate:
          existing?.expectedNextDate ||
          new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        updatedAt: nowStr,
        updatedBy: 'المشرف المناوب',
      },
    }));
    setSimulatedWearOffset((prev) => ({ ...prev, [charger.id]: 0 }));
    autoAlertedRef.current[charger.id] = false;
    setCompletedServicesCount((c) => c + 1);
    onLogMaintenanceAudit(
      `إتمام معايرة الشاحن ${charger.label} وإعادته إلى التشغيل الطبيعي`,
      `Completed calibration for charger ${charger.label} — restored to Operational`
    );
    playSensorHeartbeatTick();
    onNotify(
      t(
        lang,
        `اكتملت معايرة الشاحن ${charger.label} وعاد للعمل بكفاءة طبيعية.`,
        `Calibration finished for ${charger.label} — back online.`
      )
    );
  };

  const openRatingEditor = (charger: ChargerPredictiveMetric) => {
    const existingLog = ratingsByBay[charger.id];
    const latest = existingLog?.[0]?.rating ?? 5;
    setRatingChargerId(charger.id);
    setDraftStars(latest);
    setHoverStars(0);
    setDraftRatingNote('');
  };

  const getRatingDescriptor = (stars: number) => {
    switch (stars) {
      case 5:
        return t(lang, 'ممتاز (كفاءة قصوى)', 'Excellent (Peak Efficiency)');
      case 4:
        return t(lang, 'جيد جداً', 'Very Good');
      case 3:
        return t(lang, 'متوسط (مستقر)', 'Average (Stable)');
      case 2:
        return t(lang, 'ضعيف (يحتاج مراجعة)', 'Fair (Needs Review)');
      default:
        return t(lang, 'ضعيف جداً (يتطلب صيانة)', 'Poor (Requires Service)');
    }
  };

  const handleSaveEfficiencyRating = (charger: ChargerPredictiveMetric) => {
    const now = new Date();
    const ratedAt = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const trimmedComment = draftRatingNote.trim();
    const defaultNote = t(
      lang,
      `تقييم كفاءة الشاحن ${charger.label}: ${draftStars} من 5 نجوم (الصحة ${charger.healthPct}%).`,
      `Efficiency rating for ${charger.label}: ${draftStars}/5 stars (${charger.healthPct}% health).`
    );

    const newEntry: ChargerEfficiencyRatingEntry = {
      id: `rate-${charger.id}-${Date.now()}`,
      bayId: charger.id,
      bayLabel: charger.label,
      rating: draftStars,
      note: (trimmedComment || defaultNote).slice(0, 240),
      ratedAt,
      ratedBy: (supervisorName || 'المشرف المناوب').slice(0, 100),
    };

    setManualRecords((prev) => {
      const existing = prev[charger.id];
      const nextLog = [newEntry, ...(existing?.efficiencyRatingsLog || [])].slice(0, 20);
      return {
        ...prev,
        [charger.id]: {
          bayId: charger.id,
          status:
            existing?.status ||
            (charger.healthPct <= maintenanceThreshold ? 'service_required' : 'operational'),
          manualNote: existing?.manualNote || newEntry.note,
          expectedNextDate:
            existing?.expectedNextDate ||
            new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          calibrationStartedAt: existing?.calibrationStartedAt,
          updatedAt: ratedAt,
          updatedBy: newEntry.ratedBy,
          latestEfficiencyRating: draftStars,
          efficiencyRatingsLog: nextLog,
        },
      };
    });

    onSaveChargerRating?.(newEntry);
    onLogMaintenanceAudit(
      `تقييم كفاءة الشاحن ${charger.label} بـ ${draftStars}/5 نجوم وتخزينه في سجل صيانة الشاحن`,
      `Rated charger ${charger.label} efficiency ${draftStars}/5 stars in charger maintenance records`
    );
    playSensorHeartbeatTick();
    setRatingChargerId(null);
    setDraftRatingNote('');
    onNotify(
      t(
        lang,
        `تم حفظ تقييم كفاءة الشاحن ${charger.label} (${draftStars}/5 نجوم) في سجلات الصيانة.`,
        `Saved ${draftStars}/5 efficiency rating to ${charger.label} maintenance records.`
      )
    );
  };

  const runFullDiagnostic = () => {
    setDiagRunning(true);
    setDiagProgress(12);
    playSensorHeartbeatTick();

    let step = 12;
    const timer = window.setInterval(() => {
      step += 22;
      if (step >= 100) {
        window.clearInterval(timer);
        setDiagProgress(100);
        setDiagRunning(false);
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nextMap: Record<string, string> = {};
        spots.forEach((s) => {
          nextMap[s.id] = nowStr;
        });
        setTestedBayIds(nextMap);
        playSensorHeartbeatTick();
        onLogMaintenanceAudit(
          `فحص صيانة شامل لـ ${spots.length} موقف و ${evChargers.length} شاحن EV`,
          `Full hardware self-check completed across ${spots.length} bays & ${evChargers.length} EV chargers`
        );
        onNotify(
          t(
            lang,
            `اكتمل الفحص الذكي لجميع الحساسات والشواحن (${spots.length} مواقف).`,
            `Smart diagnostics completed across all ${spots.length} bays & chargers.`
          )
        );
      } else {
        setDiagProgress(step);
      }
    }, 320);
  };

  const handleToggleMistingWash = () => {
    const next = !mistingCleaning;
    setMistingCleaning(next);
    playSensorHeartbeatTick();
    if (next) {
      speakGuidance(
        lang === 'ar'
          ? 'بدء دورة التبريد والتنظيف الذاتي للمظلات الشمسية.'
          : 'Initiating solar canopy cooling and automated mist wash cycle.',
        lang
      );
      onLogMaintenanceAudit(
        'تشغيل دورة التنظيف والتبريد المائي للمظلات الشمسية',
        'Activated automated solar canopy water-mist cooling wash cycle'
      );
      onNotify(
        t(
          lang,
          'تم تشغيل دورة التبريد بالرذاذ وتنظيف الألواح الشمسية.',
          'Water-mist cooling & solar panel wash cycle active.'
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 4 Hardware & Sensor Health KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'حساسات الأرضية والأمان', 'Ultrasonic & Gas Sensors')}</span>
            <Cpu className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
            {spots.length * 3} / {spots.length * 3}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t(lang, 'اتصال لحظي سليم 100%', '100% Real-Time Telemetry Online')}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'صحة شواحن EV الذكية', 'EV Chargers Readiness')}</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-cyan-400 tabular-nums">
            {evChargers.length} {t(lang, 'وحدات', 'Units')}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {atRiskChargers.length > 0
              ? t(
                  lang,
                  `${atRiskChargers.length} شاحن يقترب من عتبة الصيانة`,
                  `${atRiskChargers.length} charger(s) near service threshold`
                )
              : t(lang, `مكتمل ميدانياً: ${completedServicesCount}`, `Field Services Closed: ${completedServicesCount}`)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'كفاءة المظلات الشمسية', 'Solar Canopy Yield')}</span>
            <Sun className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-amber-400 tabular-nums">
            {solarEfficiencyPct}% ({solarKw} kW)
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {mistingCleaning
              ? t(lang, 'دورة التنظيف المائي نشطة', 'Auto Mist Wash Running')
              : t(lang, 'الألواح نظيفة ومستقرة', 'Panels Nominal')}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'موازنة الأحمال والحرارة', 'Thermal & Load Balance')}</span>
            <Activity className={`h-4 w-4 ${bessCharge < 20 ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-extrabold tabular-nums ${
              bessCharge < 20 ? 'text-red-400' : 'text-emerald-300'
            }`}
          >
            {thermal.avgTempC}°C
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {autoLoadBalance
              ? t(lang, `موازنة نشطة · حد ${thermalGuardLimitC}°C`, `Load Balance ON · Cap ${thermalGuardLimitC}°C`)
              : t(lang, `متوسط حرارة الساحة (${bessCharge}% BESS)`, `Lot Mean (${bessCharge}% BESS)`)}
          </div>
        </div>
      </div>

      {/* Predictive Maintenance, Load Balancing & Off-Peak Scheduler */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-400" />
              <span>
                {t(
                  lang,
                  'التنبؤ الذكي بصيانة الشواحن وموازنة الأحمال وبطاقات QR الفنية',
                  'Predictive Charger Maintenance, Load Balancing & Field QR Tags'
                )}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'يحلل حرارة الملفات اللحظية، التشوه التوافقي (THD)، ومقاومة الموصلات مع موازنة الأحمال التلقائية وجدولة الصيانة خارج الذروة.',
                'Analyzes coil thermal load, THD, and impedance with auto load balancing, off-peak scheduling, and technician QR asset tags.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onToggleLoadBalance && (
              <button
                type="button"
                onClick={onToggleLoadBalance}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  autoLoadBalance
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-[#08121D] text-slate-300'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                {autoLoadBalance
                  ? t(lang, 'موازنة الأحمال: مفعّلة', 'Load Balance: ON')
                  : t(lang, 'تفعيل موازنة الأحمال', 'Enable Load Balance')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setLiveTelemetry((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                liveTelemetry
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/10 bg-[#08121D] text-slate-300'
              }`}
            >
              {liveTelemetry ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {liveTelemetry
                ? t(lang, 'البث الحسي متصل', 'Live Sensors On')
                : t(lang, 'استئناف البث', 'Resume Stream')}
            </button>

            <button
              type="button"
              onClick={() => {
                const target = evChargers[0];
                if (!target) return;
                setSimulatedWearOffset((prev) => ({
                  ...prev,
                  [target.id]: (prev[target.id] ?? 0) >= 24 ? 0 : 28,
                }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
            >
              <Flame className="h-3.5 w-3.5" />
              {Object.values(simulatedWearOffset).some((v) => v >= 24)
                ? t(lang, 'إعادة معايرة الشاحن', 'Reset Wear Test')
                : t(lang, 'محاكاة إجهاد شاحن', 'Simulate Charger Wear')}
            </button>
          </div>
        </div>

        {/* Threshold Control & Immediate Risk Banner */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">
                {t(lang, 'عتبة تنبيه المشرفين للصحة (%)', 'Supervisor Alert Threshold (%)')}
              </span>
              <span className="font-mono font-bold text-amber-300 tabular-nums">
                ≤ {maintenanceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min={55}
              max={92}
              step={1}
              value={maintenanceThreshold}
              onChange={(e) => setMaintenanceThreshold(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="text-[11px] text-slate-400">
              {t(
                lang,
                'يُرسل إشعار تلقائي للمشرفين عند هبوط صحة أي شاحن إلى هذه العتبة أو أدنى.',
                'Supervisors are notified automatically when any EV charger drops to or below this score.'
              )}
            </div>
          </div>

          <div
            className={`lg:col-span-2 rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
              atRiskChargers.length > 0
                ? 'border-amber-400/50 bg-amber-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {atRiskChargers.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-bold text-white">
                  {atRiskChargers.length > 0
                    ? t(
                        lang,
                        `تحذير استباقي: ${atRiskChargers.map((c) => c.label).join('، ')} يقترب من عتبة الصيانة!`,
                        `Proactive Alert: ${atRiskChargers.map((c) => c.label).join(', ')} approaching maintenance threshold!`
                      )
                    : t(
                        lang,
                        'جميع الشواحن الكهربائية تعمل ضمن النطاق الآمن فوق عتبة الصيانة',
                        'All EV Chargers Operating Safely Above Maintenance Threshold'
                      )}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {atRiskChargers.length > 0
                    ? t(
                        lang,
                        'تم إرسال تنبيه للمشرفين؛ يمكنك فتح أمر عمل أو جدولة صيانة خارج الذروة فوراً.',
                        'Supervisor notification dispatched; open a preventive ticket or schedule off-peak service.'
                      )
                    : t(
                        lang,
                        'تتم مراقبة الحرارة والتشوه التوافقي ومقاومة المقابس كل ثانيتين مع موازنة الأحمال.',
                        'Monitoring coil thermal load, THD, and impedance every 2s with load balancing.'
                      )}
                </div>
              </div>
            </div>

            {atRiskChargers.length > 0 && (
              <button
                type="button"
                onClick={() => handleDispatchOrderAndAlert(atRiskChargers[0])}
                className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shrink-0"
              >
                <BellRing className="h-3.5 w-3.5" />
                {t(lang, 'إشعار المشرفين + أمر عمل', 'Alert Supervisors & Open Ticket')}
              </button>
            )}
          </div>
        </div>

        {/* Predictive Health Bar Chart */}
        <div className="h-60 w-full rounded-xl border border-white/5 bg-[#08121D] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={predictiveChargers} margin={{ top: 14, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A1724',
                  borderColor: 'rgba(34,211,238,0.4)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
                formatter={(value, _name, item) => {
                  const row = item?.payload as ChargerPredictiveMetric | undefined;
                  return [
                    `${value ?? 0}% (${row?.coilTempC ?? '--'}°C · ${row?.balancedKw ?? '--'}kW)`,
                    lang === 'ar' ? row?.predictedWindowAr || '' : row?.predictedWindowEn || '',
                  ];
                }}
              />
              <ReferenceLine
                y={maintenanceThreshold}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `${maintenanceThreshold}% Threshold`,
                  fill: '#fbbf24',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Bar dataKey="healthPct" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {predictiveChargers.map((entry) => {
                  const color =
                    entry.tier === 'critical'
                      ? '#EF4444'
                      : entry.tier === 'approaching'
                        ? '#F59E0B'
                        : '#10B981';
                  return <Cell key={entry.id} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-Charger Live Predictive Cards + Off-Peak Schedule + Field QR + Efficiency Rating */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {predictiveChargers.map((c) => {
            const manualRec = manualRecords[c.id];
            const isCalibrating = manualRec?.status === 'calibrating';
            const bayRatings = ratingsByBay[c.id] || [];
            const latestRating = bayRatings[0]?.rating ?? manualRec?.latestEfficiencyRating;
            const avgRating =
              bayRatings.length > 0
                ? Number(
                    (
                      bayRatings.reduce((acc, item) => acc + item.rating, 0) / bayRatings.length
                    ).toFixed(1)
                  )
                : latestRating;
            const isRatingOpen = ratingChargerId === c.id;
            const displayStars = hoverStars > 0 ? hoverStars : draftStars;

            return (
              <div
                key={c.id}
                className={`rounded-xl border p-4 space-y-3 bg-[#08121D] ${
                  isCalibrating
                    ? 'border-cyan-400/60'
                    : c.tier === 'critical'
                      ? 'border-red-500/60'
                      : c.tier === 'approaching'
                        ? 'border-amber-400/50'
                        : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-sm font-extrabold text-white">
                    {c.label} · {c.balancedKw}kW
                    {c.loadThrottled && (
                      <span className="ms-2 text-[11px] font-semibold text-amber-300">
                        ({t(lang, `موزون من ${c.chargerKw}kW`, `Balanced from ${c.chargerKw}kW`)})
                      </span>
                    )}
                    {isCalibrating && (
                      <span className="ms-2 text-[11px] font-bold text-cyan-300">
                        · {t(lang, 'قيد المعايرة', 'Under Calibration')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {avgRating && (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-300 tabular-nums"
                        title={t(lang, 'تقييم كفاءة الشاحن', 'Charger Efficiency Rating')}
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {avgRating}/5
                      </span>
                    )}
                    <span
                      className={`font-mono text-sm font-extrabold tabular-nums ${
                        c.tier === 'critical'
                          ? 'text-red-400'
                          : c.tier === 'approaching'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    >
                      {c.healthPct}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 border-y border-white/5 py-2">
                  <div>
                    <div className="text-slate-500">{t(lang, 'حرارة الملف', 'Coil')}</div>
                    <div className="font-mono font-bold tabular-nums text-cyan-300">{c.coilTempC}°C</div>
                  </div>
                  <div>
                    <div className="text-slate-500">THD</div>
                    <div className="font-mono font-bold tabular-nums text-slate-200">{c.thdPct}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{t(lang, 'المقاومة', 'Imped.')}</div>
                    <div className="font-mono font-bold tabular-nums text-slate-200">{c.impedanceMohm}mΩ</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    {lang === 'ar' ? c.offPeakSlotAr : c.offPeakSlotEn}
                  </span>
                  <span className="text-slate-400">
                    {lang === 'ar' ? c.predictedWindowAr : c.predictedWindowEn}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openRatingEditor(c)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                      isRatingOpen
                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                        : 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${isRatingOpen ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-400'}`} />
                    {t(lang, 'تقييم كفاءة الشاحن', 'Rate Charger Efficiency')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScheduleOffPeak(c)}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    {t(lang, 'جدولة خارج الذروة', 'Schedule Off-Peak')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTechChargerId(c.id)}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <QrCode className="h-3 w-3" />
                    {t(lang, 'بطاقة QR الفني', 'Tech QR Tag')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openManualNoteEditor(c)}
                    className="flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20"
                  >
                    <ClipboardEdit className="h-3 w-3" />
                    {t(lang, 'ملاحظة ومعايرة', 'Note & Calibrate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchOrderAndAlert(c)}
                    className="rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-amber-400/50"
                  >
                    {t(lang, 'إشعار المشرف', 'Notify')}
                  </button>
                </div>

                {/* Inline 1-5 Star Efficiency Rating Form for this Charger */}
                {isRatingOpen && (
                  <div className="rounded-xl border border-amber-400/40 bg-[#0D1E2E] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-300">
                        {t(
                          lang,
                          `تقييم كفاءة الشاحن ${c.label} (1 – 5 نجوم)`,
                          `Rate Charger ${c.label} Efficiency (1–5 Stars)`
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRatingChargerId(null)}
                        className="text-slate-400 hover:text-white"
                        aria-label={t(lang, 'إغلاق التقييم', 'Close rating')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className="flex items-center gap-1.5"
                        onMouseLeave={() => setHoverStars(0)}
                      >
                        {([1, 2, 3, 4, 5] as const).map((starValue) => {
                          const active = starValue <= displayStars;
                          return (
                            <button
                              key={starValue}
                              type="button"
                              onMouseEnter={() => setHoverStars(starValue)}
                              onClick={() => setDraftStars(starValue)}
                              aria-label={`${starValue} ${t(lang, 'نجوم', 'stars')}`}
                              className="rounded-md p-1 transition hover:scale-110 focus:outline-none"
                            >
                              <Star
                                className={`h-6 w-6 transition ${
                                  active
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-600 hover:text-amber-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-200 tabular-nums">
                        {displayStars}/5 · {getRatingDescriptor(displayStars)}
                      </span>
                    </div>

                    <input
                      type="text"
                      maxLength={220}
                      value={draftRatingNote}
                      onChange={(e) => setDraftRatingNote(e.target.value)}
                      placeholder={t(
                        lang,
                        'ملاحظة المشرف حول أداء الشاحن وثبات التيار (اختياري)...',
                        'Supervisor observation on charger stability & output (optional)...'
                      )}
                      className="w-full rounded-lg border border-white/15 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRatingChargerId(null)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/5"
                      >
                        {t(lang, 'إلغاء', 'Cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEfficiencyRating(c)}
                        className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-300"
                      >
                        {t(lang, 'حفظ في سجل صيانة الشاحن', 'Save to Maintenance Log')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Per-Charger Stored Efficiency Ratings History */}
                {bayRatings.length > 0 && (
                  <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {t(
                          lang,
                          `سجل تقييمات الكفاءة (${bayRatings.length})`,
                          `Maintenance Efficiency Log (${bayRatings.length})`
                        )}
                      </span>
                      <span className="font-mono text-amber-300 tabular-nums">
                        {t(lang, `المتوسط: ${avgRating} ★`, `Avg: ${avgRating} ★`)}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto pe-1">
                      {bayRatings.slice(0, 3).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-white/5 bg-[#0D1E2E]/80 px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3 w-3 ${
                                    n <= entry.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                                  }`}
                                />
                              ))}
                              <span className="ms-1 font-mono font-bold text-amber-200 tabular-nums">
                                ({entry.rating}/5)
                              </span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                              {entry.ratedBy} · {entry.ratedAt}
                            </span>
                          </div>
                          {entry.note && (
                            <div className="mt-0.5 text-slate-300 truncate" title={entry.note}>
                              {entry.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* EV Charger Maintenance Schedule Table (Manual Notes + Expected Next Date + Calibration State) */}
        <div className="border-t border-white/10 pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                {t(
                  lang,
                  'جدول صيانة الشواحن وملاحظات المشرفين اليدوية',
                  'EV Charger Maintenance Schedule & Supervisor Manual Notes'
                )}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t(
                  lang,
                  'أضف ملاحظة صيانة يدوية وحدد التاريخ المتوقع للصيانة القادمة مع رفع حالة الشاحن تلقائياً إلى «قيد المعايرة» عند البدء.',
                  'Log manual maintenance notes, set expected next service date, and elevate charger status to Under Calibration on start.'
                )}
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-300 tabular-nums">
              {t(
                lang,
                `قيد المعايرة حالياً: ${Object.values(manualRecords).filter((r) => r.status === 'calibrating').length} شواحن`,
                `Under Calibration: ${Object.values(manualRecords).filter((r) => r.status === 'calibrating').length}`
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#08121D]">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#0B1927] text-slate-400">
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'الشاحن / القدرة', 'Charger / kW')}</th>
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'الحالة التشغيلية', 'Status')}</th>
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'الصحة / الحرارة', 'Health / Temp')}</th>
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'ملاحظة الصيانة اليدوية', 'Manual Maintenance Note')}</th>
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'الصيانة القادمة المتوقعة', 'Expected Next Service')}</th>
                  <th className="px-3.5 py-3 font-semibold text-start">{t(lang, 'الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {predictiveChargers.map((c) => {
                  const rec = manualRecords[c.id];
                  const isCalibrating = rec?.status === 'calibrating';
                  const isEditing = editingChargerId === c.id;
                  const rowRatings = ratingsByBay[c.id] || [];
                  const latestStar = rowRatings[0]?.rating ?? rec?.latestEfficiencyRating;
                  const statusLabel = isCalibrating
                    ? t(lang, 'قيد المعايرة', 'Under Calibration')
                    : c.healthPct <= maintenanceThreshold
                      ? t(lang, 'يحتاج صيانة', 'Service Due')
                      : t(lang, 'تشغيل طبيعي', 'Operational');

                  return (
                    <React.Fragment key={`row-${c.id}`}>
                      <tr className="hover:bg-white/[0.02] transition">
                        <td className="px-3.5 py-3 font-mono font-bold text-white whitespace-nowrap">
                          {c.label} · {c.balancedKw}kW
                          {latestStar && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-300 tabular-nums">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span>{latestStar}/5 ({rowRatings.length || 1})</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              isCalibrating
                                ? 'text-cyan-300'
                                : c.healthPct <= maintenanceThreshold
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {isCalibrating && rec?.calibrationStartedAt && (
                            <div className="font-mono text-[10px] text-slate-400">
                              {t(lang, `بدأ: ${rec.calibrationStartedAt}`, `Started: ${rec.calibrationStartedAt}`)}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              c.tier === 'critical'
                                ? 'text-red-400 font-bold'
                                : c.tier === 'approaching'
                                  ? 'text-amber-300 font-bold'
                                  : 'text-emerald-400 font-bold'
                            }
                          >
                            {c.healthPct}%
                          </span>
                          <span className="text-slate-500"> · </span>
                          <span className="text-cyan-300">{c.coilTempC}°C</span>
                        </td>
                        <td className="px-3.5 py-3 max-w-xs">
                          {rec?.manualNote ? (
                            <div>
                              <div className="text-slate-100 leading-relaxed">{rec.manualNote}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
                                {rec.updatedBy} · {rec.updatedAt}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">
                              {t(lang, 'لا توجد ملاحظة يدوية مسجلة', 'No manual note logged')}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-mono tabular-nums whitespace-nowrap">
                          {rec?.expectedNextDate ? (
                            <span className="text-amber-300">{rec.expectedNextDate}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openManualNoteEditor(c)}
                              className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              {rec?.manualNote
                                ? t(lang, 'تعديل الملاحظة', 'Edit Note')
                                : t(lang, 'ملاحظة يدوية', 'Add Manual Note')}
                            </button>

                            <button
                              type="button"
                              onClick={() => openRatingEditor(c)}
                              className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20"
                            >
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {t(lang, 'تقييم الكفاءة', 'Rate')}
                            </button>

                            {!isCalibrating ? (
                              <button
                                type="button"
                                onClick={() => handleStartCalibration(c)}
                                className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-300"
                              >
                                <SlidersHorizontal className="h-3 w-3" />
                                {t(lang, 'بدء المعايرة', 'Start Calibration')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFinishCalibration(c)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {t(lang, 'إتمام المعايرة', 'Complete')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isEditing && (
                        <tr className="bg-[#0B1927]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-cyan-300">
                                  {t(
                                    lang,
                                    `تسجيل ملاحظة صيانة يدوية للشاحن ${c.label}`,
                                    `Manual Supervisor Maintenance Note for ${c.label}`
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingChargerId(null)}
                                  className="text-slate-400 hover:text-white"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="md:col-span-2">
                                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                                    {t(lang, 'ملاحظة الصيانة اليدوية', 'Manual Maintenance Note')}
                                  </label>
                                  <input
                                    type="text"
                                    value={draftNote}
                                    onChange={(e) => setDraftNote(e.target.value)}
                                    placeholder={t(
                                      lang,
                                      'مثال: فحص توصيلات الكابل، معايرة حساس الحرارة، استبدال فلتر التبريد...',
                                      'e.g., Inspect cable lugs, calibrate coil sensor, replace cooling filter...'
                                    )}
                                    className="w-full rounded-lg border border-white/15 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                                    {t(lang, 'التاريخ المتوقع للصيانة القادمة', 'Expected Next Maintenance Date')}
                                  </label>
                                  <input
                                    type="date"
                                    value={draftNextDate}
                                    onChange={(e) => setDraftNextDate(e.target.value)}
                                    className="w-full rounded-lg border border-white/15 bg-[#08121D] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={draftElevateCalibration}
                                    onChange={(e) => setDraftElevateCalibration(e.target.checked)}
                                    className="h-4 w-4 accent-cyan-400 rounded"
                                  />
                                  <span>
                                    {t(
                                      lang,
                                      'رفع حالة الشاحن فوراً إلى «قيد المعايرة» عند البدء والحفظ',
                                      'Elevate charger status to «Under Calibration» immediately on start'
                                    )}
                                  </span>
                                </label>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingChargerId(null)}
                                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                                  >
                                    {t(lang, 'إلغاء', 'Cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!draftNote.trim() || !draftNextDate}
                                    onClick={() => handleSaveManualNoteAndStart(c)}
                                    className="rounded-lg bg-cyan-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                                  >
                                    {draftElevateCalibration
                                      ? t(lang, 'حفظ وبدء المعايرة', 'Save & Start Calibration')
                                      : t(lang, 'حفظ الملاحظة', 'Save Manual Note')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-Branch Charger Performance Ranking */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-amber-400" />
              {t(lang, 'ترتيب كفاءة الشواحن عبر الفروع لتوجيه ميزانية الصيانة', 'Multi-Branch EV Charger Performance Ranking')}
            </h3>
            <span className="text-[11px] text-slate-400">
              {t(lang, 'مرتب حسب صحة المعدات %', 'Ranked by Asset Health %')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {branchRankings.map((branch, idx) => (
              <div
                key={branch.nameEn}
                className={`rounded-xl border p-3 text-xs bg-[#08121D] ${
                  branch.isCurrent ? 'border-emerald-400/50' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-400 font-mono">#{idx + 1}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      branch.healthPct >= 90 ? 'text-emerald-400' : branch.healthPct >= 82 ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    {branch.healthPct}%
                  </span>
                </div>
                <div className="mt-1 font-semibold text-white truncate">
                  {lang === 'ar' ? branch.nameAr : branch.nameEn}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                  <span>{t(lang, 'التوافر:', 'Uptime:')} {branch.uptimePct}%</span>
                  <span>{branch.rulDays}d RUL</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supervisor Predictive Notification Log */}
        {supervisorNotices.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="text-xs font-semibold text-slate-300">
              {t(lang, 'سجل تنبيهات الصيانة التنبؤية المرسلة للمشرفين', 'Supervisor Predictive Alert Dispatch Log')}
            </div>
            <div className="space-y-1.5">
              {supervisorNotices.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#08121D] px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 text-slate-200">
                    <BellRing className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono font-bold text-cyan-300">{n.bayLabel}</span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span>{lang === 'ar' ? n.summaryAr : n.summaryEn}</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-400">{n.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Diagnostic Runner & Misting Wash Controls */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-400" />
              {t(lang, 'تشخيص المواقف والشواحن المباشر', 'Live Bay & Charger Diagnostics')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t(
                lang,
                'فحص الحساسات الحرارية وحساسات العادم وشواحن EV عبر الساحة بالكامل.',
                'Inspect thermal sensors, exhaust probes, and EV charging pedestals per bay.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMistingWash}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                mistingCleaning
                  ? 'eco-flash-glow border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/10 bg-[#08121D] text-slate-300 hover:border-cyan-400/40'
              }`}
            >
              <Droplets className="h-4 w-4 text-cyan-400" />
              {mistingCleaning
                ? t(lang, 'إيقاف دورة الرذاذ والتنظيف', 'Stop Mist Wash')
                : t(lang, 'دورة تنظيف وتبريد الألواح', 'Solar & Mist Wash')}
            </button>

            <button
              type="button"
              disabled={diagRunning}
              onClick={runFullDiagnostic}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${diagRunning ? 'animate-spin' : ''}`} />
              {diagRunning
                ? t(lang, 'جاري الفحص الشامل...', 'Running Diagnostics...')
                : t(lang, 'فحص شامل للحساسات', 'Run Full Self-Check')}
            </button>
          </div>
        </div>

        {diagRunning && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="eco-energy-shimmer h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${diagProgress}%` }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {spots.map((spot) => {
            const tempInfo = thermal.bayTemps[spot.id];
            const isCritical = tempInfo?.level === 'critical' || (smokeAlert && spot.id === 'B-04');
            const lastChecked = testedBayIds[spot.id];

            return (
              <div
                key={spot.id}
                className={`rounded-xl border p-4 space-y-2 transition ${
                  isCritical
                    ? 'eco-siren-strobe border-red-500/65 bg-red-950/35'
                    : lastChecked
                      ? 'eco-flash-glow border-emerald-500/35 bg-[#08121D]'
                      : 'border-white/10 bg-[#08121D]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-extrabold text-white">
                    {spot.label}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      isCritical ? 'text-red-400' : 'text-cyan-400'
                    }`}
                  >
                    {tempInfo?.tempC ?? 27.0}°C
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {spot.zone} ·{' '}
                  {spot.hasCharger
                    ? `⚡ ${spot.chargerKw} kW`
                    : t(lang, 'حساس قياسي', 'Standard Sensor')}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3 w-3" />
                    {lastChecked
                      ? `${t(lang, 'فُحص:', 'Checked:')} ${lastChecked}`
                      : t(lang, 'جاهز', 'Healthy')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const tStr = new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      setTestedBayIds((prev) => ({ ...prev, [spot.id]: tStr }));
                      playSensorHeartbeatTick();
                      onNotify(
                        t(
                          lang,
                          `تم اختبار حساسات الموقف ${spot.label}: قراءة سليمة (${tempInfo?.tempC ?? 27}°C).`,
                          `Bay ${spot.label} sensor ping OK (${tempInfo?.tempC ?? 27}°C).`
                        )
                      );
                    }}
                    className="rounded-md border border-white/10 bg-[#0D1E2E] px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-emerald-400/50"
                  >
                    {t(lang, 'فحص', 'Ping')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EcoCharge Bot Charging Logs & Session Efficiency Section */}
      <RobotChargingLogsSection
        lang={lang}
        spots={spots}
        logs={robotChargingLogs}
        onVerifySession={onVerifyRobotSession}
        onSimulateBotSession={onSimulateBotSession}
      />

      {/* Field Technician QR Asset Tag Modal */}
      {activeTechCharger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#0D1E2E] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="font-mono text-xs text-cyan-400">
                  {t(lang, 'بطاقة الأصول الميدانية QR', 'Field Technician QR Asset Card')}
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {activeTechCharger.label} · {activeTechCharger.chargerKw}kW EV Charger
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTechChargerId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#08121D] p-4">
              <div className="grid grid-cols-9 gap-0.5 rounded-lg bg-white p-2 shrink-0">
                {techQrMatrix.flat().map((cell, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 ${cell ? 'bg-slate-950' : 'bg-white'}`}
                  />
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-400">{t(lang, 'الصحة الحالية:', 'Health:')}{' '}</span>
                  <strong className="font-mono text-emerald-400 tabular-nums">{activeTechCharger.healthPct}%</strong>
                </div>
                <div>
                  <span className="text-slate-400">{t(lang, 'الحرارة / المقاومة:', 'Coil / Imped:')}{' '}</span>
                  <strong className="font-mono text-cyan-300 tabular-nums">
                    {activeTechCharger.coilTempC}°C · {activeTechCharger.impedanceMohm}mΩ
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">{t(lang, 'نافذة خارج الذروة:', 'Off-Peak:')}{' '}</span>
                  <strong className="text-amber-300">
                    {lang === 'ar' ? activeTechCharger.offPeakSlotAr : activeTechCharger.offPeakSlotEn}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTechChargerId(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                {t(lang, 'إغلاق', 'Close')}
              </button>
              <button
                type="button"
                onClick={() => handleCompleteFieldService(activeTechCharger)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t(lang, 'إتمام الصيانة الميدانية وتصفير الإجهاد', 'Complete Service & Reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
