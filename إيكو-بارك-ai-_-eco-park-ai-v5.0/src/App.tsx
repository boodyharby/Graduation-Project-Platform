import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  BarChart3,
  BatteryCharging,
  Bell,
  Bot,
  Box,
  Calculator,
  CalendarCheck,
  Car,
  Check,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Compass,
  Cpu,
  Crown,
  Download,
  Eraser,
  FileText,
  Flame,
  Gift,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  PlusCircle,
  QrCode,
  Receipt,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  ThermometerSun,
  Trash2,
  Trees,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ActiveMergedEventState,
  ActiveMergedTourState,
  AdminWastePolicy,
  AnprScanRecord,
  AudioPreferences,
  AuditLogEntry,
  CarbonTransaction,
  ChargerEfficiencyRatingEntry,
  ChargingRobotState,
  EcoToggleEvent,
  EmergencyDrillRun,
  EvacRobotState,
  FleetPermit,
  Language,
  LightingMode3D,
  MaintenanceWorkOrder,
  NavTab,
  ParkingSpot,
  ProjectSettings,
  Reservation,
  RobotChargingSessionLog,
  ShiftHandoverRecord,
  SupervisorAlertIncident,
  SystemUser,
  UserRole,
  V2GSession,
  VehicleType,
  WeatherCondition2D,
} from './types/parking';
import { BRANCHES, EMPTY_SPOTS, createAdditionalParkingSpot } from './data/initialData';
import { ALL_ROLES, NAV_LABELS, ROLE_LABELS_AR, t } from './data/i18n';
import {
  VEHICLE_SPECS,
  WEATHER_PROFILES,
  buildQrMatrix,
  calculateAnnualDriverSavings,
  calculateCarbonSavings,
  computeLotThermalStats,
  getAudioPreferences,
  inferFcmCategory,
  isSmartNightWindowActive,
  playBessCriticalSiren,
  playFcmNotificationSound,
  playFireAlarmSiren,
  playHydraulicGateSound,
  playReservationCompleteSound,
  setAudioPreferences,
  speakCopilotReply,
  speakFcmFriendlyEgyptianNotice,
  speakGuidance,
  speakSafetyWarning,
  stopAllAlarms,
  stopCopilotSpeech,
} from './utils/ecoEngine';
import {
  ClearSystemDataResult,
  OperationType,
  auth,
  clearSystemData,
  collection,
  db,
  dispatchBrowserPushNotification,
  doc,
  handleFirestoreError,
  logoutFirebase,
  onSnapshot,
  orderBy,
  query,
  requestAndSaveFcmToken,
  resendVerificationEmail,
  resetPasswordEmail,
  serverTimestamp,
  setDoc,
  signInWithEmail,
  signInWithGooglePopup,
  signUpWithEmail,
  subscribeForegroundFcm,
  testFirestoreConnection,
  where,
} from './firebase';
import { Simulator2D } from './components/Simulator2D';
import { Simulator3D } from './components/Simulator3D';
import { LoginView } from './components/LoginView';
import { GreenTicketModal } from './components/GreenTicketModal';
import { CopilotDrawer } from './components/CopilotDrawer';
import { AnprScanner } from './components/AnprScanner';
import { LiveParkingMap } from './components/LiveParkingMap';
import { EnergyAnalyticsChart } from './components/EnergyAnalyticsChart';
import { SupervisorAlertMonitor } from './components/SupervisorAlertMonitor';
import { CarbonOffsetReport } from './components/CarbonOffsetReport';
import { AudioSettingsPanel } from './components/AudioSettingsPanel';
import { MaintenanceHealthPanel } from './components/MaintenanceHealthPanel';
import { AutonomousRobotsPanel } from './components/AutonomousRobotsPanel';
import { SmartBillingPanel } from './components/SmartBillingPanel';
import { ForecastBranchPanel } from './components/ForecastBranchPanel';
import { OperationsHubPanel } from './components/OperationsHubPanel';
import { BayPowerTelemetryChart } from './components/BayPowerTelemetryChart';
import { BessHealthTrendChart } from './components/BessHealthTrendChart';
import { AnprScanHistoryPanel } from './components/AnprScanHistoryPanel';
import { GateKioskOverlay } from './components/GateKioskOverlay';
import { DEFAULT_PROJECT_SETTINGS, SystemSettingsPanel } from './components/SystemSettingsPanel';
import { AnnualSustainabilityReport } from './components/AnnualSustainabilityReport';
import {
  AdminWasteReductionPanel,
  DEFAULT_ADMIN_WASTE_POLICY,
} from './components/AdminWasteReductionPanel';
import { SolarPerformanceMonitor } from './components/SolarPerformanceMonitor';
import { QuickScanCheckInModal } from './components/QuickScanCheckInModal';
import { SolarDryCleanPanel } from './components/SolarDryCleanPanel';
import { BessCellDiagnosticsPanel } from './components/BessCellDiagnosticsPanel';
import { InverterGridFaultDrillPanel } from './components/InverterGridFaultDrillPanel';
import { GreenSustainabilityHub } from './components/GreenSustainabilityHub';
import { WordThesisExporterPanel } from './components/WordThesisExporterPanel';
import { MergedPlatformsHub } from './components/MergedPlatformsHub';
import {
  DataHygienePanel,
  WipeExecutionOptions,
  WipeReportSummary,
} from './components/DataHygienePanel';

const NAV_ICONS: Record<NavTab, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  parking: Car,
  livemap: MapPin,
  reservations: CalendarCheck,
  robots: Bot,
  billing: Receipt,
  forecast: CloudSun,
  operations: ClipboardList,
  energy: BatteryCharging,
  wallet: Wallet,
  sim2d: Cpu,
  sim3d: Box,
  maintenance: Wrench,
  audio: Volume2,
  reports: FileText,
  search: Search,
  users: Users,
  settings: Settings,
  data_hygiene: Eraser,
  help: HelpCircle,
  language: Globe,
};

function mapFirebaseAuthError(err: unknown, lang: Language): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return t(
      lang,
      'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في Firebase Console. يرجى تفعيل Email/Password من Authentication → Sign-in method أو استخدام الدخول بواسطة Google.',
      'Email/Password sign-in is not enabled in Firebase Console yet. Enable Email/Password under Authentication → Sign-in method, or use Google Sign-In.'
    );
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return t(lang, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Invalid email or password.');
  }
  if (msg.includes('auth/email-already-in-use')) {
    return t(lang, 'هذا البريد الإلكتروني مسجل بالفعل.', 'This email is already registered.');
  }
  if (msg.includes('auth/weak-password')) {
    return t(lang, 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل).', 'Password is too weak (minimum 6 characters).');
  }
  return msg;
}

const ADMIN_EMAIL = 'bdalrhmnhrby703@gmail.com';
const AUTO_APPROVED_ROLES: UserRole[] = ['Driver', 'Guest'];

function isRoleAutoApproved(role: UserRole): boolean {
  return AUTO_APPROVED_ROLES.includes(role);
}

export default function App() {
  // Auth & Session
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    name: string;
    email: string;
    role: UserRole;
    status: 'active' | 'pending' | 'rejected';
    emailVerified: boolean;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Language & UI Shell
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('ecopark_lang');
    return saved === 'en' ? 'en' : 'ar';
  });
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [navFilter, setNavFilter] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Domain State (All empty/neutral — zero fake data)
  const [spots, setSpots] = useState<ParkingSpot[]>(EMPTY_SPOTS);
  const spotsRef = useRef<ParkingSpot[]>(EMPTY_SPOTS);
  spotsRef.current = spots;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [transactions, setTransactions] = useState<CarbonTransaction[]>([]);
  const [v2gSessions, setV2gSessions] = useState<V2GSession[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [supervisorAlerts, setSupervisorAlerts] = useState<SupervisorAlertIncident[]>([]);

  // Energy & Safety State (Clean defaults, synced to Firestore systemState)
  const [bessCharge, setBessCharge] = useState<number>(100);
  const [ecoConservation, setEcoConservation] = useState<boolean>(false);
  const [solarKw, setSolarKw] = useState<number>(0);
  const [smokeAlert, setSmokeAlert] = useState<boolean>(false);
  const [lighting3D, setLighting3D] = useState<LightingMode3D>('sunny');
  const [weather2d, setWeather2d] = useState<WeatherCondition2D>('sunny');
  const [synergyBusy, setSynergyBusy] = useState<boolean>(false);
  const [activeMergedTour, setActiveMergedTour] = useState<ActiveMergedTourState>({
    cityId: 'jerusalem',
    cityAr: 'القدس والمسار التراثي — فلسطين المحتلة',
    cityEn: 'Jerusalem Heritage Route — Occupied Palestine',
    branchName: BRANCHES[4],
    totalKm: 13.5,
    co2SavedKg: 2.84,
    batteryEndPct: 100,
    stopsCount: 3,
    evStopsCount: 2,
  });
  const [activeMergedEvent, setActiveMergedEvent] = useState<ActiveMergedEventState>({
    id: 'evt-green-summit',
    titleAr: 'قمة المدن الذكية والاستدامة الحضرية',
    titleEn: 'Smart Cities & Urban Sustainability Summit',
    branch: BRANCHES[0],
    capacity: 420,
    predictedAttendance: 370,
    predictedVehicles: 110,
    targetBaysNeeded: 11,
    energySavedKwh: 291,
    waterSavedL: 969,
    wasteReductionPct: 47,
    eventWindow: '18:00 - 22:00',
    prepared: false,
  });

  // Booking Form State (Clean inputs)
  const [bookBranch, setBookBranch] = useState<string>(BRANCHES[0]);
  const [bookSpotId, setBookSpotId] = useState<string>('A-01');
  const [bookDriver, setBookDriver] = useState<string>('');
  const [bookPlate, setBookPlate] = useState<string>('');
  const [bookVehicleType, setBookVehicleType] = useState<VehicleType>('ELECTRIC');
  const [bookEntry, setBookEntry] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [bookExit, setBookExit] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [activeTicket, setActiveTicket] = useState<Reservation | null>(null);

  // Annual Carbon Calculator State
  const [calcVehicle, setCalcVehicle] = useState<VehicleType>('HYBRID');
  const [calcDistanceKm, setCalcDistanceKm] = useState<number>(1.8);
  const [calcIdleMin, setCalcIdleMin] = useState<number>(6);
  const [calcDaysPerWeek, setCalcDaysPerWeek] = useState<number>(5);

  // Search, Users & Add-User Modal State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchCategory, setSearchCategory] = useState<
    'all' | 'vehicles' | 'reservations' | 'tickets' | 'reports' | 'users'
  >('all');
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Operator');
  const [newUserSaving, setNewUserSaving] = useState<boolean>(false);
  const [clearModalOpen, setClearModalOpen] = useState<boolean>(false);
  const [clearingData, setClearingData] = useState<boolean>(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);
  const [fcmPermission, setFcmPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const prevResStatusRef = useRef<Record<string, Reservation['status']>>({});
  const [flashFxEnabled, setFlashFxEnabled] = useState<boolean>(true);
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(() => getAudioPreferences());
  const [bookVipMode, setBookVipMode] = useState<boolean>(false);
  const [bookVipSummonRobot, setBookVipSummonRobot] = useState<boolean>(true);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(() => {
    const saved = Number(localStorage.getItem('ecopark_redeemed_pts') || 0);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  });
  const [chargingRobot, setChargingRobot] = useState<ChargingRobotState>({
    id: 'bot-charge-x1',
    name: 'EcoCharge Bot X1',
    phase: 'docked',
    batteryPct: 96,
    targetSpotId: null,
    powerKw: 0,
    deliveredKwh: 0,
  });
  const [evacRobot, setEvacRobot] = useState<EvacRobotState>({
    id: 'bot-evac-r2',
    name: 'SafeGuard Evac-Bot R2',
    phase: 'patrol',
    batteryPct: 94,
    targetZone: 'B-04',
    laserGuideActive: false,
    sirenBeaconActive: false,
    evacuatedCount: 0,
  });
  const [zeroMockMode, setZeroMockMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ecopark_zero_mock_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [fleetPermits, setFleetPermits] = useState<FleetPermit[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_fleet_permits');
      if (saved) return JSON.parse(saved) as FleetPermit[];
      if (localStorage.getItem('ecopark_zero_mock_mode') === 'true') return [];
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'flt-vip-1',
        plateNumber: 'VIP-001',
        companyOrOwner: 'القيادة التنفيذية · Eco-Park VIP',
        vehicleType: 'ELECTRIC',
        tier: 'VIP_EXECUTIVE',
        autoGateEnabled: true,
        validUntil: '2027-01-01',
        active: true,
      },
      {
        id: 'flt-corp-2',
        plateNumber: 'EV-FLEET-19',
        companyOrOwner: 'أسطول التوصيل الأخضر · Team 19',
        vehicleType: 'ELECTRIC',
        tier: 'CORPORATE_FLEET',
        autoGateEnabled: true,
        validUntil: '2026-12-31',
        active: true,
      },
    ];
  });
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_work_orders');
      if (saved) return JSON.parse(saved) as MaintenanceWorkOrder[];
      if (localStorage.getItem('ecopark_zero_mock_mode') === 'true') return [];
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'WO-1042',
        bayId: 'A-01',
        issueAr: 'معايرة دورية لشاحن 50kW DC فائق السرعة',
        issueEn: 'Routine 50kW DC fast charger calibration',
        priority: 'routine',
        assignee: 'م. طارق المنصور',
        status: 'in_progress',
        createdAt: '09:30',
        autoDetected: false,
      },
    ];
  });
  const [drillHistory, setDrillHistory] = useState<EmergencyDrillRun[]>([]);
  const [ecoToggleEvents, setEcoToggleEvents] = useState<EcoToggleEvent[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_eco_toggle_events');
      return saved ? (JSON.parse(saved) as EcoToggleEvent[]) : [];
    } catch {
      return [];
    }
  });
  const [anprScanLogs, setAnprScanLogs] = useState<AnprScanRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_anpr_scan_logs');
      return saved ? (JSON.parse(saved) as AnprScanRecord[]) : [];
    } catch {
      return [];
    }
  });
  const [chargerRatings, setChargerRatings] = useState<ChargerEfficiencyRatingEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_charger_ratings');
      return saved ? (JSON.parse(saved) as ChargerEfficiencyRatingEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [adminWastePolicy, setAdminWastePolicy] = useState<AdminWastePolicy>(() => {
    try {
      const saved = localStorage.getItem('ecopark_admin_waste_policy');
      return saved ? { ...DEFAULT_ADMIN_WASTE_POLICY, ...JSON.parse(saved) } : DEFAULT_ADMIN_WASTE_POLICY;
    } catch {
      return DEFAULT_ADMIN_WASTE_POLICY;
    }
  });
  const [robotChargingLogs, setRobotChargingLogs] = useState<RobotChargingSessionLog[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_robot_charging_logs');
      if (saved) {
        const parsed = JSON.parse(saved) as RobotChargingSessionLog[];
        if (Array.isArray(parsed)) return parsed;
      }
      if (localStorage.getItem('ecopark_zero_mock_mode') === 'true') return [];
    } catch {
      // ignore invalid storage
    }
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return [
      {
        id: 'seed-rlog-1',
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId: 'A-02',
        bayLabel: 'A-02',
        vehiclePlate: 'EV 4410',
        energyDeliveredKwh: 32.4,
        energyConsumedKwh: 34.8,
        efficiencyPct: 93.1,
        powerKw: 45,
        durationMinutes: 43,
        startedAt: `${todayPrefix} 08:15`,
        completedAt: `${todayPrefix} 08:58`,
        supervisorVerified: true,
      },
      {
        id: 'seed-rlog-2',
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId: 'B-01',
        bayLabel: 'B-01',
        vehiclePlate: 'س ص م 7721',
        energyDeliveredKwh: 26.8,
        energyConsumedKwh: 29.5,
        efficiencyPct: 90.8,
        powerKw: 45,
        durationMinutes: 36,
        startedAt: `${todayPrefix} 10:05`,
        completedAt: `${todayPrefix} 10:41`,
        supervisorVerified: false,
      },
      {
        id: 'seed-rlog-3',
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId: 'A-03',
        bayLabel: 'A-03',
        vehiclePlate: 'HYB 2095',
        energyDeliveredKwh: 19.5,
        energyConsumedKwh: 21.1,
        efficiencyPct: 92.4,
        powerKw: 45,
        durationMinutes: 26,
        startedAt: `${todayPrefix} 12:10`,
        completedAt: `${todayPrefix} 12:36`,
        supervisorVerified: true,
      },
    ];
  });
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(() => {
    try {
      const saved = localStorage.getItem('ecopark_project_settings');
      if (saved) {
        return { ...DEFAULT_PROJECT_SETTINGS, ...JSON.parse(saved), strictSingleCarPerBay: true };
      }
    } catch {
      // ignore invalid JSON
    }
    return DEFAULT_PROJECT_SETTINGS;
  });
  const [solarDustPct, setSolarDustPct] = useState<number>(6);
  const [solarWindKmh, setSolarWindKmh] = useState<number>(16);
  const [shiftHandovers, setShiftHandovers] = useState<ShiftHandoverRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ecopark_shift_handovers');
      return saved ? (JSON.parse(saved) as ShiftHandoverRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ecopark_fleet_permits', JSON.stringify(fleetPermits));
    } catch {
      // ignore quota errors
    }
  }, [fleetPermits]);

  useEffect(() => {
    try {
      localStorage.setItem('ecopark_work_orders', JSON.stringify(workOrders));
    } catch {
      // ignore quota errors
    }
  }, [workOrders]);

  const recordEcoToggleEvent = useCallback((enabled: boolean, bessLevel: number) => {
    const now = new Date();
    const hourIndex = now.getHours();
    const hourLabel = `${String(hourIndex).padStart(2, '0')}:00`;
    const event: EcoToggleEvent = {
      id: `eco-ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hourIndex,
      hourLabel,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      enabled,
      bessAtToggle: bessLevel,
    };
    setEcoToggleEvents((prev) => {
      const next = [...prev.slice(-23), event];
      try {
        localStorage.setItem('ecopark_eco_toggle_events', JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const appendAnprScan = useCallback((record: Omit<AnprScanRecord, 'id' | 'timestamp'>) => {
    const now = new Date();
    const entry: AnprScanRecord = {
      ...record,
      id: `scan-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString().slice(0, 16).replace('T', ' '),
    };
    setAnprScanLogs((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      try {
        localStorage.setItem('ecopark_anpr_scan_logs', JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const handleSaveChargerRating = useCallback(
    async (entry: ChargerEfficiencyRatingEntry) => {
      setChargerRatings((prev) => {
        const next = [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, 100);
        try {
          localStorage.setItem('ecopark_charger_ratings', JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified) {
        const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
        const path = `chargerMaintenanceRatings/${safeId}`;
        try {
          await setDoc(doc(db, 'chargerMaintenanceRatings', safeId), {
            id: safeId,
            userId: firebaseUser.uid,
            bayId: entry.bayId.slice(0, 20),
            bayLabel: entry.bayLabel.slice(0, 20),
            rating: entry.rating,
            note: entry.note.slice(0, 240),
            ratedAt: entry.ratedAt.slice(0, 40),
            ratedBy: entry.ratedBy.slice(0, 100),
            createdAtServer: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [firebaseUser]
  );

  const [nightClockHour, setNightClockHour] = useState<number>(() => new Date().getHours());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNightClockHour(new Date().getHours());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const smartNightActive = useMemo(() => {
    const d = new Date();
    d.setHours(nightClockHour, 0, 0, 0);
    return isSmartNightWindowActive(
      projectSettings.smartNightModeEnabled,
      projectSettings.smartNightForceActive,
      projectSettings.nightStartHour,
      projectSettings.nightEndHour,
      d
    );
  }, [
    nightClockHour,
    projectSettings.smartNightModeEnabled,
    projectSettings.smartNightForceActive,
    projectSettings.nightStartHour,
    projectSettings.nightEndHour,
  ]);

  const handleUpdateProjectSettings = useCallback((next: ProjectSettings) => {
    const safeNext = { ...next, strictSingleCarPerBay: true };
    setProjectSettings(safeNext);
    try {
      localStorage.setItem('ecopark_project_settings', JSON.stringify(safeNext));
    } catch {
      // ignore storage quota failure
    }
  }, []);

  const handleUpdateAdminWastePolicy = useCallback((next: AdminWastePolicy) => {
    setAdminWastePolicy(next);
    try {
      localStorage.setItem('ecopark_admin_waste_policy', JSON.stringify(next));
    } catch {
      // ignore storage quota failure
    }
  }, []);

  const recordRobotChargingSession = useCallback(
    async (spotId: string, plate: string, deliveredKwh: number) => {
      const safeDelivered = Math.max(1, Number(deliveredKwh.toFixed(1)));
      const bayObj = spotsRef.current.find((s) => s.id === spotId || s.label === spotId);
      const bayLabel = (bayObj?.label || spotId).slice(0, 20);
      const bayId = (bayObj?.id || spotId).slice(0, 20);
      const effFactor = 0.89 + (bayId.charCodeAt(0) % 6) * 0.012;
      const consumedKwh = Number((safeDelivered / effFactor).toFixed(2));
      const efficiencyPct = Number(((safeDelivered / consumedKwh) * 100).toFixed(1));
      const now = new Date();
      const durationMinutes = Math.max(8, Math.round((safeDelivered / 45) * 60));
      const startMs = now.getTime() - durationMinutes * 60000;
      const startedAt = new Date(startMs).toISOString().slice(0, 16).replace('T', ' ');
      const completedAt = now.toISOString().slice(0, 16).replace('T', ' ');
      const logId = `rlog-${Date.now()}-${Math.floor(Math.random() * 999)}`;

      const entry: RobotChargingSessionLog = {
        id: logId,
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId,
        bayLabel,
        vehiclePlate: (plate || 'EV-AUTO').slice(0, 32),
        energyDeliveredKwh: safeDelivered,
        energyConsumedKwh: consumedKwh,
        efficiencyPct,
        powerKw: 45,
        durationMinutes,
        startedAt,
        completedAt,
        supervisorVerified: false,
        userId: firebaseUser?.uid,
      };

      setRobotChargingLogs((prev) => {
        const next = [entry, ...prev].slice(0, 120);
        try {
          localStorage.setItem('ecopark_robot_charging_logs', JSON.stringify(next));
        } catch {
          // ignore storage quota error
        }
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified) {
        const path = `robotChargingLogs/${logId}`;
        try {
          await setDoc(doc(db, 'robotChargingLogs', logId), {
            id: entry.id,
            userId: firebaseUser.uid,
            robotId: entry.robotId,
            robotName: entry.robotName,
            bayId: entry.bayId,
            bayLabel: entry.bayLabel,
            vehiclePlate: entry.vehiclePlate,
            energyDeliveredKwh: entry.energyDeliveredKwh,
            energyConsumedKwh: entry.energyConsumedKwh,
            efficiencyPct: entry.efficiencyPct,
            powerKw: entry.powerKw,
            durationMinutes: entry.durationMinutes,
            startedAt: entry.startedAt,
            completedAt: entry.completedAt,
            supervisorVerified: entry.supervisorVerified,
            createdAtServer: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [firebaseUser]
  );

  const handleVerifyRobotSession = useCallback(
    async (logId: string) => {
      setRobotChargingLogs((prev) => {
        const next = prev.map((item) =>
          item.id === logId ? { ...item, supervisorVerified: true } : item
        );
        try {
          localStorage.setItem('ecopark_robot_charging_logs', JSON.stringify(next));
        } catch {
          // ignore quota error
        }
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified && !logId.startsWith('seed-')) {
        const path = `robotChargingLogs/${logId}`;
        try {
          await setDoc(
            doc(db, 'robotChargingLogs', logId),
            { supervisorVerified: true },
            { merge: true }
          );
        } catch (err) {
          console.warn('Verify robot charging log sync:', err);
        }
      }
    },
    [firebaseUser]
  );

  const handleUpdateAudioPrefs = useCallback((next: AudioPreferences) => {
    setAudioPrefs(next);
    setAudioPreferences(next);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  // Google Maps Platform Client-Side Quota Defense (Case A Demo Key)
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setMapsQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Firebase Cloud Messaging (FCM) Foreground Listener
  useEffect(() => {
    let unsubFcm = () => {};
    if (authReady && firebaseUser) {
      subscribeForegroundFcm((title, body, data) => {
        const category = inferFcmCategory(data?.tag || data?.category || title);
        playFcmNotificationSound(category);
        showToast(`${title}: ${body}`);
        if (!copilotOpen) {
          speakFcmFriendlyEgyptianNotice(title, body, lang, category);
        }
        dispatchBrowserPushNotification(title, body, data?.tag || 'ecopark-fcm-foreground', {
          playSound: false,
          category,
        });
      }).then((fn) => {
        unsubFcm = fn;
      });
    }
    return () => unsubFcm();
  }, [authReady, firebaseUser, showToast, lang, copilotOpen]);

  // Sync HTML dir/lang
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('ecopark_lang', lang);
  }, [lang]);

  // Global Escape key dismissal for open overlays/modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (projectSettings.gateKioskMode) {
        handleUpdateProjectSettings({ ...projectSettings, gateKioskMode: false });
      } else if (activeTicket) {
        setActiveTicket(null);
      } else if (copilotOpen) {
        setCopilotOpen(false);
      } else if (clearModalOpen) {
        setClearModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [projectSettings, handleUpdateProjectSettings, activeTicket, copilotOpen, clearModalOpen]);

  // Firebase Auth listener & Connection probe
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const isAdminEmail = (user.email || '').toLowerCase() === ADMIN_EMAIL;
        let requestedRole: UserRole = isAdminEmail ? 'Super Admin' : 'Driver';
        try {
          const savedRaw = localStorage.getItem(
            `ecopark_pending_role_${(user.email || '').toLowerCase()}`
          );
          if (savedRaw && !isAdminEmail) {
            const parsed = JSON.parse(savedRaw) as { role?: UserRole };
            if (parsed.role && parsed.role !== 'Super Admin') {
              requestedRole = parsed.role;
            }
          }
        } catch {
          // ignore localStorage parse failure
        }
        const initialStatus: 'active' | 'pending' | 'rejected' =
          isAdminEmail || isRoleAutoApproved(requestedRole) ? 'active' : 'pending';

        setCurrentUser({
          uid: user.uid,
          name: displayName,
          email: user.email || '',
          role: requestedRole,
          status: initialStatus,
          emailVerified: user.emailVerified,
        });
        setBookDriver((prev) => prev || displayName);
      } else {
        setCurrentUser(null);
        setReservations([]);
        setTransactions([]);
        setV2gSessions([]);
        setUsers([]);
        setAuditLogs([]);
        setSupervisorAlerts([]);
        spotsRef.current = EMPTY_SPOTS;
        setSpots(EMPTY_SPOTS);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners (strictly when authenticated and email verified)
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) return;

    const uid = firebaseUser.uid;
    const emailLower = (firebaseUser.email || '').toLowerCase();
    const isAdminEmail = emailLower === ADMIN_EMAIL;

    // Sync user profile (respecting existing RBAC role/status unless admin)
    const userRef = doc(db, 'users', uid);
    (async () => {
      try {
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
          let chosenRole: UserRole = isAdminEmail ? 'Super Admin' : 'Driver';
          let chosenName =
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
          try {
            const savedRaw = localStorage.getItem(`ecopark_pending_role_${emailLower}`);
            if (savedRaw && !isAdminEmail) {
              const parsed = JSON.parse(savedRaw) as { role?: UserRole; name?: string };
              if (parsed.role && parsed.role !== 'Super Admin') {
                chosenRole = parsed.role;
              }
              if (parsed.name) chosenName = parsed.name;
            }
          } catch {
            // ignore
          }
          const initialStatus: 'active' | 'pending' =
            isAdminEmail || isRoleAutoApproved(chosenRole) ? 'active' : 'pending';
          await setDoc(userRef, {
            uid,
            name: chosenName,
            email: firebaseUser.email || '',
            role: chosenRole,
            status: initialStatus,
            preferredLang: lang,
            updatedAt: serverTimestamp(),
          });
        } else if (isAdminEmail) {
          await setDoc(
            userRef,
            {
              uid,
              name: firebaseUser.displayName || 'Super Admin',
              email: firebaseUser.email || ADMIN_EMAIL,
              role: 'Super Admin',
              status: 'active',
              preferredLang: lang,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await setDoc(
            userRef,
            {
              name:
                firebaseUser.displayName ||
                String(existingSnap.data().name || firebaseUser.email?.split('@')[0] || 'User'),
              preferredLang: lang,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('Profile sync notice:', err);
      }
    })();

    const unsubSelfUser = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const resolvedRole: UserRole = isAdminEmail
          ? 'Super Admin'
          : ((data.role as UserRole) === 'Super Admin' ? 'Driver' : (data.role as UserRole)) ||
            'Driver';
        const resolvedStatus: 'active' | 'pending' | 'rejected' = isAdminEmail
          ? 'active'
          : ((data.status as 'active' | 'pending' | 'rejected') ||
              (isRoleAutoApproved(resolvedRole) ? 'active' : 'pending'));
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                name: String(data.name || prev.name),
                role: resolvedRole,
                status: resolvedStatus,
              }
            : prev
        );
      },
      (err) => console.warn('Self user listener:', err.message)
    );

    // 1. Reservations listener
    const resQuery = isAdminEmail
      ? query(collection(db, 'reservations'), orderBy('createdAtServer', 'desc'))
      : query(
          collection(db, 'reservations'),
          where('userId', '==', uid),
          orderBy('createdAtServer', 'desc')
        );
    const unsubRes = onSnapshot(
      resQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Reservation, 'id'>),
        }));

        // Detect live Firestore transitions from 'active' -> 'completed' and push FCM Browser Notification
        list.forEach((res) => {
          const prevStatus = prevResStatusRef.current[res.id];
          if (prevStatus === 'active' && res.status === 'completed') {
            const title = t(
              lang,
              `✅ اكتمل حجزك ${res.ticketCode} بنجاح`,
              `✅ Reservation ${res.ticketCode} Completed`
            );
            const body = t(
              lang,
              `تم إنهاء وقوفك في الموقف ${res.spotLabel} وتوثيق وفر ${res.co2SavedKg} كجم من CO2.`,
              `Completed stay at bay ${res.spotLabel} and logged ${res.co2SavedKg} kg CO2 saved.`
            );
            dispatchBrowserPushNotification(title, body, `res-done-${res.id}`, {
              playSound: false,
              category: 'reservation',
            });
            playReservationCompleteSound();
            showToast(`${title} — ${body}`);
          }
          prevResStatusRef.current[res.id] = res.status;
        });

        setReservations(list);

        // Reflect active/arrived reservations while keeping any dynamically expanded bays
        setSpots((prevSpots) => {
          const baseList = prevSpots.length >= EMPTY_SPOTS.length ? prevSpots : EMPTY_SPOTS;
          return baseList.map((base) => {
            const match = list.find(
              (r) => r.spotId === base.id && (r.status === 'active' || r.status === 'arrived')
            );
            if (!match) return base;
            return {
              ...base,
              status: match.status === 'arrived' ? 'occupied' : 'reserved',
              vehiclePlate: match.plateNumber,
              vehicleType: match.vehicleType,
              driverName: match.driverName,
            };
          });
        });
      },
      (err) => {
        console.warn('Reservations listener:', err.message);
      }
    );

    // 2. Carbon Transactions listener
    const txQuery = isAdminEmail
      ? query(collection(db, 'carbonTransactions'), orderBy('createdAtServer', 'desc'))
      : query(
          collection(db, 'carbonTransactions'),
          where('userId', '==', uid),
          orderBy('createdAtServer', 'desc')
        );
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        setTransactions(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CarbonTransaction, 'id'>),
          }))
        );
      },
      (err) => console.warn('Transactions listener:', err.message)
    );

    // 3. V2G Sessions listener
    const v2gQuery = isAdminEmail
      ? query(collection(db, 'v2gSessions'), orderBy('createdAtServer', 'desc'))
      : query(
          collection(db, 'v2gSessions'),
          where('userId', '==', uid),
          orderBy('createdAtServer', 'desc')
        );
    const unsubV2g = onSnapshot(
      v2gQuery,
      (snap) => {
        setV2gSessions(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<V2GSession, 'id'>),
          }))
        );
      },
      (err) => console.warn('V2G listener:', err.message)
    );

    // 4. Audit Logs listener
    const logQuery = isAdminEmail
      ? query(collection(db, 'auditLogs'), orderBy('createdAtServer', 'desc'))
      : query(
          collection(db, 'auditLogs'),
          where('userId', '==', uid),
          orderBy('createdAtServer', 'desc')
        );
    const unsubLogs = onSnapshot(
      logQuery,
      (snap) => {
        setAuditLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditLogEntry, 'id'>),
          }))
        );
      },
      (err) => console.warn('Audit logs listener:', err.message)
    );

    // 5. System Energy State listener
    const unsubEnergy = onSnapshot(
      doc(db, 'systemState', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.bessCharge === 'number') setBessCharge(data.bessCharge);
          if (typeof data.ecoConservation === 'boolean') setEcoConservation(data.ecoConservation);
          if (typeof data.solarKw === 'number') setSolarKw(data.solarKw);
          if (typeof data.smokeAlert === 'boolean') setSmokeAlert(data.smokeAlert);
        }
      },
      (err) => console.warn('SystemState listener:', err.message)
    );

    // 6. Supervisor Alerts listener (Cloud Functions escalation tracker)
    const alertQuery = isAdminEmail
      ? collection(db, 'supervisorAlerts')
      : query(collection(db, 'supervisorAlerts'), where('userId', '==', uid));
    const unsubSupervisorAlerts = onSnapshot(
      alertQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SupervisorAlertIncident, 'id'>),
          }))
          .sort((a, b) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0));
        setSupervisorAlerts(list);
      },
      (err) => console.warn('SupervisorAlerts listener:', err.message)
    );

    // 7. Users list (Admin only)
    let unsubUsers = () => {};
    if (isAdminEmail) {
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setUsers(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: String(data.name || ''),
                email: String(data.email || ''),
                role: (data.role as UserRole) || 'Driver',
                status: (data.status as 'active' | 'pending') || 'active',
                lastSeen: data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString() : '',
              };
            })
          );
        },
        (err) => console.warn('Users listener:', err.message)
      );
    } else {
      setUsers([
        {
          id: uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          role: currentUser?.role || 'Driver',
          status: currentUser?.status || 'active',
          lastSeen: new Date().toLocaleTimeString(),
        },
      ]);
    }

    // 8. Charger Efficiency Ratings listener
    const ratingsQuery = isAdminEmail
      ? query(collection(db, 'chargerMaintenanceRatings'), orderBy('createdAtServer', 'desc'))
      : query(collection(db, 'chargerMaintenanceRatings'), where('userId', '==', uid));
    const unsubChargerRatings = onSnapshot(
      ratingsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChargerEfficiencyRatingEntry, 'id'>),
          }))
          .sort((a, b) => String(b.ratedAt || '').localeCompare(String(a.ratedAt || '')));
        setChargerRatings(list);
        try {
          localStorage.setItem('ecopark_charger_ratings', JSON.stringify(list));
        } catch {
          // ignore quota errors
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'chargerMaintenanceRatings')
    );

    // 9. Robot Charging Logs listener
    const robotLogsQuery = isAdminEmail
      ? query(collection(db, 'robotChargingLogs'), orderBy('createdAtServer', 'desc'))
      : query(collection(db, 'robotChargingLogs'), where('userId', '==', uid));
    const unsubRobotChargingLogs = onSnapshot(
      robotLogsQuery,
      (snap) => {
        if (snap.docs.length === 0) return;
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RobotChargingSessionLog, 'id'>),
          }))
          .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
        setRobotChargingLogs(list);
        try {
          localStorage.setItem('ecopark_robot_charging_logs', JSON.stringify(list));
        } catch {
          // ignore storage quota
        }
      },
      (err) => console.warn('RobotChargingLogs listener:', err.message)
    );

    // 10. Shift Handovers listener
    const handoversQuery = isAdminEmail
      ? query(collection(db, 'shiftHandovers'), orderBy('createdAtServer', 'desc'))
      : query(collection(db, 'shiftHandovers'), where('userId', '==', uid));
    const unsubShiftHandovers = onSnapshot(
      handoversQuery,
      (snap) => {
        if (snap.docs.length === 0) return;
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ShiftHandoverRecord, 'id'>),
          }))
          .sort((a, b) => String(b.signedAt || '').localeCompare(String(a.signedAt || '')));
        setShiftHandovers(list);
        try {
          localStorage.setItem('ecopark_shift_handovers', JSON.stringify(list));
        } catch {
          // ignore storage quota
        }
      },
      (err) => console.warn('ShiftHandovers listener:', err.message)
    );

    return () => {
      unsubSelfUser();
      unsubRes();
      unsubTx();
      unsubV2g();
      unsubLogs();
      unsubEnergy();
      unsubSupervisorAlerts();
      unsubUsers();
      unsubChargerRatings();
      unsubRobotChargingLogs();
      unsubShiftHandovers();
    };
  }, [authReady, firebaseUser, lang]);

  // Sync Supervisor Alert Incident to Firestore for Cloud Functions 5-minute Email Escalation
  const syncSupervisorIncident = useCallback(
    async (next: { bessCharge: number; smokeAlert: boolean }) => {
      const uid = firebaseUser?.uid || 'local-session';
      const nowMs = Date.now();

      const updateOne = async (
        alertType: 'SMOKE_RADAR' | 'BESS_UNDER_10',
        isActive: boolean
      ) => {
        const alertId = `${uid}_${alertType}`;
        const summaryAr =
          alertType === 'SMOKE_RADAR'
            ? 'إنذار رادار السلامة نشط — سيتم إرسال بريد إلكتروني للمشرفين عند استمرار الحالة > 5 دقائق.'
            : `شحن BESS منخفض (${next.bessCharge}% < 10%) — سيتم إرسال بريد إلكتروني للمشرفين عند الاستمرار > 5 دقائق.`;
        const summaryEn =
          alertType === 'SMOKE_RADAR'
            ? 'AI Safety Sentry smoke alert active — escalating via Cloud Functions email after 5 minutes.'
            : `Critical BESS charge (${next.bessCharge}% < 10%) — escalating via Cloud Functions email after 5 minutes.`;

        setSupervisorAlerts((prev) => {
          const existingIdx = prev.findIndex((i) => i.id === alertId);
          if (isActive) {
            if (existingIdx >= 0 && prev[existingIdx].status !== 'resolved') {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                bessCharge: next.bessCharge,
                smokeAlert: next.smokeAlert,
                summaryAr,
                summaryEn,
              };
              return updated;
            }
            const created: SupervisorAlertIncident = {
              id: alertId,
              userId: uid,
              alertType,
              status: 'monitoring',
              bessCharge: next.bessCharge,
              smokeAlert: next.smokeAlert,
              startedAtMs: nowMs,
              thresholdMinutes: 5,
              emailDispatched: false,
              recipients: [],
              summaryAr,
              summaryEn,
            };
            return [created, ...prev.filter((i) => i.id !== alertId)];
          }
          if (existingIdx >= 0 && prev[existingIdx].status !== 'resolved') {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              status: 'resolved',
              bessCharge: next.bessCharge,
              smokeAlert: next.smokeAlert,
            };
            return updated;
          }
          return prev;
        });

        if (!firebaseUser || !firebaseUser.emailVerified) return;
        const alertRef = doc(db, 'supervisorAlerts', alertId);
        const path = `supervisorAlerts/${alertId}`;
        try {
          const snap = await getDoc(alertRef);
          if (isActive) {
            if (snap.exists() && snap.data().status !== 'resolved') {
              await setDoc(
                alertRef,
                {
                  bessCharge: next.bessCharge,
                  smokeAlert: next.smokeAlert,
                  summaryAr,
                  summaryEn,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            } else {
              await setDoc(alertRef, {
                id: alertId,
                userId: firebaseUser.uid,
                alertType,
                status: 'monitoring',
                bessCharge: next.bessCharge,
                smokeAlert: next.smokeAlert,
                startedAtMs: nowMs,
                thresholdMinutes: 5,
                emailDispatched: false,
                recipients: [],
                summaryAr,
                summaryEn,
                updatedAt: serverTimestamp(),
              });
            }
          } else if (snap.exists() && snap.data().status !== 'resolved') {
            await setDoc(
              alertRef,
              {
                status: 'resolved',
                bessCharge: next.bessCharge,
                smokeAlert: next.smokeAlert,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      };

      await Promise.all([
        updateOne('SMOKE_RADAR', next.smokeAlert),
        updateOne('BESS_UNDER_10', next.bessCharge < 10),
      ]);
    },
    [firebaseUser]
  );

  // Persist energy state helper
  const persistEnergyState = useCallback(
    async (next: {
      bessCharge: number;
      ecoConservation: boolean;
      solarKw: number;
      smokeAlert: boolean;
    }) => {
      syncSupervisorIncident({
        bessCharge: next.bessCharge,
        smokeAlert: next.smokeAlert,
      });
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      const path = `systemState/${firebaseUser.uid}`;
      try {
        await setDoc(doc(db, 'systemState', firebaseUser.uid), {
          userId: firebaseUser.uid,
          ...next,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [firebaseUser, syncSupervisorIncident]
  );

  // BESS Auto-Recharge tick when Eco-Conservation Mode is active
  useEffect(() => {
    if (!ecoConservation) return;
    const timer = window.setInterval(() => {
      setBessCharge((prev) => {
        if (prev >= 45) return prev;
        return Math.min(100, prev + 2);
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [ecoConservation]);

  const appendAudit = useCallback(
    async (actionAr: string, actionEn: string) => {
      const id = `log-${Date.now()}`;
      const entry: AuditLogEntry = {
        id,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        actor: currentUser?.name || 'System',
        role: currentUser?.role || 'Operator',
        actionAr,
        actionEn,
      };
      setAuditLogs((prev) => [entry, ...prev].slice(0, 30));

      if (firebaseUser && firebaseUser.emailVerified) {
        const path = `auditLogs/${id}`;
        try {
          await setDoc(doc(db, 'auditLogs', id), {
            ...entry,
            userId: firebaseUser.uid,
            createdAtServer: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [currentUser, firebaseUser]
  );

  // Auth Handlers
  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailRegister = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => {
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const effectiveRole: UserRole =
        emailLower === ADMIN_EMAIL
          ? 'Super Admin'
          : role === 'Super Admin'
            ? 'Driver'
            : role;
      try {
        localStorage.setItem(
          `ecopark_pending_role_${emailLower}`,
          JSON.stringify({ name: name.trim(), role: effectiveRole })
        );
      } catch {
        // ignore
      }
      await signUpWithEmail(name, email, password);
      setAuthNotice(
        isRoleAutoApproved(effectiveRole) || emailLower === ADMIN_EMAIL
          ? t(
              lang,
              'تم إنشاء الحساب بنجاح وتفعيل الدور تلقائياً! يرجى تأكيد بريدك الإلكتروني عبر الرابط المرسل.',
              'Account created with automatic role activation! Please verify your email via the sent link.'
            )
          : t(
              lang,
              'تم إنشاء الحساب وإرسال رابط التحقق. الدور الوظيفي المطلوب سيخضع لموافقة الأدمن.',
              'Account created and verification email sent. Requested role awaits Super Admin approval.'
            )
      );
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      await resetPasswordEmail(email);
      setAuthNotice(
        t(
          lang,
          'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
          'Password reset link sent to your email.'
        )
      );
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutFirebase();
  };

  const executeDataWipe = useCallback(
    async (wipeOpts: WipeExecutionOptions): Promise<WipeReportSummary> => {
      let firestoreDeleted: ClearSystemDataResult | null = null;
      let localClearedCount = 0;

      const isFullScope =
        wipeOpts.wipeOperations &&
        wipeOpts.wipeEnergyAlerts &&
        wipeOpts.wipeAuditAndLogs;

      if (firebaseUser && firebaseUser.emailVerified) {
        if (isFullScope) {
          firestoreDeleted = await clearSystemData({ scope: 'all' });
        } else {
          const opsRes = wipeOpts.wipeOperations
            ? await clearSystemData({ scope: 'operations' })
            : null;
          const energyRes = wipeOpts.wipeEnergyAlerts
            ? await clearSystemData({ scope: 'energy_alerts' })
            : null;
          const logsRes = wipeOpts.wipeAuditAndLogs
            ? await clearSystemData({ scope: 'logs_maintenance' })
            : null;

          firestoreDeleted = {
            deletedReservations: opsRes?.deletedReservations || 0,
            deletedTransactions: opsRes?.deletedTransactions || 0,
            deletedV2gSessions: energyRes?.deletedV2gSessions || 0,
            deletedAuditLogs: logsRes?.deletedAuditLogs || 0,
            deletedSupervisorAlerts: energyRes?.deletedSupervisorAlerts || 0,
            deletedChargerRatings: logsRes?.deletedChargerRatings || 0,
            deletedRobotLogs: logsRes?.deletedRobotLogs || 0,
            deletedShiftHandovers: logsRes?.deletedShiftHandovers || 0,
            resetSystemState: energyRes?.resetSystemState || 0,
          };
        }
      }

      if (wipeOpts.wipeOperations) {
        setReservations([]);
        setTransactions([]);
        setRedeemedPoints(0);
        setActiveTicket(null);
        localStorage.removeItem('ecopark_redeemed_pts');
        localClearedCount += 1;
      }

      if (wipeOpts.wipeMockSeeds) {
        setFleetPermits([]);
        setWorkOrders([]);
        setRobotChargingLogs([]);
        localStorage.setItem('ecopark_fleet_permits', '[]');
        localStorage.setItem('ecopark_work_orders', '[]');
        localStorage.setItem('ecopark_robot_charging_logs', '[]');
        localClearedCount += 3;
      }

      if (wipeOpts.wipeEnergyAlerts) {
        setV2gSessions([]);
        setSupervisorAlerts([]);
        setDrillHistory([]);
        setBessCharge(100);
        setEcoConservation(false);
        setSolarKw(0);
        setSmokeAlert(false);
        stopAllAlarms();
        stopCopilotSpeech();
        localClearedCount += 1;
      }

      if (wipeOpts.wipeAuditAndLogs) {
        setAuditLogs([]);
        setAnprScanLogs([]);
        setEcoToggleEvents([]);
        setChargerRatings([]);
        setShiftHandovers([]);
        localStorage.removeItem('ecopark_anpr_scan_logs');
        localStorage.removeItem('ecopark_eco_toggle_events');
        localStorage.removeItem('ecopark_charger_ratings');
        localStorage.removeItem('ecopark_charger_manual_notes');
        localStorage.removeItem('ecopark_shift_handovers');
        localStorage.removeItem('ecopark_offline_gate_queue');
        localClearedCount += 6;
      }

      if (wipeOpts.wipeGreenAssets) {
        localStorage.setItem(
          'ecopark_green_assets',
          JSON.stringify({ palm: 0, sidr: 0, bioswale_shrub: 0, living_wall: 0 })
        );
        window.dispatchEvent(new Event('ecopark-green-assets-updated'));
        localClearedCount += 1;
      }

      if (wipeOpts.resetSpotsTo12) {
        setSpots(EMPTY_SPOTS);
      }

      if (wipeOpts.enableZeroMockMode) {
        localStorage.setItem('ecopark_zero_mock_mode', 'true');
        setZeroMockMode(true);
      }

      window.dispatchEvent(new Event('ecopark-data-wiped'));

      const report: WipeReportSummary = {
        executedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        firestoreDeleted,
        localClearedCount,
        zeroMockActive: wipeOpts.enableZeroMockMode || zeroMockMode,
      };

      showToast(
        t(
          lang,
          'تم مسح البيانات المحددة وتجهيز المنظومة بوضع النظافة الفعلي (Zero-Mock).',
          'Selected mock & test records wiped cleanly — Zero-Mock Production state active.'
        )
      );

      return report;
    },
    [firebaseUser, lang, zeroMockMode]
  );

  const handleClearSystemData = async () => {
    setClearingData(true);
    try {
      await executeDataWipe({
        wipeOperations: true,
        wipeMockSeeds: true,
        wipeEnergyAlerts: true,
        wipeAuditAndLogs: true,
        wipeGreenAssets: true,
        resetSpotsTo12: true,
        enableZeroMockMode: true,
      });
      setClearModalOpen(false);
    } catch {
      showToast(
        t(
          lang,
          'حدث خطأ أثناء تفريغ البيانات من Firestore.',
          'An error occurred while clearing Firestore data.'
        )
      );
    } finally {
      setClearingData(false);
    }
  };

  const handleExportFullBackupJson = () => {
    let greenAssets: Record<string, number> = { palm: 0, sidr: 0, bioswale_shrub: 0, living_wall: 0 };
    try {
      const savedAssets = localStorage.getItem('ecopark_green_assets');
      if (savedAssets) greenAssets = JSON.parse(savedAssets) as Record<string, number>;
    } catch {
      // ignore invalid JSON
    }

    const snapshot = {
      exportedAt: new Date().toISOString(),
      projectSettings,
      energyState: { bessCharge, solarKw, ecoConservation, smokeAlert },
      spots,
      reservations,
      transactions,
      redeemedPoints,
      v2gSessions,
      fleetPermits,
      workOrders,
      robotChargingLogs,
      anprScanLogs,
      ecoToggleEvents,
      chargerRatings,
      shiftHandovers,
      auditLogs,
      drillHistory,
      greenAssets,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecopark-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      t(
        lang,
        'تم تصدير النسخة الاحتياطية الشاملة بصيغة JSON بنجاح.',
        'Exported full system backup JSON snapshot.'
      )
    );
  };

  const handleSeedRealisticDemoData = async () => {
    localStorage.removeItem('ecopark_zero_mock_mode');
    setZeroMockMode(false);
    const nowIso = new Date().toISOString().slice(0, 16);
    const exitIso = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
    const todayPrefix = new Date().toISOString().slice(0, 10);

    const demoFleets: FleetPermit[] = [
      {
        id: 'flt-vip-1',
        plateNumber: 'VIP-001',
        companyOrOwner: 'القيادة التنفيذية · Eco-Park VIP',
        vehicleType: 'ELECTRIC',
        tier: 'VIP_EXECUTIVE',
        autoGateEnabled: true,
        validUntil: '2027-01-01',
        active: true,
      },
      {
        id: 'flt-corp-2',
        plateNumber: 'EV-FLEET-19',
        companyOrOwner: 'أسطول التوصيل الأخضر · Team 19',
        vehicleType: 'ELECTRIC',
        tier: 'CORPORATE_FLEET',
        autoGateEnabled: true,
        validUntil: '2026-12-31',
        active: true,
      },
    ];
    setFleetPermits(demoFleets);

    const demoWos: MaintenanceWorkOrder[] = [
      {
        id: 'WO-1042',
        bayId: 'A-01',
        issueAr: 'معايرة دورية لشاحن 50kW DC فائق السرعة',
        issueEn: 'Routine 50kW DC fast charger calibration',
        priority: 'routine',
        assignee: 'م. طارق المنصور',
        status: 'in_progress',
        createdAt: '09:30',
        autoDetected: false,
      },
    ];
    setWorkOrders(demoWos);

    const demoRobotLogs: RobotChargingSessionLog[] = [
      {
        id: 'seed-rlog-1',
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId: 'A-02',
        bayLabel: 'A-02',
        vehiclePlate: 'EV 4410',
        energyDeliveredKwh: 32.4,
        energyConsumedKwh: 34.8,
        efficiencyPct: 93.1,
        powerKw: 45,
        durationMinutes: 43,
        startedAt: `${todayPrefix} 08:15`,
        completedAt: `${todayPrefix} 08:58`,
        supervisorVerified: true,
      },
      {
        id: 'seed-rlog-2',
        robotId: 'ECO-BOT-X1',
        robotName: 'EcoCharge Bot X1',
        bayId: 'B-01',
        bayLabel: 'B-01',
        vehiclePlate: 'س ص م 7721',
        energyDeliveredKwh: 26.8,
        energyConsumedKwh: 29.5,
        efficiencyPct: 90.8,
        powerKw: 45,
        durationMinutes: 36,
        startedAt: `${todayPrefix} 10:05`,
        completedAt: `${todayPrefix} 10:41`,
        supervisorVerified: false,
      },
    ];
    setRobotChargingLogs(demoRobotLogs);
    localStorage.setItem('ecopark_robot_charging_logs', JSON.stringify(demoRobotLogs));

    localStorage.setItem(
      'ecopark_green_assets',
      JSON.stringify({ palm: 10, sidr: 14, bioswale_shrub: 18, living_wall: 4 })
    );
    window.dispatchEvent(new Event('ecopark-green-assets-updated'));

    setBessCharge(84);
    setSolarKw(165);
    setEcoConservation(false);

    const demoRes: Reservation[] = [
      {
        id: `res-demo-${Date.now()}-1`,
        ticketCode: 'VIP-9019',
        branch: BRANCHES[4],
        spotId: 'A-01',
        spotLabel: 'A-01',
        driverName: 'م. ليلى الشريف (مسار القدس)',
        plateNumber: 'PS-EV-101',
        vehicleType: 'ELECTRIC',
        entryTime: nowIso,
        exitTime: exitIso,
        feeSar: 25,
        carbonTaxSar: 0,
        pointsEarned: 150,
        co2SavedKg: 2.84,
        exhaustPpm: 0,
        status: 'arrived',
        checkedInAt: nowIso.replace('T', ' '),
        createdAt: new Date().toISOString(),
        userId: firebaseUser?.uid,
      },
      {
        id: `res-demo-${Date.now()}-2`,
        ticketCode: 'ECO-4107',
        branch: BRANCHES[0],
        spotId: 'B-01',
        spotLabel: 'B-01',
        driverName: 'د. عمر منصور (وفد فعالية 107)',
        plateNumber: 'KFS-107-H',
        vehicleType: 'HYBRID',
        entryTime: nowIso,
        exitTime: exitIso,
        feeSar: 15,
        carbonTaxSar: 2,
        pointsEarned: 85,
        co2SavedKg: 1.92,
        exhaustPpm: 45,
        status: 'active',
        createdAt: new Date().toISOString(),
        userId: firebaseUser?.uid,
      },
    ];
    setReservations((prev) => [...demoRes, ...prev]);

    setSpots((prev) =>
      prev.map((s) =>
        s.id === 'A-01'
          ? {
              ...s,
              status: 'occupied',
              vehiclePlate: 'PS-EV-101',
              vehicleType: 'ELECTRIC',
              driverName: 'م. ليلى الشريف',
            }
          : s.id === 'B-01'
            ? {
                ...s,
                status: 'reserved',
                vehiclePlate: 'KFS-107-H',
                vehicleType: 'HYBRID',
                driverName: 'د. عمر منصور',
              }
            : s
      )
    );

    const demoTx: CarbonTransaction = {
      id: `tx-demo-${Date.now()}`,
      date: nowIso.replace('T', ' '),
      descriptionAr: 'تذكرة VIP-9019 · باقة تكامل 101 × 107 التجريبية',
      descriptionEn: 'VIP-9019 · Demo Integration Pack (101 × 107)',
      points: 235,
      co2Kg: 4.76,
      type: 'bonus',
    };
    setTransactions((prev) => [demoTx, ...prev]);

    const demoV2g: V2GSession = {
      id: `v2g-demo-${Date.now()}`,
      vehiclePlate: 'PS-EV-101',
      vehicleModel: 'Hyundai Ioniq 6 EV',
      mode: 'charging',
      energyKwh: 28.5,
      powerKw: 50,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setV2gSessions((prev) => [demoV2g, ...prev]);

    appendAnprScan({
      plateNumber: 'PS-EV-101',
      assignedBayId: 'A-01',
      assignedBayLabel: 'A-01',
      vehicleType: 'ELECTRIC',
      scanSource: 'anpr_camera',
      confidence: 99,
      ticketCode: 'VIP-9019',
    });

    showToast(
      t(
        lang,
        'تم توليد باقة بيانات الاختبار الواقعية بنجاح وجاهزة للعرض أو للمسح لاحقاً!',
        'Realistic demo test dataset generated and ready for inspection!'
      )
    );
  };

  const handlePruneRecords = (
    mode: 'completed_reservations' | 'resolved_work_orders' | 'trim_logs_15'
  ) => {
    if (mode === 'completed_reservations') {
      const removed = reservations.filter(
        (r) => r.status === 'completed' || r.status === 'cancelled'
      ).length;
      setReservations((prev) =>
        prev.filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
      );
      showToast(
        t(
          lang,
          `تم تشذيب ${removed} حجزاً منتهياً/ملغياً مع الإبقاء على الحجوزات النشطة.`,
          `Pruned ${removed} completed/cancelled bookings while preserving active stays.`
        )
      );
    } else if (mode === 'resolved_work_orders') {
      const removed = workOrders.filter((w) => w.status === 'resolved').length;
      setWorkOrders((prev) => prev.filter((w) => w.status !== 'resolved'));
      showToast(
        t(
          lang,
          `تم تنظيف ${removed} أمر عمل محلول من قائمة الصيانة.`,
          `Cleared ${removed} resolved maintenance work orders.`
        )
      );
    } else if (mode === 'trim_logs_15') {
      setAuditLogs((prev) => prev.slice(0, 15));
      setAnprScanLogs((prev) => {
        const next = prev.slice(0, 15);
        try {
          localStorage.setItem('ecopark_anpr_scan_logs', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      showToast(
        t(
          lang,
          'تم تقليم سجل التدقيق و ANPR للإبقاء على أحدث 15 سجل فقط.',
          'Trimmed Audit and ANPR scan logs to latest 15 entries.'
        )
      );
    }
  };

  // BESS Controls
  const triggerLowBessAlert = (newLevel: number) => {
    setBessCharge(newLevel);
    persistEnergyState({
      bessCharge: newLevel,
      ecoConservation,
      solarKw,
      smokeAlert,
    });
    if (newLevel < 20) {
      playBessCriticalSiren();
      speakSafetyWarning(
        lang === 'ar'
          ? `تنبيه أمان حرج من منظومة إيكو بارك: انخفض مستوى شحن بطاريات التخزين BESS إلى ${newLevel} بالمئة. يُرجى تفعيل وضع ترشيد الاستهلاك الذكي وتعليق تفريغ الشبكة فوراً لحماية استقرار الطاقة.`
          : `Critical Eco-Park safety alert: BESS battery storage has dropped to ${newLevel} percent. Activate Eco-Conservation Mode and suspend V2G grid discharge immediately.`,
        lang,
        1550
      );
      appendAudit(
        `إنذار BESS حرج: انخفاض الشحن إلى ${newLevel}% (< 20%)`,
        `Critical BESS alarm: charge dropped to ${newLevel}% (< 20%)`
      );
      if (newLevel < 10) {
        const pushTitle = t(
          lang,
          `🔋 طوارئ قصوى: هبوط BESS إلى ${newLevel}%`,
          `🔋 Extreme Emergency: BESS at ${newLevel}%`
        );
        const pushBody = t(
          lang,
          'تم إرسال تنبيه طوارئ فوري للمتصفح وتفعيل مراقب Cloud Functions.',
          'Immediate emergency browser push sent & Cloud Functions escalation started.'
        );
        dispatchBrowserPushNotification(pushTitle, pushBody, 'ecopark-emergency-bess', {
          playSound: false,
          category: 'emergency',
        });
      }
    } else {
      stopAllAlarms();
      stopCopilotSpeech();
    }
  };

  const handleActivateEcoConservation = () => {
    if (!ecoConservation) {
      recordEcoToggleEvent(true, bessCharge);
    }
    setEcoConservation(true);
    setV2gSessions((prev) =>
      prev.map((s) => (s.mode === 'discharging' ? { ...s, mode: 'paused' } : s))
    );
    persistEnergyState({
      bessCharge,
      ecoConservation: true,
      solarKw,
      smokeAlert,
    });
    appendAudit(
      'تفعيل وضع ترشيد الاستهلاك الذكي (Eco-Conservation) وتعليق تفريغ V2G',
      'Activated Eco-Conservation Mode & suspended V2G discharge'
    );
    showToast(
      t(
        lang,
        'تم تفعيل وضع ترشيد الاستهلاك الذكي: خفض الإضاءة، تعليق تفريغ V2G، وبدء شحن BESS.',
        'Eco-Conservation Mode activated: lighting dimmed, V2G discharge paused, BESS recharging.'
      )
    );
  };

  const handleToggleEcoConservation = () => {
    const next = !ecoConservation;
    setEcoConservation(next);
    recordEcoToggleEvent(next, bessCharge);
    if (next) {
      setV2gSessions((prev) =>
        prev.map((s) => (s.mode === 'discharging' ? { ...s, mode: 'paused' } : s))
      );
    }
    persistEnergyState({
      bessCharge,
      ecoConservation: next,
      solarKw,
      smokeAlert,
    });
    appendAudit(
      next
        ? 'تفعيل وضع ترشيد الاستهلاك الذكي (Eco-Conservation)'
        : 'إيقاف وضع ترشيد الاستهلاك الذكي والعودة للمزامنة',
      next
        ? 'Toggled Eco-Conservation Mode ON'
        : 'Toggled Eco-Conservation Mode OFF'
    );
  };

  const handleToggleSmokeAlert = () => {
    setSmokeAlert((prev) => {
      const next = !prev;
      persistEnergyState({
        bessCharge,
        ecoConservation,
        solarKw,
        smokeAlert: next,
      });
      if (next) {
        playFireAlarmSiren();
        speakSafetyWarning(
          lang === 'ar'
            ? 'تحذير سلامة عاجل من رادار الذكاء الاصطناعي: تم رصد تصاعد دخان وارتفاع حراري عند الموقف B-04. يرجى اتباع مسار الإخلاء الأخضر فوراً.'
            : 'Urgent AI Safety Sentry warning: Smoke and thermal spike detected at bay B-04. Follow the green evacuation corridor immediately.',
          lang,
          1400
        );
        dispatchBrowserPushNotification(
          t(lang, '🚨 طوارئ قصوى: إنذار دخان وحريق (B-04)', '🚨 Extreme Emergency: Smoke / Fire Alert (B-04)'),
          t(lang, 'يرجى إخلاء المسار الأخضر فوراً — إنذار رادار السلامة نشط.', 'Follow green evacuation route immediately — Safety Sentry active.'),
          'ecopark-emergency-smoke',
          { playSound: false, category: 'emergency' }
        );
        appendAudit(
          'رادار السلامة AI: إطلاق إنذار رصد دخان في القطاع B-04',
          'AI Safety Sentry: Smoke alert triggered at Sector B-04'
        );
      } else {
        stopAllAlarms();
        stopCopilotSpeech();
        appendAudit(
          'رادار السلامة AI: تأكيد أمان الموقع وإلغاء حالة الطوارئ',
          'AI Safety Sentry: Site cleared and alert reset'
        );
      }
      return next;
    });
  };

  const handleWeather2dChange = (nextWeather: WeatherCondition2D) => {
    setWeather2d(nextWeather);
    const spec = WEATHER_PROFILES[nextWeather];
    const nextSolarKw = Math.round((250 * spec.baseEfficiencyPct) / 100);
    setSolarKw(nextSolarKw);
    persistEnergyState({
      bessCharge,
      ecoConservation,
      solarKw: nextSolarKw,
      smokeAlert,
    });
    appendAudit(
      `المحاكي 2D: تغيير الطقس إلى ${spec.labelAr} (كفاءة الألواح ${spec.baseEfficiencyPct}% · ${nextSolarKw} kW)`,
      `2D Simulator: Weather changed to ${spec.labelEn} (Solar ${spec.baseEfficiencyPct}% · ${nextSolarKw} kW)`
    );
    showToast(
      t(
        lang,
        `تم تحديث الطقس إلى ${spec.labelAr}: كفاءة الألواح ${spec.baseEfficiencyPct}% (${nextSolarKw} kW) ومعامل الاستهلاك ${spec.consumptionMultiplier.toFixed(2)}x`,
        `Weather updated to ${spec.labelEn}: Solar efficiency ${spec.baseEfficiencyPct}% (${nextSolarKw} kW) · Load ${spec.consumptionMultiplier.toFixed(2)}x`
      )
    );
  };

  // Dynamically add a new parking bay in both 2D & 3D when all bays are full
  const handleAddParkingSpot = useCallback((): ParkingSpot => {
    const newSpot = createAdditionalParkingSpot(spotsRef.current);
    const updated = [...spotsRef.current, newSpot];
    spotsRef.current = updated;
    setSpots(updated);
    setBookSpotId(newSpot.id);
    playHydraulicGateSound();
    appendAudit(
      `توسعة ديناميكية: إضافة موقف ذكي جديد (${newSpot.label}) في المحاكاة 2D/3D`,
      `Dynamic bay expansion: added new smart bay (${newSpot.label}) across 2D/3D`
    );
    showToast(
      t(
        lang,
        `تمت إضافة الموقف الجديد ${newSpot.label} تلقائياً في المصفوفة والمحاكي 2D و 3D!`,
        `New smart parking bay ${newSpot.label} added across Matrix, 2D & 3D!`
      )
    );
    return newSpot;
  }, [appendAudit, lang, showToast]);

  // Keep booking selector pointing to an available bay, and auto-expand whenever 100% of bays are filled/booked
  useEffect(() => {
    const firstAvailable = spots.find((s) => s.status === 'available');
    if (firstAvailable) {
      const currentSelected = spots.find((s) => s.id === bookSpotId);
      if (!currentSelected || currentSelected.status !== 'available') {
        setBookSpotId(firstAvailable.id);
      }
      return;
    }

    if (projectSettings.autoExpandWhenFull && spots.length > 0 && spots.length < 30) {
      const timer = window.setTimeout(() => {
        if (
          spotsRef.current.length > 0 &&
          spotsRef.current.length < 30 &&
          spotsRef.current.every((s) => s.status !== 'available')
        ) {
          handleAddParkingSpot();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [spots, bookSpotId, projectSettings.autoExpandWhenFull, handleAddParkingSpot]);

  // Park vehicle callback from 2D / 3D / ANPR (Strictly 1 Vehicle Per Bay)
  const handleParkVehicle = useCallback(
    async (spotId: string, vehicleType: VehicleType, plate: string) => {
      let targetSpot = spotsRef.current.find((s) => s.id === spotId);
      if (!targetSpot || targetSpot.status !== 'available') {
        const alternative = spotsRef.current.find((s) => s.status === 'available');
        if (alternative) {
          targetSpot = alternative;
          showToast(
            t(
              lang,
              `الموقف ${spotId} مشغول/محجوز بالفعل (مكان واحد لسيارة واحدة)! تم توجيه المركبة إلى ${alternative.label}.`,
              `Bay ${spotId} already holds a vehicle (1 Bay = 1 Car). Re-routed to ${alternative.label}.`
            )
          );
        } else if (projectSettings.autoExpandWhenFull && spotsRef.current.length < 30) {
          targetSpot = handleAddParkingSpot();
        } else {
          showToast(
            t(
              lang,
              'جميع المواقف ممتلئة ولا يمكن وضع سيارتين في نفس المكان!',
              'All bays are occupied — a single bay cannot hold two vehicles!'
            )
          );
          return;
        }
      }

      const resolvedId = targetSpot.id;
      const spec = VEHICLE_SPECS[vehicleType];
      const savings = calculateCarbonSavings(vehicleType, 0.25, 2.5);
      setSpots((prev) =>
        prev.map((s) =>
          s.id === resolvedId && s.status === 'available'
            ? {
                ...s,
                status: 'occupied',
                vehicleType,
                vehiclePlate: plate,
                driverName: currentUser?.name || '',
              }
            : s
        )
      );

      const txId = `tx-${Date.now()}`;
      const tx: CarbonTransaction = {
        id: txId,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        descriptionAr: `دخول ذكي (${plate}) · موقف ${resolvedId} · ${spec.labelAr}`,
        descriptionEn: `Smart Entry (${plate}) · Bay ${resolvedId} · ${spec.labelEn}`,
        points: Math.round(spec.pointsReward * projectSettings.carbonMultiplier),
        co2Kg: savings.co2SavedKg,
        type: 'visit',
      };
      setTransactions((prev) => [tx, ...prev]);

      if (firebaseUser && firebaseUser.emailVerified) {
        const path = `carbonTransactions/${txId}`;
        try {
          await setDoc(doc(db, 'carbonTransactions', txId), {
            ...tx,
            userId: firebaseUser.uid,
            createdAtServer: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [currentUser, firebaseUser, handleAddParkingSpot, lang, projectSettings.autoExpandWhenFull, projectSettings.carbonMultiplier, showToast]
  );

  // Confirm Booking & Issue Green QR Pass (Standard or VIP Gold · Strictly 1 Car Per Bay + Auto-Expand)
  const createReservationInternal = async (opts: {
    branch: string;
    spotId: string;
    driverName: string;
    plateNumber: string;
    vehicleType: VehicleType;
    entryTime: string;
    exitTime: string;
    isVip: boolean;
    summonRobot: boolean;
  }) => {
    const spec = VEHICLE_SPECS[opts.vehicleType];
    const requestedSpot = spots.find((s) => s.id === opts.spotId);
    let prioritySpot: ParkingSpot | undefined = opts.isVip
      ? spots.find((s) => s.status === 'available' && s.hasCharger) ||
        spots.find((s) => s.status === 'available')
      : requestedSpot?.status === 'available'
        ? requestedSpot
        : spots.find((s) => s.status === 'available');

    if (!prioritySpot) {
      if (projectSettings.autoExpandWhenFull && spotsRef.current.length < 30) {
        prioritySpot = handleAddParkingSpot();
      } else {
        showToast(
          t(
            lang,
            'عذراً، جميع المواقف محجوزة حالياً ولا يمكن حجز أكثر من مركبة في نفس الموقف.',
            'All bays are currently booked — one bay can only hold one vehicle.'
          )
        );
        return;
      }
    } else if (!opts.isVip && requestedSpot && requestedSpot.id !== prioritySpot.id) {
      showToast(
        t(
          lang,
          `الموقف ${requestedSpot.label} مشغول/محجوز بالفعل (سيارة واحدة فقط لكل موقف). تم تخصيص الموقف المتاح ${prioritySpot.label}.`,
          `Bay ${requestedSpot.label} is already taken (1 car per bay). Assigned available bay ${prioritySpot.label}.`
        )
      );
    }

    const savings = calculateCarbonSavings(opts.vehicleType, 0.35, 3.0);
    const ticketNum = Math.floor(1000 + Math.random() * 8999);
    const ticketCode = opts.isVip ? `VIP-${ticketNum}` : `ECO-${ticketNum}`;
    const feeSar = opts.isVip ? 25 : spec.feeSar;
    const carbonTaxSar = opts.isVip ? 0 : spec.carbonTaxSar;
    const basePts = opts.isVip ? spec.pointsReward + 50 : spec.pointsReward;
    const pointsEarned = Math.round(basePts * projectSettings.carbonMultiplier);

    const newRes: Reservation = {
      id: `res-${Date.now()}`,
      ticketCode,
      branch: opts.branch,
      spotId: prioritySpot.id,
      spotLabel: prioritySpot.label,
      driverName: opts.driverName.trim(),
      plateNumber: opts.plateNumber.trim(),
      vehicleType: opts.vehicleType,
      entryTime: opts.entryTime,
      exitTime: opts.exitTime,
      feeSar,
      carbonTaxSar,
      pointsEarned,
      co2SavedKg: savings.co2SavedKg,
      exhaustPpm: spec.exhaustPpm,
      status: 'active',
      createdAt: new Date().toISOString(),
      userId: firebaseUser?.uid,
    };

    setReservations((prev) => [newRes, ...prev]);
    setSpots((prev) =>
      prev.map((s) =>
        s.id === prioritySpot.id && s.status === 'available'
          ? {
              ...s,
              status: 'reserved',
              vehiclePlate: newRes.plateNumber,
              vehicleType: newRes.vehicleType,
              driverName: newRes.driverName,
            }
          : s
      )
    );

    const txId = `tx-${Date.now()}`;
    const newTx: CarbonTransaction = {
      id: txId,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      descriptionAr: `${opts.isVip ? 'تذكرة VIP ذهبية' : 'تذكرة خضراء'} ${ticketCode} · ${spec.labelAr} (${prioritySpot.label})`,
      descriptionEn: `${opts.isVip ? 'VIP Gold Pass' : 'Green Pass'} ${ticketCode} · ${spec.labelEn} (${prioritySpot.label})`,
      points: pointsEarned,
      co2Kg: savings.co2SavedKg,
      type: opts.isVip ? 'bonus' : 'visit',
    };
    setTransactions((prev) => [newTx, ...prev]);

    if (firebaseUser && firebaseUser.emailVerified) {
      const resPath = `reservations/${newRes.id}`;
      try {
        await setDoc(doc(db, 'reservations', newRes.id), {
          ...newRes,
          userId: firebaseUser.uid,
          createdAtServer: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, resPath);
      }

      const txPath = `carbonTransactions/${txId}`;
      try {
        await setDoc(doc(db, 'carbonTransactions', txId), {
          ...newTx,
          userId: firebaseUser.uid,
          createdAtServer: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, txPath);
      }
    }

    if (opts.isVip && opts.summonRobot && (opts.vehicleType === 'ELECTRIC' || opts.vehicleType === 'HYBRID')) {
      setChargingRobot((prev) => ({
        ...prev,
        phase: 'charging',
        targetSpotId: prioritySpot.id,
        targetPlate: newRes.plateNumber,
        powerKw: 45,
        batteryPct: Math.max(25, prev.batteryPct - 5),
      }));
    }

    playHydraulicGateSound();
    speakGuidance(
      lang === 'ar'
        ? opts.isVip
          ? `تم تأكيد حجز VIP التنفيذي ${ticketCode} وتخصيص موقف الصف الأول ${prioritySpot.label}${opts.summonRobot ? ' مع إرسال روبوت الشحن.' : '.'}`
          : `تم تأكيد الحجز وإصدار التذكرة الخضراء ${ticketCode} للموقف ${prioritySpot.label}.`
        : opts.isVip
          ? `VIP Executive booking ${ticketCode} confirmed for priority bay ${prioritySpot.label}.`
          : `Booking confirmed. Green Pass ${ticketCode} issued for bay ${prioritySpot.label}.`,
      lang
    );
    appendAudit(
      `إصدار ${opts.isVip ? 'تذكرة VIP الذهبية' : 'التذكرة الخضراء'} ${ticketCode} للمركبة ${newRes.plateNumber} (${prioritySpot.label})`,
      `Issued ${opts.isVip ? 'VIP Gold Pass' : 'Green Pass'} ${ticketCode} for ${newRes.plateNumber} (${prioritySpot.label})`
    );
    appendAnprScan({
      plateNumber: newRes.plateNumber,
      assignedBayId: prioritySpot.id,
      assignedBayLabel: prioritySpot.label,
      vehicleType: newRes.vehicleType,
      scanSource: 'qr_pass',
      confidence: 100,
      ticketCode: newRes.ticketCode,
    });
    setActiveTicket(newRes);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookDriver.trim() || !bookPlate.trim()) {
      showToast(t(lang, 'يرجى إدخال اسم السائق ورقم اللوحة.', 'Please enter driver name and plate number.'));
      return;
    }
    await createReservationInternal({
      branch: bookBranch,
      spotId: bookSpotId,
      driverName: bookDriver,
      plateNumber: bookPlate,
      vehicleType: bookVehicleType,
      entryTime: bookEntry,
      exitTime: bookExit,
      isVip: bookVipMode,
      summonRobot: bookVipSummonRobot,
    });
    setBookPlate('');
  };

  const handleQuickVipBooking = async () => {
    await createReservationInternal({
      branch: bookBranch,
      spotId: bookSpotId,
      driverName: bookDriver.trim() || currentUser?.name || 'VIP Guest',
      plateNumber: bookPlate.trim() || `VIP-${Math.floor(100 + Math.random() * 899)}`,
      vehicleType: 'ELECTRIC',
      entryTime: bookEntry,
      exitTime: bookExit,
      isVip: true,
      summonRobot: true,
    });
    showToast(
      t(
        lang,
        'تم إصدار حجز VIP ذهبي فوري وإرسال روبوت الشحن المتنقل للموقف!',
        'Instant VIP Gold Pass issued & mobile charging robot dispatched!'
      )
    );
  };

  // Closed-Loop Tri-Project Synergy Orchestrator: Eco-Park AI × 101 × 107 × Green Sustainability Hub
  const handleExecuteTriProjectSynergy = async (
    tour: ActiveMergedTourState,
    evt: ActiveMergedEventState
  ) => {
    setSynergyBusy(true);
    try {
      // 1. Scale parking bays dynamically in 2D & 3D to absorb Project 107 predicted arrival wave
      let addedBays = 0;
      const cappedTarget = Math.min(24, Math.max(spotsRef.current.length, evt.targetBaysNeeded));
      while (spotsRef.current.length < cappedTarget) {
        handleAddParkingSpot();
        addedBays += 1;
      }

      // 2. Enable Eco-Rationing & bind Project 101 hub branch
      if (!ecoConservation) {
        setEcoConservation(true);
      }
      setBookBranch(tour.branchName);

      // 3. Reserve an available priority EV/Eco bay for combined Project 101+107 delegate QR pass
      const candidate =
        spotsRef.current.find((s) => s.status === 'available' && s.hasCharger) ||
        spotsRef.current.find((s) => s.status === 'available');
      if (candidate) {
        const nowIso = new Date().toISOString().slice(0, 16);
        const exitIso = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16);
        await createReservationInternal({
          branch: tour.branchName,
          spotId: candidate.id,
          driverName: currentUser?.name || t(lang, 'ضيف التكامل الثلاثي', 'Tri-Project Delegate'),
          plateNumber: `SYN-${Math.floor(101 + Math.random() * 799)}`,
          vehicleType: 'ELECTRIC',
          entryTime: nowIso,
          exitTime: exitIso,
          isVip: true,
          summonRobot: true,
        });
      }

      // 4. Plant +1 Biophilic Bioswale Strip into Green Sustainability Hub & award +25 Carbon Points
      try {
        const raw = window.localStorage.getItem('ecopark_green_assets');
        const currentAssets = raw
          ? (JSON.parse(raw) as { palm: number; sidr: number; bioswale_shrub: number; living_wall: number })
          : { palm: 10, sidr: 14, bioswale_shrub: 18, living_wall: 4 };
        currentAssets.bioswale_shrub = (currentAssets.bioswale_shrub || 0) + 1;
        window.localStorage.setItem('ecopark_green_assets', JSON.stringify(currentAssets));
        window.dispatchEvent(new Event('ecopark-green-assets-updated'));
      } catch {
        // ignore storage quota
      }

      const bonusTxId = `tx-syn-${Date.now()}`;
      const bonusTx: CarbonTransaction = {
        id: bonusTxId,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        descriptionAr: `تكامل ثلاثي (101 × 107 × البيئة الخضراء) · ${evt.titleAr}`,
        descriptionEn: `Tri-Project Synergy (101 × 107 × Green Hub) · ${evt.titleEn}`,
        points: 25,
        co2Kg: Number((tour.co2SavedKg + 1.5).toFixed(2)),
        type: 'bonus',
      };
      setTransactions((prev) => [bonusTx, ...prev]);

      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          await setDoc(doc(db, 'carbonTransactions', bonusTxId), {
            ...bonusTx,
            userId: firebaseUser.uid,
            createdAtServer: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `carbonTransactions/${bonusTxId}`);
        }
      }

      setActiveMergedTour(tour);
      setActiveMergedEvent({ ...evt, prepared: true });

      appendAudit(
        `تنفيذ التكامل الشامل: ${evt.titleAr} (107) + ${tour.cityAr} (101) + توسعة ${addedBays} مواقف + تشجير بيوفيلي + 25 نقطة كربون`,
        `Executed Tri-Project Synergy: ${evt.titleEn} (107) + ${tour.cityEn} (101) + ${addedBays} bays + biophilic plant + 25 pts`
      );
      playReservationCompleteSound();
      showToast(
        t(
          lang,
          `تم تفعيل التكامل الشامل: ربط فعالية 107 بمسار 101، توسعة ${addedBays} مواقف، إصدار تذكرة QR، تمويل شجيرة حيوية، ومنح +25 نقطة!`,
          `Full integration activated: linked Event 107 & Route 101, +${addedBays} bays, issued QR Pass, planted bioswale & awarded +25 pts!`
        )
      );
    } finally {
      setSynergyBusy(false);
    }
  };

  const handleEnableFcmPush = async () => {
    const res = await requestAndSaveFcmToken(firebaseUser?.uid);
    setFcmPermission(res.permission);
    if (res.permission === 'granted') {
      const welcomeTitle = t(
        lang,
        '🔔 أهلاً بيك! إشعارات إيكو-بارك مصر اشتغلت',
        '🔔 Eco-Park Egypt Push Alerts Active'
      );
      const welcomeBody = t(
        lang,
        'من دلوقتي هبعتلك تنبيهات صوتية ودودة وإشعارات فورية أول ما حجزك يخلص أو يحصل تحديث للطاقة.',
        'You will now hear friendly audio chimes and receive live alerts for bookings and energy updates.'
      );
      playFcmNotificationSound('welcome');
      speakFcmFriendlyEgyptianNotice(welcomeTitle, welcomeBody, lang, 'welcome');
      await dispatchBrowserPushNotification(welcomeTitle, welcomeBody, 'ecopark-fcm-welcome', {
        playSound: false,
        category: 'welcome',
      });
      showToast(
        t(
          lang,
          'أهلاً بيك يا فندم! تم تفعيل إشعارات FCM بنجاح مع النغمة والصوت المصري الودود.',
          'FCM Push Notifications enabled with custom audio & friendly Egyptian voice!'
        )
      );
    } else if (res.permission === 'denied') {
      showToast(
        t(
          lang,
          'المتصفح حظر الإشعارات؛ يرجى السماح بالإشعارات من إعدادات الموقع في المتصفح.',
          'Notifications blocked by browser; please allow notifications in site settings.'
        )
      );
    } else {
      showToast(
        t(
          lang,
          'إشعارات الدفع غير مدعومة في هذا السياق.',
          'Browser push notifications are not supported in this context.'
        )
      );
    }
  };

  const handleCompleteReservation = async (res: Reservation) => {
    if (res.status === 'completed') return;
    prevResStatusRef.current[res.id] = 'completed';

    setReservations((prev) =>
      prev.map((item) => (item.id === res.id ? { ...item, status: 'completed' } : item))
    );
    setSpots((prev) =>
      prev.map((s) =>
        s.id === res.spotId
          ? { ...s, status: 'available', vehiclePlate: undefined, vehicleType: undefined, driverName: undefined }
          : s
      )
    );

    if (firebaseUser && firebaseUser.emailVerified) {
      const resPath = `reservations/${res.id}`;
      try {
        await setDoc(doc(db, 'reservations', res.id), { status: 'completed' }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, resPath);
      }
    }

    const pushTitle = t(
      lang,
      `✅ اكتمل حجزك ${res.ticketCode} بنجاح`,
      `✅ Reservation ${res.ticketCode} Completed`
    );
    const pushBody = t(
      lang,
      `شكراً لاستخدام إيكو-بارك! تم إخلاء الموقف ${res.spotLabel} وتوفير ${res.co2SavedKg} كجم من CO2.`,
      `Bay ${res.spotLabel} cleared. Thank you for saving ${res.co2SavedKg} kg CO2 with Eco-Park AI.`
    );

    playReservationCompleteSound();
    dispatchBrowserPushNotification(pushTitle, pushBody, `res-complete-${res.ticketCode}`, {
      playSound: false,
      category: 'reservation',
    });
    speakGuidance(pushBody, lang);
    appendAudit(
      `إنهاء الحجز ${res.ticketCode} (${res.spotLabel}) وإرسال إشعار FCM للسائق`,
      `Completed reservation ${res.ticketCode} (${res.spotLabel}) & pushed FCM notification`
    );
    showToast(`${pushTitle} — ${pushBody}`);
  };

  const handleCheckInReservation = async (res: Reservation) => {
    const checkedInAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    prevResStatusRef.current[res.id] = 'arrived';

    setReservations((prev) =>
      prev.map((item) =>
        item.id === res.id ? { ...item, status: 'arrived', checkedInAt } : item
      )
    );
    setSpots((prev) =>
      prev.map((s) =>
        s.id === res.spotId
          ? {
              ...s,
              status: 'occupied',
              vehiclePlate: res.plateNumber,
              vehicleType: res.vehicleType,
              driverName: res.driverName,
            }
          : s
      )
    );

    appendAnprScan({
      plateNumber: res.plateNumber,
      assignedBayId: res.spotId,
      assignedBayLabel: res.spotLabel,
      vehicleType: res.vehicleType,
      scanSource: 'qr_pass',
      confidence: 100,
      ticketCode: res.ticketCode,
    });

    if (firebaseUser && firebaseUser.emailVerified) {
      const resPath = `reservations/${res.id}`;
      try {
        await setDoc(
          doc(db, 'reservations', res.id),
          { status: 'arrived', checkedInAt },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, resPath);
      }
    }

    playHydraulicGateSound();
    speakGuidance(
      lang === 'ar'
        ? `تم تسجيل وصول التذكرة ${res.ticketCode} بنجاح. تفضل إلى الموقف ${res.spotLabel}.`
        : `Checked in pass ${res.ticketCode}. Proceed to bay ${res.spotLabel}.`,
      lang
    );
    appendAudit(
      `تسجيل وصول التذكرة QR (${res.ticketCode}) للمركبة ${res.plateNumber} → الموقف ${res.spotLabel} (Arrived)`,
      `Quick-scanned QR pass ${res.ticketCode} (${res.plateNumber}) → bay ${res.spotLabel} marked arrived`
    );
    showToast(
      t(
        lang,
        `تم تسجيل وصول الحجز ${res.ticketCode} (${res.driverName}) وتحديث الحالة إلى Arrived!`,
        `Checked in ${res.ticketCode} (${res.driverName}) and flagged as 'arrived' in database!`
      )
    );
  };

  // Copilot Action Executor
  const handleCopilotAction = (action: string, payload?: string) => {
    switch (action) {
      case 'navigate':
        if (payload && payload in NAV_LABELS) {
          setActiveTab(payload as NavTab);
        }
        break;
      case 'activate_eco_conservation':
        handleActivateEcoConservation();
        break;
      case 'simulate_bess_low':
        triggerLowBessAlert(18);
        break;
      case 'restore_bess':
        stopAllAlarms();
        setBessCharge(85);
        setEcoConservation(false);
        persistEnergyState({
          bessCharge: 85,
          ecoConservation: false,
          solarKw,
          smokeAlert,
        });
        showToast(t(lang, 'تمت استعادة شحن BESS إلى 85%.', 'BESS charge restored to 85%.'));
        break;
      case 'launch_car': {
        const vt: VehicleType =
          payload === 'ELECTRIC' || payload === 'HYBRID' || payload === 'GASOLINE' || payload === 'DIESEL'
            ? payload
            : 'ELECTRIC';
        const avail = spots.find((s) => s.status === 'available') || handleAddParkingSpot();
        handleParkVehicle(avail.id, vt, `ANPR-${Math.floor(100 + Math.random() * 899)}`);
        playHydraulicGateSound();
        showToast(t(lang, `تم إدخال مركبة ${vt} وتوجيهها للموقف ${avail.label}`, `Dispatched ${vt} to bay ${avail.label}`));
        break;
      }
      case 'add_bay':
        handleAddParkingSpot();
        break;
      case 'trigger_smoke_alert':
        if (!smokeAlert) handleToggleSmokeAlert();
        break;
      case 'clear_smoke_alert':
        if (smokeAlert) handleToggleSmokeAlert();
        break;
      case 'dispatch_charging_robot': {
        const bay = spots.find((s) => s.status !== 'available') || spots[0];
        if (bay) {
          setChargingRobot((prev) => ({
            ...prev,
            phase: 'charging',
            targetSpotId: bay.id,
            targetPlate: bay.vehiclePlate || `EV-${bay.label}`,
            powerKw: 45,
          }));
          setActiveTab('robots');
          showToast(t(lang, `تم إرسال روبوت الشحن إلى ${bay.label}.`, `Charging robot dispatched to ${bay.label}.`));
        }
        break;
      }
      case 'trigger_evacuation_robot':
        setEvacRobot((prev) => ({
          ...prev,
          phase: 'escorting',
          targetZone: 'B-04',
          laserGuideActive: true,
          sirenBeaconActive: true,
          evacuatedCount: prev.evacuatedCount + 3,
        }));
        setActiveTab('robots');
        speakSafetyWarning(
          lang === 'ar'
            ? 'روبوت الإخلاء الذكي نشط الآن: يرجى اتباع المسار الضوئي الأخضر إلى بوابة الخروج.'
            : 'SafeGuard Evacuation Robot active: follow the green laser corridor to the exit gate.',
          lang,
          0
        );
        break;
      case 'book_vip':
        handleQuickVipBooking();
        break;
      case 'run_emergency_drill':
        setActiveTab('operations');
        break;
      case 'set_lighting_3d':
        if (payload === 'sunny' || payload === 'sunset' || payload === 'night') {
          setLighting3D(payload);
          setActiveTab('sim3d');
        }
        break;
      default:
        break;
    }
  };

  // Derived Telemetry Metrics (Strictly from real state)
  const stats = useMemo(() => {
    const total = spots.length;
    const occupiedOrReserved = spots.filter((s) => s.status !== 'available').length;
    const available = total - occupiedOrReserved;
    const occupancyPct = Math.round((occupiedOrReserved / total) * 100);
    const totalPoints = transactions.reduce((acc, item) => acc + item.points, 0);
    const availablePoints = Math.max(0, totalPoints - redeemedPoints);
    const totalCo2Kg = Number(
      transactions.reduce((acc, item) => acc + item.co2Kg, 0).toFixed(2)
    );
    const totalCarbonTaxSar = Number(
      reservations.reduce((acc, r) => acc + (r.carbonTaxSar || 0), 0).toFixed(2)
    );
    const thermal = computeLotThermalStats(spots, true, smokeAlert);
    return {
      total,
      occupiedOrReserved,
      available,
      occupancyPct,
      totalPoints,
      availablePoints,
      totalCo2Kg,
      totalCarbonTaxSar,
      thermal,
    };
  }, [spots, transactions, reservations, smokeAlert, redeemedPoints]);

  const hourlyOccupancy = useMemo(() => {
    const buckets = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    return buckets.map((hourLabel) => {
      const targetHour = parseInt(hourLabel.slice(0, 2), 10);
      const count = reservations.filter((r) => {
        const h = new Date(r.entryTime).getHours();
        return !Number.isNaN(h) && Math.abs(h - targetHour) <= 1;
      }).length;
      const pct = Math.min(100, Math.round((count / Math.max(spots.length, 1)) * 100));
      return { hour: hourLabel, pct };
    });
  }, [reservations, spots.length]);

  const annualCalcResult = useMemo(
    () => calculateAnnualDriverSavings(calcVehicle, calcDistanceKm, calcIdleMin, calcDaysPerWeek),
    [calcVehicle, calcDistanceKm, calcIdleMin, calcDaysPerWeek]
  );

  const eventRequiredBessPct = useMemo(
    () => Math.min(85, Math.max(40, Math.round((activeMergedEvent.predictedVehicles || 80) * 0.45))),
    [activeMergedEvent.predictedVehicles]
  );
  const eventWindowHour = Number((activeMergedEvent.eventWindow || '18:00').slice(0, 2)) || 18;
  const eventWindowNeedsBess = eventWindowHour >= 16 || activeMergedEvent.predictedVehicles >= 60;
  const bessEventConflict =
    bessCharge < eventRequiredBessPct && eventWindowNeedsBess && !ecoConservation;
  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | null>(null);
  const conflictKey = `${activeMergedEvent.id}-${activeMergedEvent.eventWindow || '18:00'}-${Math.floor(bessCharge / 10)}`;
  const prevBessEventConflictRef = useRef<boolean>(false);

  useEffect(() => {
    if (bessEventConflict && !prevBessEventConflictRef.current) {
      setDismissedConflictKey(null);
      const warnAr = `⚠️ تعارض طاقة بين وقت فعالية «${activeMergedEvent.titleAr}» (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) ونقص شحن BESS (${bessCharge}% < ${eventRequiredBessPct}% المطلوبة). يُنصح بتفعيل وضع Eco-Conservation فوراً!`;
      const warnEn = `⚠️ Power conflict: Project 107 event "${activeMergedEvent.titleEn}" (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) exceeds current BESS reserve (${bessCharge}% < ${eventRequiredBessPct}% needed). Enable Eco-Conservation Mode!`;
      showToast(t(lang, warnAr, warnEn));
      void dispatchBrowserPushNotification(
        t(lang, '⚠️ تعارض طاقة الفعالية مع BESS', '⚠️ Event Time vs BESS Deficit'),
        t(lang, warnAr, warnEn),
        'ecopark-event-bess-conflict'
      );
      appendAudit(
        `رصد تعارض زمن فعالية 107 (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) مع نقص BESS (${bessCharge}%) — اقتراح تفعيل Eco-Conservation`,
        `Detected Project 107 event time conflict (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) with BESS deficit (${bessCharge}%) — suggested Eco-Conservation`
      );
    }
    prevBessEventConflictRef.current = bessEventConflict;
  }, [
    activeMergedEvent.eventWindow,
    activeMergedEvent.titleAr,
    activeMergedEvent.titleEn,
    appendAudit,
    bessCharge,
    bessEventConflict,
    eventRequiredBessPct,
    lang,
    showToast,
  ]);

  // Loading auth gate
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#08121D] flex items-center justify-center text-sm text-emerald-400 font-mono">
        {t(lang, 'جاري تهيئة منظومة إيكو-بارك AI...', 'Initializing Eco-Park AI...')}
      </div>
    );
  }

  // If not signed in -> Show Login Screen
  if (!currentUser) {
    return (
      <LoginView
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'ar' ? 'en' : 'ar'))}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onEmailRegister={handleEmailRegister}
        onForgotPassword={handleForgotPassword}
        authLoading={authLoading}
        authError={authError}
        authNotice={authNotice}
      />
    );
  }

  const bessCritical = bessCharge < 20;
  const latestReservation = reservations[0] || null;

  return (
    <div className="min-h-screen bg-[#08121D] text-slate-100 flex flex-col">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <div className="flex flex-1 min-w-0">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-64 shrink-0 border-e border-white/10 bg-[#0A1724] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen
            ? 'translate-x-0'
            : lang === 'ar'
              ? 'translate-x-full lg:translate-x-0'
              : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <div className="min-w-0">
            <div
              className={`truncate text-lg font-extrabold ${
                projectSettings.accentTheme === 'cyan'
                  ? 'text-cyan-400'
                  : projectSettings.accentTheme === 'amber'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {lang === 'ar' ? projectSettings.projectNameAr.split('|')[0].trim() : projectSettings.projectNameEn}
            </div>
            <div className="truncate font-mono text-[10px] text-slate-400">
              {projectSettings.projectCode} · {lang === 'ar' ? projectSettings.teamNameAr.split('(')[0].trim() : projectSettings.teamNameEn}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              className={`rounded-lg p-1.5 transition ${
                activeTab === 'settings'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
              title={t(lang, 'الإعدادات والهوية', 'Settings & About')}
              aria-label={t(lang, 'الإعدادات والهوية', 'Settings & About')}
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Quick Filter */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={navFilter}
              onChange={(e) => setNavFilter(e.target.value)}
              placeholder={t(lang, 'تصفية الأقسام...', 'Filter menu...')}
              className="w-full rounded-lg border border-white/10 bg-[#08121D] py-1.5 ps-8 pe-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto p-3">
          {(
            [
              {
                titleAr: 'العمليات والمواقف',
                titleEn: 'Operations & Parking',
                tabs: ['dashboard', 'livemap', 'parking', 'reservations', 'robots', 'operations'] as NavTab[],
              },
              {
                titleAr: 'الطاقة والصيانة التنبؤية',
                titleEn: 'Energy & Predictive Care',
                tabs: ['energy', 'maintenance', 'audio', 'wallet', 'billing', 'forecast'] as NavTab[],
              },
              {
                titleAr: 'المحاكاة والتقارير',
                titleEn: 'Simulators & Reports',
                tabs: ['sim2d', 'sim3d', 'reports', 'search'] as NavTab[],
              },
              {
                titleAr: 'الإعدادات والنظام',
                titleEn: 'Settings & System',
                tabs: ['settings', 'data_hygiene', 'users', 'help', 'language'] as NavTab[],
              },
            ] as const
          ).map((group) => {
            const q = navFilter.trim().toLowerCase();
            const matchingTabs = group.tabs.filter((tab) => {
              if (!q) return true;
              const lbl = NAV_LABELS[tab];
              return (
                lbl.ar.toLowerCase().includes(q) ||
                lbl.en.toLowerCase().includes(q) ||
                tab.toLowerCase().includes(q)
              );
            });
            if (matchingTabs.length === 0) return null;
            return (
              <div key={group.titleEn} className="space-y-1">
                <div className="px-3 text-[10px] font-bold text-slate-500">
                  {t(lang, group.titleAr, group.titleEn)}
                </div>
                {matchingTabs.map((tab) => {
                  const Icon = NAV_ICONS[tab];
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition whitespace-nowrap ${
                        active
                          ? `${flashFxEnabled ? 'eco-flash-glow ' : ''}bg-emerald-500/15 text-emerald-300 border border-emerald-400/35`
                          : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span className="truncate">{NAV_LABELS[tab][lang]}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 p-3 space-y-2">
          <div className="rounded-xl bg-[#0E2032] p-3">
            <div className="truncate text-xs font-bold text-white">{currentUser.name}</div>
            <div className="truncate font-mono text-[11px] text-emerald-400">{currentUser.role}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {t(lang, 'متصل بـ Firebase Firestore', 'Firebase Firestore Live')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D1E2E] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t(lang, 'تسجيل الخروج', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-[#08121D]/95 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-bold text-white">
              {NAV_LABELS[activeTab][lang]}
            </h1>
            <span className="hidden sm:inline text-xs text-slate-400">
              · {t(lang, 'بيانات حية', 'Live Data')}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleEnableFcmPush}
              className={`hidden md:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                fcmPermission === 'granted'
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              }`}
              title={t(lang, 'تفعيل إشعارات الدفع الفورية FCM', 'Enable live FCM Push Notifications')}
            >
              <Bell className="h-3.5 w-3.5" />
              {fcmPermission === 'granted'
                ? t(lang, 'إشعارات FCM نشطة', 'FCM Active')
                : t(lang, 'تفعيل FCM', 'Enable FCM')}
            </button>

            <button
              onClick={() => {
                const summaryText =
                  lang === 'ar'
                    ? `نشرة منظومة إيكو بارك الحية: يتوفر حالياً ${stats.available} مواقف شاغرة من أصل ${stats.total} بنسبة إشغال ${stats.occupancyPct} بالمئة. مستوى بطاريات التخزين BESS يبلغ ${bessCharge} بالمئة، وإنتاج الطاقة الشمسية ${solarKw} كيلوواط، مع وفر كربوني مسجل قدره ${stats.totalCo2Kg} كيلوجرام.`
                    : `Eco-Park live telemetry briefing: ${stats.available} of ${stats.total} bays are available at ${stats.occupancyPct}% occupancy. BESS battery storage is at ${bessCharge}%, solar canopy output is ${solarKw} kilowatts, and cumulative CO2 saved is ${stats.totalCo2Kg} kilograms.`;
                speakCopilotReply(summaryText, lang);
                showToast(
                  t(
                    lang,
                    'جاري تشغيل النشرة الصوتية الحيّة للموقف والطاقة...',
                    'Playing live parking & energy voice briefing...'
                  )
                );
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 whitespace-nowrap"
              title={t(lang, 'نشرة صوتية فورية للحالة الحية', 'Instant live voice briefing')}
            >
              <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'نشرة صوتية', 'Briefing')}
            </button>

            <button
              onClick={() => {
                setFlashFxEnabled((prev) => {
                  const next = !prev;
                  showToast(
                    next
                      ? t(lang, 'تم تفعيل التأثير المرئي للوميض والإشعاع الذكي.', 'Luminous CSS Flash FX enabled.')
                      : t(lang, 'تم إيقاف الوميض المرئي مؤقتاً (الوضع الهادئ).', 'Luminous Flash FX paused (Calm mode).')
                  );
                  return next;
                });
              }}
              className={`hidden md:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                flashFxEnabled
                  ? 'eco-flash-glow border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-[#0D1E2E] text-slate-400 hover:text-white'
              }`}
              title={t(lang, 'تبديل تأثير الوميض المرئي (CSS Animation)', 'Toggle Luminous CSS Flash FX')}
            >
              <Sparkles className={`h-3.5 w-3.5 ${flashFxEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
              {flashFxEnabled
                ? t(lang, 'وميض نشط', 'Flash FX ON')
                : t(lang, 'وضع هادئ', 'Calm Mode')}
            </button>

            <button
              onClick={() => {
                const nextMuted = !audioPrefs.muted;
                handleUpdateAudioPrefs({ ...audioPrefs, muted: nextMuted });
                showToast(
                  nextMuted
                    ? t(lang, 'تم كتم جميع الأصوات والتنبيهات تماماً.', 'All system sounds muted.')
                    : t(lang, 'تم تفعيل التنبيهات الصوتية.', 'System audio alerts enabled.')
                );
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                audioPrefs.muted
                  ? 'border-red-400/50 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                  : 'border-white/10 bg-[#0D1E2E] text-slate-200 hover:border-emerald-400/40'
              }`}
              title={t(lang, 'كتم أو تشغيل جميع الأصوات', 'Mute or unmute all system sounds')}
            >
              {audioPrefs.muted ? (
                <VolumeX className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span className="hidden xl:inline">
                {audioPrefs.muted ? t(lang, 'صامت', 'Muted') : t(lang, 'الصوت', 'Audio')}
              </span>
            </button>

            <button
              onClick={() =>
                handleUpdateProjectSettings({ ...projectSettings, gateKioskMode: true })
              }
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 whitespace-nowrap"
              title={t(lang, 'تشغيل شاشة البوابة التفاعلية', 'Open Gate Kiosk Display')}
            >
              <Monitor className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'شاشة البوابة', 'Kiosk')}
            </button>

            <button
              onClick={() => setActiveTab('data_hygiene')}
              className={`hidden xl:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'data_hygiene'
                  ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400/60'
              }`}
              title={t(lang, 'قسم مسح البيانات الوهمية والنظافة', 'Open Zero-Mock Wipe & Data Studio')}
            >
              <Eraser className="h-3.5 w-3.5 text-rose-400" />
              <span>{t(lang, 'مسح الوهمية', 'Zero-Mock')}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                activeTab === 'settings'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/10 bg-[#0D1E2E] text-slate-200 hover:border-emerald-400/50'
              }`}
              title={t(lang, 'فتح قسم الإعدادات والهوية', 'Open Settings & Identity')}
            >
              <Settings className={`h-3.5 w-3.5 ${activeTab === 'settings' ? 'text-emerald-400' : 'text-slate-300'}`} />
              <span className="hidden sm:inline">{t(lang, 'الإعدادات', 'Settings')}</span>
            </button>

            <button
              onClick={() => setLang((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="rounded-lg border border-white/10 bg-[#0D1E2E] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-400/50 whitespace-nowrap"
            >
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>

            <button
              onClick={() => setCopilotOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 whitespace-nowrap"
            >
              <Bot className="h-4 w-4" />
              {t(lang, 'مساعد Gemini AI', 'Gemini Copilot')}
            </button>
          </div>
        </header>

        {/* Email verification notice for newly registered Email/Password accounts */}
        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="mx-4 mt-4 lg:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <span>
              {t(
                lang,
                'يرجى تأكيد بريدك الإلكتروني عبر الرابط المرسل إليك لتفعيل المزامنة والحفظ في Firestore.',
                'Please verify your email via the link sent to your inbox to enable Firestore sync.'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await resendVerificationEmail(firebaseUser);
                  showToast(t(lang, 'تمت إعادة إرسال رابط التحقق.', 'Verification email resent.'));
                }}
                className="rounded-lg border border-amber-400/40 px-3 py-1.5 font-semibold hover:bg-amber-500/20"
              >
                {t(lang, 'إعادة إرسال الرابط', 'Resend Link')}
              </button>
              <button
                onClick={async () => {
                  await firebaseUser.reload();
                  if (firebaseUser.emailVerified) {
                    setCurrentUser((u) => (u ? { ...u, emailVerified: true } : u));
                    showToast(t(lang, 'تم التحقق من البريد بنجاح!', 'Email verified!'));
                  } else {
                    showToast(t(lang, 'لم يتم التحقق بعد. افتح الرابط في بريدك.', 'Not verified yet. Open the link in your inbox.'));
                  }
                }}
                className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-slate-950"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t(lang, 'تحديث الحالة', 'Refresh Status')}
              </button>
            </div>
          </div>
        )}

        {/* Pending / Rejected RBAC Role Banner */}
        {currentUser.status === 'pending' && (
          <div className="mx-4 mt-4 lg:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <span>
              {t(
                lang,
                `طلب دور "${ROLE_LABELS_AR[currentUser.role]}" قيد المراجعة حالياً من قِبل الأدمن (${ADMIN_EMAIL}).`,
                `Your role request (${currentUser.role}) is pending approval by Super Admin (${ADMIN_EMAIL}).`
              )}
            </span>
          </div>
        )}
        {currentUser.status === 'rejected' && (
          <div className="mx-4 mt-4 lg:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-xs text-red-200">
            <span>
              {t(
                lang,
                `تم رفض طلب الدور (${ROLE_LABELS_AR[currentUser.role]}) من قِبل الأدمن. يرجى التواصل مع الإدارة أو التسجيل كسائق/ضيف.`,
                `Your role request (${currentUser.role}) was declined by Super Admin.`
              )}
            </span>
          </div>
        )}

        {/* Global Toast */}
        {toastMsg && (
          <div className="eco-toast-flash mx-4 mt-4 lg:mx-8 flex items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-medium text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-emerald-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Critical BESS < 20% Visual Red Banner */}
        {bessCritical && (activeTab === 'dashboard' || activeTab === 'energy') && (
          <div
            className={`mx-4 mt-4 lg:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/60 bg-red-950/50 px-4 py-3 text-red-100 ${
              flashFxEnabled ? 'eco-siren-strobe' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <div className="text-xs sm:text-sm font-semibold">
                {ecoConservation
                  ? t(
                      lang,
                      `تنبيه: شحن BESS أقل من 20% (${bessCharge}%) – وضع Eco-Conservation مفعّل، تم تعليق تفريغ V2G.`,
                      `Alert: BESS below 20% (${bessCharge}%) – Eco-Conservation active, V2G discharge suspended.`
                    )
                  : t(
                      lang,
                      `تحذير عاجل: شحن بطاريات BESS أقل من 20% (${bessCharge}%) – يرجى تفعيل وضع ترشيد الاستهلاك الذكي فوراً!`,
                      `Critical Alert: BESS battery below 20% (${bessCharge}%) – Activate Eco-Conservation Mode immediately!`
                    )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => triggerLowBessAlert(bessCharge)}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30"
              >
                <Volume2 className="h-3.5 w-3.5" />
                {t(lang, 'تشغيل الإنذار الواقعي', 'Play Industrial Siren')}
              </button>
              <button
                onClick={() => stopAllAlarms()}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/20"
              >
                <VolumeX className="h-3.5 w-3.5" />
                {t(lang, 'كتم الإنذار', 'Silence')}
              </button>
              {!ecoConservation && (
                <button
                  onClick={handleActivateEcoConservation}
                  className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  {t(lang, 'تفعيل وضع Eco-Conservation', 'Activate Eco-Conservation')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Project 107 Event Time vs BESS Power Deficit Conflict Notification Banner */}
        {bessEventConflict && dismissedConflictKey !== conflictKey && (
          <div className="mx-4 mt-4 lg:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/60 bg-amber-950/45 px-4 py-3 text-amber-100 shadow-lg">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs sm:text-sm">
                <div className="font-bold text-amber-300">
                  {t(
                    lang,
                    'إشعار تعارض زمن الفعالية (مشروع 107) ونقص الطاقة في BESS',
                    'Conflict Notification: Event Time (Project 107) vs Low BESS Reserve'
                  )}
                </div>
                <div className="text-slate-200">
                  {t(
                    lang,
                    `فعالية «${activeMergedEvent.titleAr}» في الفترة (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) تتوقع ${activeMergedEvent.predictedVehicles} مركبة وتحتاج احتياطي ${eventRequiredBessPct}%، بينما شحن BESS الحالي ${bessCharge}% فقط.`,
                    `Event "${activeMergedEvent.titleEn}" (${activeMergedEvent.eventWindow || '18:00 - 22:00'}) expects ${activeMergedEvent.predictedVehicles} vehicles needing ${eventRequiredBessPct}% BESS, but current charge is ${bessCharge}%.`
                  )}
                </div>
                <div className="text-[11px] font-semibold text-emerald-300">
                  {t(
                    lang,
                    'الاقتراح الذكي: فعّل وضع الترشيد Eco-Conservation لخفض أحمال الإضاءة والشواحن وتفادي العجز الكهربائي أثناء الفعالية.',
                    'Recommendation: Activate Eco-Conservation Mode to trim lighting/charger load and prevent blackout during the event window.'
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleActivateEcoConservation()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition"
              >
                <Zap className="h-3.5 w-3.5" />
                {t(lang, 'تفعيل وضع Eco-Conservation الآن', 'Activate Eco-Conservation')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('forecast')}
                className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition"
              >
                {t(lang, 'تعديل وقت الفعالية (107)', 'Manage Event Time')}
              </button>
              <button
                type="button"
                onClick={() => setDismissedConflictKey(conflictKey)}
                aria-label={t(lang, 'تجاهل مؤقت', 'Dismiss')}
                className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* View Content */}
        <main className="flex-1 p-4 lg:p-8 space-y-6">
          {/* 1. DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="text-xs text-slate-400">{t(lang, 'نسبة الإشغال', 'Occupancy Rate')}</div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-emerald-400 tabular-nums">
                    {stats.occupancyPct}%
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {stats.occupiedOrReserved} / {stats.total} {t(lang, 'موقف مشغول', 'bays occupied')}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="text-xs text-slate-400">{t(lang, 'المواقف المتاحة والازدحام الحراري', 'Available Bays & Thermal Index')}</div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-extrabold text-cyan-400 tabular-nums">
                      {stats.available}
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                      {stats.thermal.avgTempC}°C ({stats.thermal.congestionIndexPct}%)
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {t(lang, 'شواحن EV: ', 'EV chargers: ')}
                      {spots.filter((s) => s.status === 'available' && s.hasCharger).length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sim2d')}
                      className="flex items-center gap-1 text-amber-300 hover:underline"
                    >
                      <ThermometerSun className="h-3 w-3" />
                      {t(lang, 'الخريطة الحرارية', 'Thermal Map')}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="text-xs text-slate-400">{t(lang, 'CO2 الموفر (كجم)', 'CO2 Saved (kg)')}</div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-emerald-300 tabular-nums">
                    {stats.totalCo2Kg}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {t(lang, 'رصيد الكربون: ', 'Carbon Wallet: ')}
                    {stats.totalPoints} {t(lang, 'نقطة', 'pts')}
                  </div>
                </div>

                <div
                  className={`rounded-xl border bg-[#0D1E2E] p-5 transition ${
                    bessCritical && flashFxEnabled
                      ? 'eco-siren-strobe border-red-500/60'
                      : 'border-white/10'
                  }`}
                >
                  <div className="text-xs text-slate-400">{t(lang, 'شحن BESS', 'BESS Charge')}</div>
                  <div
                    className={`mt-2 font-mono text-3xl font-extrabold tabular-nums ${
                      bessCritical ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {bessCharge}%
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        flashFxEnabled ? 'eco-energy-shimmer' : ''
                      } ${
                        bessCritical
                          ? 'bg-red-500'
                          : bessCharge < 45
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, bessCharge))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-xs text-slate-400">
                    {ecoConservation
                      ? t(lang, 'وضع الترشيد مفعّل', 'Eco-Conservation ON')
                      : t(lang, 'الحالة مستقرة', 'Nominal Status')}
                  </div>
                </div>
              </div>

              {/* Driver's Smart Green QR Pass Card directly accessible from Dashboard */}
              <div
                className={`rounded-xl border border-emerald-500/35 bg-[#0D1E2E] p-5 flex flex-wrap items-center justify-between gap-4 transition ${
                  flashFxEnabled && latestReservation ? 'eco-flash-glow' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {latestReservation ? (
                    <button
                      type="button"
                      onClick={() => setActiveTicket(latestReservation)}
                      className="rounded-xl bg-white p-1.5 shrink-0 transition hover:scale-105"
                      title={t(lang, 'اضغط لعرض التذكرة QR التفاعلية', 'Open Interactive QR Ticket')}
                    >
                      <svg
                        width="52"
                        height="52"
                        viewBox="0 0 90 90"
                        aria-label={latestReservation.ticketCode}
                      >
                        {buildQrMatrix(latestReservation.ticketCode).map((row, rIdx) =>
                          row.map((cell, cIdx) =>
                            cell === 1 ? (
                              <rect
                                key={`${rIdx}-${cIdx}`}
                                x={cIdx * 10}
                                y={rIdx * 10}
                                width="9.5"
                                height="9.5"
                                fill="#0B1927"
                              />
                            ) : null
                          )
                        )}
                      </svg>
                    </button>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
                      <QrCode className="h-7 w-7" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {t(lang, 'التذكرة الخضراء الذكية (Green QR Pass)', 'Driver Smart Green QR Pass')}
                    </h2>
                    {latestReservation ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                        <span className="font-mono font-bold text-amber-400">
                          {latestReservation.ticketCode}
                        </span>
                        <span>·</span>
                        <span>
                          {t(lang, 'السائق:', 'Driver:')} {latestReservation.driverName}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-cyan-400">
                          {t(lang, 'الموقف:', 'Spot:')} {latestReservation.spotLabel}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{latestReservation.plateNumber}</span>
                        <span>·</span>
                        <span className="text-emerald-400">
                          {latestReservation.feeSar + latestReservation.carbonTaxSar} {t(lang, 'ريال', 'SAR')}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        {t(
                          lang,
                          'لا توجد تذكرة حجز نشطة حالياً. قم بإنشاء حجز جديد لإصدار تذكرة QR الخضراء التفاعلية.',
                          'No active reservation yet. Create a booking to generate your interactive Green QR Pass.'
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickScanOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/25"
                  >
                    <ScanLine className="h-4 w-4 text-cyan-300" />
                    {t(lang, 'مسح سريع بالكاميرا (Quick Scan)', 'Quick Scan QR (Camera)')}
                  </button>
                  {latestReservation ? (
                    <>
                      {reservations.length > 1 && (
                        <select
                          aria-label={t(lang, 'اختر التذكرة', 'Select Ticket')}
                          onChange={(e) => {
                            const found = reservations.find((r) => r.id === e.target.value);
                            if (found) setActiveTicket(found);
                          }}
                          defaultValue={latestReservation.id}
                          className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-emerald-400"
                        >
                          {reservations.slice(0, 6).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.ticketCode} · {r.spotLabel}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => setActiveTicket(latestReservation)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                      >
                        <QrCode className="h-4 w-4" />
                        {t(lang, 'عرض تذكرة QR وتفاصيل الحجز', 'Open QR Pass & Booking Details')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setActiveTab('reservations')}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                    >
                      <CalendarCheck className="h-4 w-4" />
                      {t(lang, 'حجز موقف وإصدار تذكرة QR', 'Book Bay & Issue QR')}
                    </button>
                  )}
                </div>
              </div>

              {/* Tri-Platform Integrated Synergy Command Strip */}
              <div className="rounded-xl border border-cyan-500/30 bg-[#0D1E2E] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-cyan-300">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {t(
                          lang,
                          'محور التكامل الشامل: Eco-Park AI × مشروع 101 × مشروع 107 × البيئة الخضراء',
                          'Tri-Platform Command Strip: Eco-Park AI × Project 101 × Project 107 × Green Hub'
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {t(
                          lang,
                          'ترابط حي بين مسارات السياحة المستدامة وتوقعات الفعاليات ومواقف 2D/3D والتشجير البيوفيلي.',
                          'Live orchestration linking eco-tourism routes, event rationing, 2D/3D expansion, and biophilic planting.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={synergyBusy}
                      onClick={() =>
                        void handleExecuteTriProjectSynergy(activeMergedTour, activeMergedEvent)
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:opacity-95 disabled:opacity-50 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {synergyBusy
                        ? t(lang, 'جاري التنفيذ...', 'Running...')
                        : t(lang, 'تشغيل التكامل الشامل', 'Run Full Synergy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reservations')}
                      className="rounded-xl border border-emerald-400/30 bg-[#08121D] px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-white/5 transition"
                    >
                      {t(lang, 'الحجوزات ومسار 101', 'Bookings & Route 101')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('forecast')}
                      className="rounded-xl border border-cyan-400/30 bg-[#08121D] px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-white/5 transition"
                    >
                      {t(lang, 'التوقعات وفعاليات 107', 'Forecast & Events 107')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#08121D] px-3 py-2 text-[11px]">
                    <span className="font-bold text-emerald-400">{t(lang, 'مسار 101:', 'Route 101:')}</span>{' '}
                    <span className="text-white">{lang === 'ar' ? activeMergedTour.cityAr : activeMergedTour.cityEn}</span>
                    <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {activeMergedTour.totalKm} km · SoC {activeMergedTour.batteryEndPct}% · CO₂ -{activeMergedTour.co2SavedKg}kg
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#08121D] px-3 py-2 text-[11px]">
                    <span className="font-bold text-cyan-300">{t(lang, 'فعالية 107:', 'Event 107:')}</span>{' '}
                    <span className="text-white">{lang === 'ar' ? activeMergedEvent.titleAr : activeMergedEvent.titleEn}</span>
                    <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {activeMergedEvent.predictedAttendance} {t(lang, 'حاضر', 'guests')} · {activeMergedEvent.predictedVehicles} {t(lang, 'مركبة', 'veh')} · -{activeMergedEvent.wasteReductionPct}% {t(lang, 'فاقد', 'waste')}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#08121D] px-3 py-2 text-[11px]">
                    <span className="font-bold text-amber-300">{t(lang, 'حالة التوأم والبيئة:', 'Twin & Green Sync:')}</span>{' '}
                    <span className={activeMergedEvent.prepared ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                      {activeMergedEvent.prepared
                        ? t(lang, 'متكامل ومزامَن بالكامل ✓', 'Fully Orchestrated ✓')
                        : t(lang, `يستهدف ${activeMergedEvent.targetBaysNeeded} موقفاً`, `Target ${activeMergedEvent.targetBaysNeeded} bays`)}
                    </span>
                    <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {spots.length} bays · {solarKw} kW · BESS {bessCharge}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly Occupancy Chart + AI Safety Sentry */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2 rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">
                      {t(lang, 'إشغال المواقف خلال اليوم', 'Hourly Parking Occupancy')}
                    </h2>
                    <BarChart3 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-6 flex h-56 items-end gap-3 sm:gap-5 px-2">
                    {hourlyOccupancy.map((bar, idx) => (
                      <div key={bar.hour} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                        <span className="font-mono text-[11px] text-slate-300 tabular-nums">{bar.pct}%</span>
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            idx % 2 === 0 ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`}
                          style={{ height: `${Math.max(bar.pct, 4)}%` }}
                        />
                        <span className="font-mono text-[11px] text-slate-400">{bar.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Safety Sentry Radar */}
                <div
                  className={`rounded-xl border bg-[#0D1E2E] p-5 flex flex-col justify-between space-y-4 transition ${
                    smokeAlert && flashFxEnabled
                      ? 'eco-siren-strobe border-red-500/70'
                      : 'border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-white">
                        {t(lang, 'رادار السلامة AI Safety Sentry', 'AI Safety Sentry Radar')}
                      </h2>
                      <ShieldAlert
                        className={`h-5 w-5 ${smokeAlert ? 'text-red-400' : 'text-emerald-400'}`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {t(
                        lang,
                        'مراقبة حرارية لحظية لكشف الدخان والحرائق وتفعيل مسارات الطوارئ.',
                        'Real-time thermal & smoke anomaly detection across parking sectors.'
                      )}
                    </p>
                  </div>

                  <div
                    className={`relative overflow-hidden rounded-xl border p-4 text-center transition ${
                      smokeAlert
                        ? 'border-red-500/60 bg-red-500/15 text-red-200'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    }`}
                  >
                    <div className="relative mx-auto flex h-12 w-12 items-center justify-center">
                      {flashFxEnabled && (
                        <span
                          aria-hidden="true"
                          className={`eco-radar-ring absolute inset-0 rounded-full border-2 ${
                            smokeAlert ? 'border-red-400/70' : 'border-emerald-400/45'
                          }`}
                        />
                      )}
                      <Flame
                        className={`relative h-8 w-8 ${smokeAlert ? 'text-red-400' : 'text-emerald-400'}`}
                      />
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {smokeAlert
                        ? t(lang, 'إنذار حريق/دخان: القطاع B-04', 'SMOKE ALERT: Sector B-04')
                        : t(lang, 'الحالة آمنة · لا توجد انبعاثات خطرة', 'All Sectors Nominal · Clear')}
                    </div>
                  </div>

                  <button
                    onClick={handleToggleSmokeAlert}
                    className={`w-full rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      smokeAlert
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'border border-red-400/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                    }`}
                  >
                    {smokeAlert
                      ? t(lang, 'إلغاء حالة الطوارئ وإعادة الضبط', 'Clear Alert & Reset Radar')
                      : t(lang, 'محاكاة إنذار دخان وحريق', 'Simulate Smoke / Fire Alert')}
                  </button>
                </div>
              </div>

              {/* 24-Hour Solar Output & BESS Charge/Consumption Recharts Analytics */}
              <EnergyAnalyticsChart
                lang={lang}
                solarKw={solarKw}
                bessCharge={bessCharge}
                ecoConservation={ecoConservation}
                occupiedCount={stats.occupiedOrReserved}
                v2gCount={v2gSessions.length}
              />

              {/* Interactive Monthly CO2 Avoided Report from Firestore Reservations */}
              <CarbonOffsetReport lang={lang} reservations={reservations} />

              {/* Biophilic Green Sustainable Environment & Afforestation Ecosystem */}
              <GreenSustainabilityHub
                lang={lang}
                reservations={reservations}
                spots={spots}
                solarKw={solarKw}
                totalCo2Kg={stats.totalCo2Kg}
                totalCarbonTaxSar={stats.totalCarbonTaxSar}
                onLogGreenAction={(actionAr, actionEn, bonusPoints = 20) => {
                  const txId = `green-${Date.now()}`;
                  const newTx: CarbonTransaction = {
                    id: txId,
                    date: new Date().toISOString().slice(0, 10),
                    descriptionAr: actionAr,
                    descriptionEn: actionEn,
                    points: bonusPoints,
                    co2Kg: 2.5,
                    type: 'bonus',
                  };
                  setTransactions((prev) => [newTx, ...prev]);
                  if (firebaseUser && firebaseUser.emailVerified && db) {
                    setDoc(doc(db, 'carbonTransactions', txId), {
                      ...newTx,
                      userId: firebaseUser.uid,
                      createdAtServer: serverTimestamp(),
                    }).catch(() => undefined);
                  }
                  void appendAudit(actionAr, actionEn);
                }}
                onNotify={showToast}
              />

              {/* Firebase Cloud Functions 5-Minute Supervisor Email Alert Monitor */}
              <SupervisorAlertMonitor
                lang={lang}
                bessCharge={bessCharge}
                smokeAlert={smokeAlert}
                incidents={supervisorAlerts}
                onSimulateBessUnder10={() => triggerLowBessAlert(8)}
                onToggleSmokeAlert={handleToggleSmokeAlert}
                onSimulateFiveMinEscalation={async (alertType) => {
                  const uid = firebaseUser?.uid || 'local-session';
                  const alertId = `${uid}_${alertType}`;
                  const supervisorList = Array.from(
                    new Set([
                      ADMIN_EMAIL,
                      ...users
                        .filter((u) =>
                          ['Super Admin', 'Parking Manager', 'Security', 'Maintenance & Energy'].includes(u.role)
                        )
                        .map((u) => u.email)
                        .filter(Boolean),
                    ])
                  ).slice(0, 10);

                  setSupervisorAlerts((prev) =>
                    prev.map((inc) =>
                      inc.id === alertId
                        ? {
                            ...inc,
                            startedAtMs: Date.now() - 5 * 60 * 1000 - 5000,
                            status: 'escalated',
                            recipients: supervisorList,
                            summaryAr: `${inc.summaryAr} (تم تجاوز 5 دقائق — جاهز للإرسال عبر Cloud Functions إلى: ${supervisorList[0]})`,
                            summaryEn: `${inc.summaryEn} (>5m threshold reached — Cloud Functions alert queued for: ${supervisorList[0]})`,
                          }
                        : inc
                    )
                  );
                  appendAudit(
                    `تصعيد إنذار المشرفين (${alertType}) بعد تجاوز 5 دقائق إلى ${supervisorList.join(', ')}`,
                    `Escalated supervisor alert (${alertType}) after >5m to ${supervisorList.join(', ')}`
                  );
                  showToast(
                    t(
                      lang,
                      `تم تجاوز 5 دقائق وتجهيز تنبيه Cloud Functions للبريد (${supervisorList[0]}).`,
                      `5m threshold passed! Cloud Functions supervisor alert escalated for ${supervisorList[0]}.`
                    )
                  );

                  if (firebaseUser && firebaseUser.emailVerified) {
                    const alertRef = doc(db, 'supervisorAlerts', alertId);
                    try {
                      await setDoc(
                        alertRef,
                        {
                          status: 'escalated',
                          summaryAr: `تم تجاوز 5 دقائق — جاهز للتنبيه الفوري إلى ${supervisorList[0]}`,
                          summaryEn: `>5m threshold passed — escalated for supervisor notification (${supervisorList[0]})`,
                          updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                      );
                    } catch (err) {
                      console.warn('Escalation state sync notice:', err);
                    }
                  }
                }}
              />

              {/* Quick Actions */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                  onClick={() => setActiveTab('livemap')}
                  className="flex items-center justify-between rounded-xl border border-emerald-400/35 bg-[#0D1E2E] p-4 text-start hover:border-emerald-400/70"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'بث المواقف الحي على الخريطة', 'Open Live Parking Map')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'دبابيس تفاعلية، بحث الأماكن، وتوجيه GPS', 'Live bay pins, Places search & GPS')}</div>
                  </div>
                  <MapPin className="h-5 w-5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('sim2d')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-emerald-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'المحاكي ثنائي الأبعاد 2D', 'Open 2D Live Simulator')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'مسار التوجيه الكربوني والرذاذ المائي', 'Eco-routing & water misting')}</div>
                  </div>
                  <Cpu className="h-5 w-5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('sim3d')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-cyan-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'المحاكي ثلاثي الأبعاد 3D PBR', 'Open 3D PBR Simulator')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'مظلات شمسية، محطة BESS، وإضاءة ليلية', 'Solar canopies, BESS & lighting')}</div>
                  </div>
                  <Box className="h-5 w-5 text-cyan-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  onClick={() => setActiveTab('robots')}
                  className="flex items-center justify-between rounded-xl border border-cyan-400/35 bg-[#0D1E2E] p-4 text-start hover:border-cyan-400/70"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'روبوتات الشحن والإخلاء', 'Charge & Evac Robots')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'شحن متنقل 45kW وإرشاد طوارئ', '45kW mobile charger & safety bot')}</div>
                  </div>
                  <Bot className="h-5 w-5 text-cyan-400" />
                </button>
                <button
                  onClick={handleQuickVipBooking}
                  className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-start hover:border-amber-400/80"
                >
                  <div>
                    <div className="text-sm font-bold text-amber-300">{t(lang, '+ حجز VIP ذهبي فوري', '+ Instant VIP Pass')}</div>
                    <div className="mt-1 text-xs text-amber-200/75">{t(lang, 'موقف صف أول + روبوت شحن +50 نقطة', 'Priority bay + robot +50 pts')}</div>
                  </div>
                  <Crown className="h-5 w-5 text-amber-400" />
                </button>
                <button
                  onClick={() => setActiveTab('billing')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-emerald-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'التسعير والفوترة الذكية', 'Dynamic Billing & Invoices')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'محاكي الذروة وإيصالات الكربون', 'Surge tariff & green receipts')}</div>
                  </div>
                  <Receipt className="h-5 w-5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('operations')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-amber-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'الأساطيل والصيانة والطوارئ', 'Fleets, Work Orders & Drills')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'تصاريح ANPR ومناورات الاستجابة', 'Auto-gate permits & chaos drills')}</div>
                  </div>
                  <ClipboardList className="h-5 w-5 text-amber-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                  onClick={() => setActiveTab('audio')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-amber-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'تخصيص التنبيهات الصوتية', 'Audio & Alert Studio')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'نغمات الحريق و BESS واكتمال الحجز مع خيار الكتم الشامل', 'Fire, BESS & checkout tones plus master mute')}</div>
                  </div>
                  {audioPrefs.muted ? (
                    <VolumeX className="h-5 w-5 text-red-400" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-amber-400" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('maintenance')}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1E2E] p-4 text-start hover:border-emerald-400/50"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'الصيانة التنبؤية والحساسات', 'Predictive Maintenance')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'التنبؤ بأعطال شواحن EV وموازنة الأحمال وبطاقات QR', 'EV wear forecasting, load balance & QR asset tags')}</div>
                  </div>
                  <Wrench className="h-5 w-5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center justify-between rounded-xl border border-cyan-400/35 bg-[#0D1E2E] p-4 text-start hover:border-cyan-400/75"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{t(lang, 'الإعدادات والهوية (Team 19)', 'Settings & Institutional Profile')}</div>
                    <div className="mt-1 text-xs text-slate-400">{t(lang, 'بيانات المعهد والمشروع، مضاعف الكربون، وشاشة البوابة', 'Institute identity, carbon multiplier & Gate Kiosk')}</div>
                  </div>
                  <Settings className="h-5 w-5 text-cyan-400" />
                </button>
              </div>

              {/* Integrated Administrative Waste Reduction Summary */}
              <AdminWasteReductionPanel
                compact
                lang={lang}
                reservations={reservations}
                anprScanLogs={anprScanLogs}
                fleetPermits={fleetPermits}
                workOrders={workOrders}
                robotChargingLogs={robotChargingLogs}
                policy={adminWastePolicy}
                onUpdatePolicy={handleUpdateAdminWastePolicy}
                onNotify={showToast}
              />
            </div>
          )}

          {/* 2. PARKING & ANPR */}
          {activeTab === 'parking' && (
            <div className="space-y-6">
              <AnprScanner
                lang={lang}
                scans={anprScanLogs}
                onExportComplete={(count) =>
                  showToast(
                    t(
                      lang,
                      `تم تصدير ${count} سجل ANPR/QR بصيغة CSV بنجاح.`,
                      `Exported ${count} ANPR/QR scan logs to CSV.`
                    )
                  )
                }
                onDetectedAndAssign={(res) => {
                  const avail =
                    (res.vehicleType === 'ELECTRIC'
                      ? spotsRef.current.find((s) => s.status === 'available' && s.hasCharger)
                      : spotsRef.current.find((s) => s.status === 'available')) ||
                    spotsRef.current.find((s) => s.status === 'available') ||
                    handleAddParkingSpot();
                  handleParkVehicle(avail.id, res.vehicleType, res.plateNumber);
                  appendAnprScan({
                    plateNumber: res.plateNumber,
                    assignedBayId: avail.id,
                    assignedBayLabel: avail.label,
                    vehicleType: res.vehicleType,
                    scanSource: res.scanSource || 'anpr_camera',
                    confidence: res.confidence,
                  });
                  playHydraulicGateSound();
                  speakGuidance(
                    lang === 'ar'
                      ? `تم رصد اللوحة ${res.plateNumber}. تفضل بالدخول إلى الموقف ${avail.label}.`
                      : `Plate ${res.plateNumber} detected. Proceed to bay ${avail.label}.`,
                    lang
                  );
                  showToast(
                    t(
                      lang,
                      `تم تخصيص الموقف ${avail.label} للمركبة ${res.plateNumber}`,
                      `Assigned bay ${avail.label} to ${res.plateNumber}`
                    )
                  );
                }}
              />

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-base font-bold text-white">
                    {t(lang, 'خريطة المواقف اللحظية (اضغط للتبديل)', 'Live Parking Bays Matrix (Click to Toggle)')}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{t(lang, 'أخضر: متاح', 'Green: Available')}</span>
                    <span>·</span>
                    <span>{t(lang, 'أحمر: مشغول', 'Red: Occupied')}</span>
                    <span>·</span>
                    <span>{t(lang, 'أصفر: محجوز', 'Amber: Reserved')}</span>
                    {stats.available === 0 ? (
                      <button
                        type="button"
                        onClick={handleAddParkingSpot}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        {t(lang, 'إضافة موقف جديد (+)', '+ Add New Bay')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const cycleTypes: VehicleType[] = ['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'];
                          setSpots((prev) =>
                            prev.map((s, idx) =>
                              s.status === 'available'
                                ? {
                                    ...s,
                                    status: 'occupied',
                                    vehicleType: cycleTypes[idx % cycleTypes.length],
                                    vehiclePlate: `ECO-${100 + idx}`,
                                  }
                                : s
                            )
                          );
                          showToast(
                            t(
                              lang,
                              'تم محاكاة امتلاء جميع المواقف! انتقل إلى 2D أو 3D لمشاهدة التوسع والحرارة.',
                              'Simulated 100% lot saturation! Open 2D or 3D to see Dynamic Bay Expansion & Thermal Map.'
                            )
                          );
                        }}
                        className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
                      >
                        {t(lang, 'محاكاة امتلاء المواقف 100%', 'Simulate 100% Full Lot')}
                      </button>
                    )}
                    {stats.occupiedOrReserved > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSpots((prev) =>
                            prev.map((s) => ({
                              ...s,
                              status: 'available',
                              vehicleType: undefined,
                              vehiclePlate: undefined,
                            }))
                          )
                        }
                        className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                      >
                        {t(lang, 'تحرير المواقف', 'Free All Bays')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {spots.map((spot) => {
                    const isAvail = spot.status === 'available';
                    const isRes = spot.status === 'reserved';
                    const flashClass = !flashFxEnabled
                      ? ''
                      : isAvail && spot.hasCharger
                        ? 'eco-flash-glow'
                        : isRes
                          ? 'eco-amber-flash'
                          : '';
                    return (
                      <button
                        key={spot.id}
                        onClick={() =>
                          setSpots((prev) =>
                            prev.map((s) =>
                              s.id === spot.id
                                ? {
                                    ...s,
                                    status: isAvail ? 'occupied' : 'available',
                                    vehicleType: isAvail ? 'ELECTRIC' : undefined,
                                    vehiclePlate: undefined,
                                  }
                                : s
                            )
                          )
                        }
                        className={`rounded-xl border p-4 text-start transition ${flashClass} ${
                          isAvail
                            ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                            : isRes
                              ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
                              : 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-lg font-extrabold text-white">
                            {spot.label}
                          </span>
                          {spot.hasCharger && (
                            <span className="font-mono text-[11px] font-bold text-cyan-400">
                              ⚡{spot.chargerKw}kW
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">{spot.zone}</div>
                        <div className="mt-2 font-mono text-xs font-semibold">
                          {isAvail
                            ? t(lang, 'متاح للحجز', 'Available')
                            : spot.vehiclePlate || t(lang, 'مشغول', 'Occupied')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnprScanHistoryPanel
                lang={lang}
                scans={anprScanLogs}
                reservations={reservations}
                onVerifyQrTicket={(ticketOrPlate) => {
                  const normalized = ticketOrPlate.trim().toLowerCase();
                  const matchedRes = reservations.find(
                    (r) =>
                      r.ticketCode.toLowerCase() === normalized ||
                      r.plateNumber.toLowerCase() === normalized
                  );
                  if (matchedRes) {
                    appendAnprScan({
                      plateNumber: matchedRes.plateNumber,
                      assignedBayId: matchedRes.spotId,
                      assignedBayLabel: matchedRes.spotLabel,
                      vehicleType: matchedRes.vehicleType,
                      scanSource: 'qr_pass',
                      confidence: 100,
                      ticketCode: matchedRes.ticketCode,
                    });
                    playHydraulicGateSound();
                    showToast(
                      t(
                        lang,
                        `تم التحقق من التذكرة ${matchedRes.ticketCode} (${matchedRes.plateNumber}) → الموقف ${matchedRes.spotLabel}`,
                        `Verified QR Pass ${matchedRes.ticketCode} (${matchedRes.plateNumber}) → Bay ${matchedRes.spotLabel}`
                      )
                    );
                    return;
                  }

                  const avail =
                    spotsRef.current.find((s) => s.status === 'available') ||
                    handleAddParkingSpot();
                  const cleanCode = ticketOrPlate.trim().toUpperCase();
                  handleParkVehicle(avail.id, 'ELECTRIC', cleanCode);
                  appendAnprScan({
                    plateNumber: cleanCode,
                    assignedBayId: avail.id,
                    assignedBayLabel: avail.label,
                    vehicleType: 'ELECTRIC',
                    scanSource: 'qr_pass',
                    confidence: 100,
                    ticketCode: cleanCode.startsWith('ECO-') || cleanCode.startsWith('VIP-') ? cleanCode : undefined,
                  });
                  playHydraulicGateSound();
                  showToast(
                    t(
                      lang,
                      `تم تسجيل مسح QR وتخصيص الموقف ${avail.label} لـ ${cleanCode}`,
                      `Logged QR scan and assigned bay ${avail.label} for ${cleanCode}`
                    )
                  );
                }}
                onClearHistory={() => {
                  setAnprScanLogs([]);
                  localStorage.removeItem('ecopark_anpr_scan_logs');
                  showToast(t(lang, 'تم مسح سجل مسوحات ANPR و QR.', 'Cleared ANPR & QR scan history.'));
                }}
              />
            </div>
          )}

          {/* 3. RESERVATIONS & GREEN QR PASS */}
          {activeTab === 'reservations' && (
            <div className="space-y-6">
              <form
                onSubmit={handleConfirmBooking}
                className="grid grid-cols-1 gap-6 lg:grid-cols-3"
              >
                <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-white">
                      {t(lang, 'إنشاء حجز ذكي أو حجز VIP وإصدار تذكرة QR', 'Create Smart or VIP Reservation & Issue QR')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBookVipMode((v) => !v)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          bookVipMode
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : 'border-white/15 bg-[#08121D] text-slate-300 hover:border-amber-400/40'
                        }`}
                      >
                        <Crown className="h-3.5 w-3.5 text-amber-400" />
                        {bookVipMode
                          ? t(lang, 'وضع VIP الذهبي مفعّل', 'VIP Gold Mode ON')
                          : t(lang, 'تفعيل حجز VIP مميز', 'Switch to VIP Pass')}
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickVipBooking}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                      >
                        <Crown className="h-3.5 w-3.5" />
                        {t(lang, '+ حجز VIP فوري', '+ Quick VIP Booking')}
                      </button>
                    </div>
                  </div>

                  {bookVipMode && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                      <span>
                        {t(
                          lang,
                          'يشمل حجز VIP: أولوية الصف الأول الأقرب للمصعد + شاحن فائق + مكافأة +50 نقطة كربون.',
                          'VIP Gold includes priority front EV bay, valet concierge & +50 bonus carbon points.'
                        )}
                      </span>
                      <label className="flex items-center gap-2 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bookVipSummonRobot}
                          onChange={(e) => setBookVipSummonRobot(e.target.checked)}
                          className="accent-amber-400"
                        />
                        {t(lang, 'استدعاء روبوت الشحن تلقائياً', 'Auto-dispatch Charging Robot')}
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'الفرع', 'Branch')}
                      </label>
                      <select
                        value={bookBranch}
                        onChange={(e) => setBookBranch(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        {BRANCHES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'الموقف (مكان واحد لكل مركبة)', 'Parking Bay (1 Car Per Bay)')}
                      </label>
                      <select
                        value={bookSpotId}
                        onChange={(e) => setBookSpotId(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        {spots.map((s) => (
                          <option key={s.id} value={s.id} disabled={s.status !== 'available'}>
                            {s.label} · {s.zone} {s.hasCharger ? '⚡' : '🅿️'} (
                            {s.status === 'available'
                              ? t(lang, 'متاح', 'Available')
                              : s.status === 'reserved'
                                ? t(lang, 'محجوز', 'Reserved')
                                : t(lang, 'مشغول', 'Occupied')}
                            )
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'اسم السائق', 'Driver Name')}
                      </label>
                      <input
                        type="text"
                        value={bookDriver}
                        onChange={(e) => setBookDriver(e.target.value)}
                        placeholder={t(lang, 'أدخل اسم السائق', 'Enter driver name')}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'رقم اللوحة', 'Plate Number')}
                      </label>
                      <input
                        type="text"
                        value={bookPlate}
                        onChange={(e) => setBookPlate(e.target.value)}
                        placeholder={t(lang, 'مثال: أ ب ج 1234', 'e.g. ABC 1234')}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-emerald-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'فئة المركبة', 'Vehicle Category')}
                      </label>
                      <select
                        value={bookVehicleType}
                        onChange={(e) => setBookVehicleType(e.target.value as VehicleType)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
                          <option key={vt} value={vt}>
                            {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'موعد الدخول', 'Entry Time')}
                      </label>
                      <input
                        type="datetime-local"
                        value={bookEntry}
                        onChange={(e) => setBookEntry(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-slate-300">
                        {t(lang, 'موعد الخروج', 'Exit Time')}
                      </label>
                      <input
                        type="datetime-local"
                        value={bookExit}
                        onChange={(e) => setBookExit(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div
                  className={`rounded-xl border p-6 flex flex-col justify-between space-y-6 ${
                    bookVipMode
                      ? 'border-amber-400/50 bg-gradient-to-b from-[#17212B] to-[#0D1E2E]'
                      : 'border-white/10 bg-[#0D1E2E]'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      {bookVipMode && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                      {bookVipMode
                        ? t(lang, 'باقة VIP التنفيذية الذهبية', 'VIP Executive Gold Tariff')
                        : t(lang, 'الرسوم التقديرية (التعرفة الخضراء)', 'Estimated Dynamic Eco-Tariff')}
                    </div>
                    <div
                      className={`mt-3 font-mono text-4xl font-extrabold tabular-nums ${
                        bookVipMode ? 'text-amber-300' : 'text-emerald-400'
                      }`}
                    >
                      {bookVipMode
                        ? 25
                        : VEHICLE_SPECS[bookVehicleType].feeSar +
                          VEHICLE_SPECS[bookVehicleType].carbonTaxSar}{' '}
                      <span className="text-lg">{t(lang, 'ريال', 'SAR')}</span>
                    </div>
                    {!bookVipMode && VEHICLE_SPECS[bookVehicleType].carbonTaxSar > 0 && (
                      <div className="mt-1 text-xs text-amber-400">
                        {t(
                          lang,
                          'يشمل 5 ر.س ضريبة كربون للتشجير الوطني',
                          'Includes 5 SAR Carbon Tax for Afforestation'
                        )}
                      </div>
                    )}

                    <div className="mt-4 border-t border-white/10 pt-4 space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>{t(lang, 'نقاط الكربون المتوقعة:', 'Expected Carbon Points:')}</span>
                        <span className="font-mono font-bold text-emerald-400">
                          +{VEHICLE_SPECS[bookVehicleType].pointsReward + (bookVipMode ? 50 : 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t(lang, 'حساس عادم الغاز:', 'Exhaust Sensor Baseline:')}</span>
                        <span className="font-mono text-cyan-400">
                          {VEHICLE_SPECS[bookVehicleType].exhaustPpm} ppm
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                      bookVipMode
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    }`}
                  >
                    {bookVipMode
                      ? t(lang, 'تأكيد حجز VIP وإصدار التذكرة الذهبية', 'Confirm VIP Booking & Issue Gold QR')
                      : t(lang, 'تأكيد الحجز وإصدار QR', 'Confirm Booking & Issue QR')}
                  </button>
                </div>
              </form>

              {/* Active Reservations Table */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="text-base font-bold text-white">
                    {t(lang, 'التذاكر والحجوزات المسجلة', 'Saved Reservations & Green Passes')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setClearModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t(lang, 'تفريغ الحجوزات والمعاملات', 'Clear System Data')}
                  </button>
                </div>
                {reservations.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t(
                      lang,
                      'لا توجد حجوزات مسجلة حتى الآن. استخدم النموذج أعلاه لإصدار أول تذكرة خضراء.',
                      'No reservations recorded yet. Use the form above to issue your first Green Pass.'
                    )}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-slate-400">
                          <th className="pb-3 text-start">{t(lang, 'رمز التذكرة', 'Ticket')}</th>
                          <th className="pb-3 text-start">{t(lang, 'السائق', 'Driver')}</th>
                          <th className="pb-3 text-start">{t(lang, 'اللوحة', 'Plate')}</th>
                          <th className="pb-3 text-start">{t(lang, 'الفئة', 'Type')}</th>
                          <th className="pb-3 text-start">{t(lang, 'الموقف', 'Bay')}</th>
                          <th className="pb-3 text-start">{t(lang, 'الرسوم', 'Fee')}</th>
                          <th className="pb-3 text-start">{t(lang, 'إجراء', 'Action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reservations.map((r) => (
                          <tr key={r.id} className="hover:bg-white/5">
                            <td className="py-3 font-mono font-bold text-amber-400">{r.ticketCode}</td>
                            <td className="py-3 text-white">{r.driverName}</td>
                            <td className="py-3 font-mono text-slate-300">{r.plateNumber}</td>
                            <td className="py-3 text-xs">{r.vehicleType}</td>
                            <td className="py-3 font-mono text-cyan-400">{r.spotLabel}</td>
                            <td className="py-3 font-mono tabular-nums">
                              {r.feeSar + r.carbonTaxSar} {t(lang, 'ر.س', 'SAR')}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setActiveTicket(r)}
                                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  {t(lang, 'التذكرة الخضراء', 'View QR Pass')}
                                </button>
                                {r.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCheckInReservation(r)}
                                    className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
                                  >
                                    <ScanLine className="h-3.5 w-3.5" />
                                    {t(lang, 'تسجيل وصول', 'Check-In')}
                                  </button>
                                )}
                                {r.status === 'arrived' && (
                                  <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase">
                                    {t(lang, 'وصل (Arrived)', 'Arrived ✓')}
                                  </span>
                                )}
                                {r.status === 'active' || r.status === 'arrived' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteReservation(r)}
                                    className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {t(lang, 'إنهاء الحجز (FCM)', 'Complete (FCM)')}
                                  </button>
                                ) : (
                                  <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                                    {r.status}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Project 101 Natively Embedded inside Reservations & QR Pass */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#0A1724] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <Compass className="h-4 w-4" />
                      {t(
                        lang,
                        'مخطط المسار السياحي الأخضر المدمج مع الحجز (مشروع 101 ➔ Eco-Park)',
                        'Integrated Smart Tourism Route Planner inside Bookings (Project 101)'
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        lang,
                        'اختيار المدينة أو المركبة هنا يُحدّث فرع الحجز وفئته أعلاه تلقائياً ويُصدر تذكرة QR الخضراء في خطوة واحدة.',
                        'Choosing your city route or vehicle auto-binds your booking branch & vehicle above and issues your Green QR Pass.'
                      )}
                    </p>
                  </div>
                </div>
                <MergedPlatformsHub
                  lang={lang}
                  spots={spots}
                  bessCharge={bessCharge}
                  solarKw={solarKw}
                  ecoConservation={ecoConservation}
                  defaultDriverName={currentUser.name}
                  embeddedMode="p101"
                  onBindBookingFields={(branch, vt) => {
                    setBookBranch(branch);
                    setBookVehicleType(vt);
                  }}
                  activeTour={activeMergedTour}
                  activeEvent={activeMergedEvent}
                  onSyncTour={setActiveMergedTour}
                  onSyncEvent={setActiveMergedEvent}
                  onExecuteTriProjectSynergy={handleExecuteTriProjectSynergy}
                  onNavigateTab={setActiveTab}
                  onBookCombinedReservation={async (opts) => {
                    const candidate =
                      spotsRef.current.find(
                        (s) => s.status === 'available' && (opts.vehicleType === 'ELECTRIC' ? s.hasCharger : true)
                      ) || spotsRef.current.find((s) => s.status === 'available');
                    const spotId = candidate?.id || spotsRef.current[0]?.id || 'A-01';
                    const nowIso = new Date().toISOString().slice(0, 16);
                    const exitIso = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
                    await createReservationInternal({
                      branch: opts.branch,
                      spotId,
                      driverName: opts.driverName,
                      plateNumber: opts.plateNumber,
                      vehicleType: opts.vehicleType,
                      entryTime: nowIso,
                      exitTime: exitIso,
                      isVip: opts.isVip,
                      summonRobot: opts.summonRobot,
                    });
                    void appendAudit(opts.sourceLabelAr, opts.sourceLabelEn);
                  }}
                  onPrepareEventCapacity={(eventTitle, targetBaysNeeded, enableEco) => {
                    let added = 0;
                    const cappedTarget = Math.min(24, targetBaysNeeded);
                    while (spotsRef.current.length < cappedTarget) {
                      handleAddParkingSpot();
                      added += 1;
                    }
                    if (enableEco && !ecoConservation) {
                      setEcoConservation(true);
                    }
                    void appendAudit(
                      `تجهيز مسار/مواقف (${eventTitle}): +${added} مواقف`,
                      `Prepared Route Bays (${eventTitle}): +${added} bays`
                    );
                    return added;
                  }}
                  onNotify={showToast}
                />
              </div>
            </div>
          )}

          {/* 4. ENERGY & BESS & V2G */}
          {activeTab === 'energy' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div
                  className={`rounded-xl border bg-[#0D1E2E] p-5 space-y-3 transition ${
                    bessCritical && flashFxEnabled
                      ? 'eco-siren-strobe border-red-500/70'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{t(lang, 'شحن بطاريات BESS', 'BESS Storage Level')}</span>
                    <span
                      className={`font-mono text-2xl font-extrabold tabular-nums ${
                        bessCritical ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {bessCharge}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        flashFxEnabled ? 'eco-energy-shimmer' : ''
                      } ${
                        bessCritical
                          ? 'bg-red-500'
                          : bessCharge < 45
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, bessCharge))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={bessCharge}
                    onChange={(e) => triggerLowBessAlert(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => triggerLowBessAlert(16)}
                      className="flex-1 rounded-lg border border-red-400/40 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                    >
                      {t(lang, 'اختبار 16% (<20%)', 'Test 16% Alarm')}
                    </button>
                    <button
                      onClick={() => triggerLowBessAlert(8)}
                      className="flex-1 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
                    >
                      {t(lang, 'حرج 8% (<10%)', 'Test 8% (<10%)')}
                    </button>
                      <button
                      onClick={() => {
                        if (ecoConservation) {
                          recordEcoToggleEvent(false, 100);
                        }
                        setBessCharge(100);
                        setEcoConservation(false);
                        persistEnergyState({
                          bessCharge: 100,
                          ecoConservation: false,
                          solarKw,
                          smokeAlert,
                        });
                      }}
                      className="flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      {t(lang, 'شحن 100%', 'Restore 100%')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEcoConservation(false);
                      setDismissedConflictKey(null);
                      const testPct = Math.max(22, eventRequiredBessPct - 14);
                      setBessCharge(testPct);
                      persistEnergyState({
                        bessCharge: testPct,
                        ecoConservation: false,
                        solarKw,
                        smokeAlert,
                      });
                    }}
                    className="w-full rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20 transition"
                  >
                    {t(
                      lang,
                      'محاكاة تعارض وقت فعالية (107) مع نقص BESS',
                      'Simulate Project 107 Event Time vs BESS Conflict'
                    )}
                  </button>
                </div>

                <div
                  className={`rounded-xl border bg-[#0D1E2E] p-5 transition ${
                    solarKw > 0 && flashFxEnabled
                      ? 'eco-amber-flash border-amber-400/40'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{t(lang, 'إنتاج المظلات الشمسية', 'Solar Canopy Output')}</span>
                    <Sun className={`h-4 w-4 text-amber-400 ${solarKw > 0 && flashFxEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '9s' }} />
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold text-amber-400 tabular-nums">
                    {solarKw} kW
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-500 ${
                        solarKw > 0 && flashFxEnabled ? 'eco-energy-shimmer' : ''
                      }`}
                      style={{ width: `${Math.min(100, (solarKw / 250) * 100)}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={250}
                    step={5}
                    value={solarKw}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSolarKw(val);
                      persistEnergyState({
                        bessCharge,
                        ecoConservation,
                        solarKw: val,
                        smokeAlert,
                      });
                    }}
                    className="mt-3 w-full accent-amber-400"
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-slate-400">{t(lang, 'حالة التبادل الثنائي V2G', 'V2G Bidirectional Status')}</div>
                    <div
                      className={`mt-2 font-mono text-2xl font-extrabold ${
                        ecoConservation ? 'text-amber-400' : 'text-cyan-400'
                      }`}
                    >
                      {ecoConservation ? t(lang, 'معلّق (وضع الترشيد)', 'Paused (Eco-Mode)') : t(lang, 'نشط ومتصل بالشبكة', 'Active Grid Sync')}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleEcoConservation}
                    className={`mt-3 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      ecoConservation
                        ? 'bg-emerald-500 text-slate-950'
                        : 'border border-amber-400/40 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {ecoConservation
                      ? t(lang, 'إيقاف وضع الترشيد', 'Disable Eco-Conservation')
                      : t(lang, 'تفعيل وضع ترشيد الاستهلاك الذكي', 'Enable Eco-Conservation Mode')}
                  </button>
                </div>
              </div>

              {/* Solar Performance Monitor (<70% Historical Weather Efficiency Maintenance Alert) */}
              <SolarPerformanceMonitor
                lang={lang}
                solarKw={solarKw}
                weather={weather2d}
                spotsCount={spots.length}
                onChangeWeather={handleWeather2dChange}
                onScenarioTelemetryChange={(dust, wind) => {
                  setSolarDustPct(dust);
                  setSolarWindKmh(wind);
                }}
                onAdjustSolarKw={(kw) => {
                  setSolarKw(kw);
                  persistEnergyState({
                    bessCharge,
                    ecoConservation,
                    solarKw: kw,
                    smokeAlert,
                  });
                }}
                onTriggerMaintenanceAlert={({
                  efficiencyPct,
                  actualKw,
                  expectedAvgKw,
                  weatherLabel,
                  scenarioSummaryAr,
                  scenarioSummaryEn,
                }) => {
                  const wo: MaintenanceWorkOrder = {
                    id: `WO-PV-${Math.floor(100 + Math.random() * 899)}`,
                    bayId: 'SOLAR-CANOPY',
                    issueAr: `هبوط كفاءة الألواح الشمسية إلى ${efficiencyPct}% (${actualKw} kW مقابل ${expectedAvgKw} kW لطقس ${weatherLabel})${scenarioSummaryAr ? ` · ${scenarioSummaryAr}` : ''}`,
                    issueEn: `Solar efficiency dropped to ${efficiencyPct}% (${actualKw} kW vs ${expectedAvgKw} kW ${weatherLabel} historical avg)${scenarioSummaryEn ? ` · ${scenarioSummaryEn}` : ''}`,
                    priority: 'critical',
                    assignee: projectSettings.supervisorName || 'م. طارق المنصور',
                    status: 'open',
                    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    autoDetected: true,
                  };
                  setWorkOrders((prev) => [wo, ...prev]);
                  const title = t(
                    lang,
                    `⚠️ تنبيه صيانة شمسية (${efficiencyPct}% < 70%)`,
                    `⚠️ Solar Performance Alert (${efficiencyPct}% < 70%)`
                  );
                  const body = lang === 'ar' ? wo.issueAr : wo.issueEn;
                  dispatchBrowserPushNotification(title, body, 'ecopark-solar-70-alert');
                  appendAudit(
                    `تنبيه صيانة شمسية تلقائي (${wo.id}): ${wo.issueAr}`,
                    `Auto-created solar maintenance alert (${wo.id}): ${wo.issueEn}`
                  );
                  showToast(`${title} — ${body}`);
                }}
              />

              {/* Automated Dry Solar Cleaning Robot Dispatch (Post-Sandstorm Recovery) */}
              <SolarDryCleanPanel
                lang={lang}
                solarKw={solarKw}
                dustPct={solarDustPct}
                windKmh={solarWindKmh}
                onUpdateDustPct={setSolarDustPct}
                onRestoreSolarKw={(gain) => {
                  const nextKw = Math.min(250, Math.round(solarKw + gain));
                  setSolarKw(nextKw);
                  persistEnergyState({
                    bessCharge,
                    ecoConservation,
                    solarKw: nextKw,
                    smokeAlert,
                  });
                }}
                onLogAudit={appendAudit}
                onNotify={showToast}
              />

              {/* 24h BESS Battery Charge Health Trend & Eco-Conservation Toggle Markers */}
              <BessHealthTrendChart
                lang={lang}
                bessCharge={bessCharge}
                solarKw={solarKw}
                ecoConservation={ecoConservation}
                ecoToggleEvents={ecoToggleEvents}
                onToggleEcoConservation={handleToggleEcoConservation}
              />

              {/* BESS Cell Health, Internal Resistance & RUL Diagnostics */}
              <BessCellDiagnosticsPanel
                lang={lang}
                bessCharge={bessCharge}
                ecoConservation={ecoConservation}
                supervisorName={projectSettings.supervisorName || currentUser?.name || 'Supervisor'}
                onCreateWorkOrder={(wo) => setWorkOrders((prev) => [wo, ...prev])}
                onLogAudit={appendAudit}
                onNotify={showToast}
              />

              {/* V2G Sessions */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="text-base font-bold text-white">
                    {t(lang, 'جلسات تبادل الطاقة V2G', 'Vehicle-to-Grid (V2G) Sessions')}
                  </h3>
                  <button
                    disabled={ecoConservation || !bookPlate.trim()}
                    onClick={async () => {
                      if (!firebaseUser || !firebaseUser.emailVerified) return;
                      const sessionId = `v2g-${Date.now()}`;
                      const session: V2GSession = {
                        id: sessionId,
                        vehiclePlate: bookPlate.trim() || 'EV-GRID',
                        vehicleModel: VEHICLE_SPECS[bookVehicleType].labelEn,
                        mode: 'discharging',
                        energyKwh: 15.0,
                        powerKw: 11.0,
                        startedAt: new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      };
                      setV2gSessions((prev) => [session, ...prev]);
                      const path = `v2gSessions/${sessionId}`;
                      try {
                        await setDoc(doc(db, 'v2gSessions', sessionId), {
                          ...session,
                          userId: firebaseUser.uid,
                          createdAtServer: serverTimestamp(),
                        });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.CREATE, path);
                      }
                    }}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-40"
                  >
                    {t(lang, '+ تسجيل جلسة V2G لمركبتك', '+ Log V2G Session')}
                  </button>
                </div>

                {v2gSessions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t(
                      lang,
                      'لا توجد جلسات V2G نشطة حالياً.',
                      'No active V2G sessions recorded yet.'
                    )}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {v2gSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-[#08121D] px-4 py-3 transition ${
                          session.mode === 'discharging' && flashFxEnabled
                            ? 'eco-flash-glow border-cyan-400/45'
                            : 'border-white/10'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold text-white">
                            {session.vehicleModel} · <span className="font-mono text-cyan-400">{session.vehiclePlate}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {t(lang, 'بدأت:', 'Started:')} {session.startedAt} · {session.powerKw} kW
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                            {session.energyKwh} kWh
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              session.mode === 'paused'
                                ? 'text-amber-400'
                                : session.mode === 'discharging'
                                  ? 'text-cyan-400'
                                  : 'text-emerald-400'
                            }`}
                          >
                            {session.mode === 'paused'
                              ? t(lang, 'موقوف (BESS)', 'Paused')
                              : session.mode === 'discharging'
                                ? t(lang, 'تفريغ للشبكة', 'Discharging to Grid')
                                : t(lang, 'شحن ذكي', 'Smart Charging')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Per-Bay Power Telemetry Chart (EV Charging vs Standard Bays) */}
              <BayPowerTelemetryChart
                lang={lang}
                spots={spots}
                solarKw={solarKw}
                ecoConservation={ecoConservation}
                chargingRobot={chargingRobot}
                autoLoadBalance={projectSettings.autoLoadBalance}
                smartNightActive={smartNightActive}
                nightPowerReductionPct={projectSettings.nightPowerReductionPct}
              />

              {/* Inverter Trip & Main Grid Blackout Failover Resilience Drill */}
              <InverterGridFaultDrillPanel
                lang={lang}
                solarKw={solarKw}
                bessCharge={bessCharge}
                supervisorName={projectSettings.supervisorName || currentUser?.name || 'Supervisor'}
                onAdjustSolarKw={(kw) => {
                  setSolarKw(kw);
                  persistEnergyState({
                    bessCharge,
                    ecoConservation,
                    solarKw: kw,
                    smokeAlert,
                  });
                }}
                onAdjustBessCharge={(pct) => triggerLowBessAlert(pct)}
                onCreateWorkOrder={(wo) => setWorkOrders((prev) => [wo, ...prev])}
                onLogAudit={appendAudit}
                onNotify={showToast}
              />
            </div>
          )}

          {/* 5. CARBON WALLET & ANNUAL CALCULATOR */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className={`rounded-xl border border-white/10 bg-[#0D1E2E] p-5 ${flashFxEnabled && stats.availablePoints > 0 ? 'eco-flash-glow' : ''}`}>
                  <div className="text-xs text-slate-400">{t(lang, 'الرصيد المتاح للاستبدال', 'Redeemable Points')}</div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-emerald-400 tabular-nums">
                    {stats.availablePoints}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {t(lang, `إجمالي المكتسب: ${stats.totalPoints}`, `Lifetime Earned: ${stats.totalPoints}`)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="text-xs text-slate-400">{t(lang, 'إجمالي CO2 الموفر', 'Total CO2 Saved')}</div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-cyan-400 tabular-nums">
                    {stats.totalCo2Kg} {t(lang, 'كجم', 'kg')}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {t(lang, `يعادل غرس ${(stats.totalCo2Kg / 21).toFixed(1)} شجرة`, `≈ ${(stats.totalCo2Kg / 21).toFixed(1)} trees planted`)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <div className="text-xs text-slate-400">{t(lang, 'القيمة التقديرية لأرصدة الكربون', 'Carbon Credit Value')}</div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-amber-400 tabular-nums">
                    {(stats.totalCo2Kg * 0.45).toFixed(2)} SAR
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {t(lang, 'مقومة وفق معيار ESG Scope 3', 'Valued under ESG Scope 3')}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 flex flex-col justify-between">
                  <div className="text-xs text-slate-400">{t(lang, 'شهادة الأثر البيئي', 'ESG Wallet Certificate')}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const cert = [
                        '=== ECO-PARK AI v5.0 — CARBON WALLET STATEMENT ===',
                        `Holder: ${currentUser.name} (${currentUser.email})`,
                        `Redeemable Carbon Points: ${stats.availablePoints} pts`,
                        `Lifetime Points: ${stats.totalPoints} pts`,
                        `Total CO2 Avoided: ${stats.totalCo2Kg} kg`,
                        `Trees Equivalent: ${(stats.totalCo2Kg / 21).toFixed(1)}`,
                        `Carbon Credit Market Value: ${(stats.totalCo2Kg * 0.45).toFixed(2)} SAR`,
                        `Issued: ${new Date().toISOString()}`,
                      ].join('\n');
                      const blob = new Blob([cert], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'eco-park-carbon-certificate.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast(t(lang, 'تم تنزيل شهادة محفظة الكربون.', 'Carbon Wallet certificate downloaded.'));
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t(lang, 'تصدير الشهادة', 'Export Statement')}
                  </button>
                </div>
              </div>

              {/* Biophilic Green Sustainable Environment Integrated with Carbon Wallet */}
              <GreenSustainabilityHub
                lang={lang}
                reservations={reservations}
                spots={spots}
                solarKw={solarKw}
                totalCo2Kg={stats.totalCo2Kg}
                totalCarbonTaxSar={stats.totalCarbonTaxSar}
                onLogGreenAction={(actionAr, actionEn, bonusPoints = 20) => {
                  const txId = `green-${Date.now()}`;
                  const newTx: CarbonTransaction = {
                    id: txId,
                    date: new Date().toISOString().slice(0, 10),
                    descriptionAr: actionAr,
                    descriptionEn: actionEn,
                    points: bonusPoints,
                    co2Kg: 2.5,
                    type: 'bonus',
                  };
                  setTransactions((prev) => [newTx, ...prev]);
                  if (firebaseUser && firebaseUser.emailVerified && db) {
                    setDoc(doc(db, 'carbonTransactions', txId), {
                      ...newTx,
                      userId: firebaseUser.uid,
                      createdAtServer: serverTimestamp(),
                    }).catch(() => undefined);
                  }
                  void appendAudit(actionAr, actionEn);
                }}
                onNotify={showToast}
              />

              {/* Eco-Rewards Redemption Store */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {t(lang, 'متجر مكافآت محفظة الكربون واستبدال النقاط', 'Carbon Wallet Eco-Rewards Store')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {t(lang, 'استبدل نقاط الكربون المكتسبة بشحن روبوتي مجاني أو تذاكر VIP أو غرس أشجار موثقة.', 'Redeem Carbon Points for free mobile robot EV charging, VIP passes, or tree planting.')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    {
                      id: 'ev-charge',
                      cost: 50,
                      co2Gain: 6.5,
                      titleAr: 'شحن EV مجاني (20 kWh) بالروبوت',
                      titleEn: 'Free 20 kWh Mobile Robot Charge',
                      descAr: 'يستدعي روبوت EcoCharge X1 مجاناً لأقرب موقف.',
                      descEn: 'Complimentary EcoCharge X1 fast charge session.',
                    },
                    {
                      id: 'vip-upgrade',
                      cost: 100,
                      co2Gain: 8.0,
                      titleAr: 'ترقية تذكرة VIP ذهبية مجانية',
                      titleEn: 'Complimentary VIP Gold Pass',
                      descAr: 'موقف صف أول مع أولوية دخول وخدمة فاخرة.',
                      descEn: 'Front-bay priority parking & executive valet pass.',
                    },
                    {
                      id: 'plant-tree',
                      cost: 150,
                      co2Gain: 21.0,
                      titleAr: 'غرس شجرة باسمك (السعودية الخضراء)',
                      titleEn: 'Plant a Tree (Saudi Green Initiative)',
                      descAr: 'توثيق وفر +21 كجم CO2 سنوياً في سجل الكربون.',
                      descEn: 'Logs +21 kg annual CO2 offset in your ledger.',
                    },
                  ].map((reward) => {
                    const canAfford = stats.availablePoints >= reward.cost;
                    return (
                      <div
                        key={reward.id}
                        className="rounded-xl border border-white/10 bg-[#08121D] p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">
                            {lang === 'ar' ? reward.titleAr : reward.titleEn}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {lang === 'ar' ? reward.descAr : reward.descEn}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={async () => {
                            const nextRedeemed = redeemedPoints + reward.cost;
                            setRedeemedPoints(nextRedeemed);
                            localStorage.setItem('ecopark_redeemed_pts', String(nextRedeemed));

                            const txId = `tx-rwd-${Date.now()}`;
                            const tx: CarbonTransaction = {
                              id: txId,
                              date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                              descriptionAr: `استبدال ${reward.cost} نقطة: ${reward.titleAr}`,
                              descriptionEn: `Redeemed ${reward.cost} pts: ${reward.titleEn}`,
                              points: 0,
                              co2Kg: reward.co2Gain,
                              type: 'bonus',
                            };
                            setTransactions((prev) => [tx, ...prev]);

                            if (firebaseUser && firebaseUser.emailVerified) {
                              try {
                                await setDoc(doc(db, 'carbonTransactions', txId), {
                                  ...tx,
                                  userId: firebaseUser.uid,
                                  createdAtServer: serverTimestamp(),
                                });
                              } catch (err) {
                                handleFirestoreError(err, OperationType.CREATE, `carbonTransactions/${txId}`);
                              }
                            }

                            if (reward.id === 'vip-upgrade') {
                              await handleQuickVipBooking();
                            } else if (reward.id === 'ev-charge') {
                              const bay = spots.find((s) => s.status !== 'available') || spots[0];
                              if (bay) {
                                setChargingRobot((prev) => ({
                                  ...prev,
                                  phase: 'charging',
                                  targetSpotId: bay.id,
                                  targetPlate: bay.vehiclePlate || 'REWARD-EV',
                                  powerKw: 45,
                                }));
                              }
                            }

                            playReservationCompleteSound();
                            appendAudit(
                              `استبدال ${reward.cost} نقطة كربون للحصول على ${reward.titleAr}`,
                              `Redeemed ${reward.cost} Carbon Points for ${reward.titleEn}`
                            );
                            showToast(
                              t(
                                lang,
                                `تم استبدال ${reward.cost} نقطة وتفعيل: ${reward.titleAr}!`,
                                `Redeemed ${reward.cost} pts for ${reward.titleEn}!`
                              )
                            );
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition ${
                            canAfford
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                              : 'border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? t(lang, `استبدال مقابل ${reward.cost} نقطة`, `Redeem for ${reward.cost} pts`)
                            : t(lang, `تحتاج ${reward.cost} نقطة`, `Requires ${reward.cost} pts`)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Eco-Milestone Tier Progress Bar */}
              {(() => {
                const pts = stats.totalPoints;
                const nextTarget = pts < 100 ? 100 : pts < 300 ? 300 : pts < 600 ? 600 : 1000;
                const tierLabel =
                  pts < 100
                    ? t(lang, 'المستوى المبتدئ ← البرونزي', 'Starter → Bronze Eco Tier')
                    : pts < 300
                      ? t(lang, 'المستوى البرونزي ← الفضي', 'Bronze → Silver Eco Tier')
                      : pts < 600
                        ? t(lang, 'المستوى الفضي ← الذهبي', 'Silver → Gold Eco Tier')
                        : t(lang, 'المستوى الذهبي ← البلاتيني الأخضر', 'Gold → Green Platinum');
                const pct = Math.min(100, Math.round((pts / nextTarget) * 100));
                return (
                  <div className="rounded-xl border border-emerald-500/25 bg-[#0D1E2E] p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-white">{tierLabel}</span>
                      <span className="font-mono font-bold text-emerald-400 tabular-nums">
                        {pts} / {nextTarget} {t(lang, 'نقطة', 'pts')} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-300 transition-all duration-500 ${
                          flashFxEnabled ? 'eco-energy-shimmer' : ''
                        }`}
                        style={{ width: `${Math.max(pts > 0 ? 5 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Dynamic Eco-Tariff Table */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <h3 className="text-base font-bold text-white mb-4">
                  {t(lang, 'جدول التعرفة الديناميكية الخضراء', 'Dynamic Eco-Tariff Schedule')}
                </h3>
                <div className="divide-y divide-white/10">
                  {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => {
                    const sp = VEHICLE_SPECS[vt];
                    return (
                      <div key={vt} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <span className="font-bold" style={{ color: sp.badgeColor }}>
                          {lang === 'ar' ? sp.labelAr : sp.labelEn}
                        </span>
                        <span className="text-slate-200">
                          {sp.feeSar === 0
                            ? t(lang, '0 ر.س (مجاناً 100%)', '0 SAR (100% Free)')
                            : sp.carbonTaxSar > 0
                              ? t(lang, `${sp.feeSar} ريال + ${sp.carbonTaxSar} ضريبة كربون للتشجير`, `${sp.feeSar} SAR + ${sp.carbonTaxSar} Carbon Tax`)
                              : t(lang, `${sp.feeSar} ريال`, `${sp.feeSar} SAR`)}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          +{sp.pointsReward} {t(lang, 'نقطة', 'pts')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Annual Carbon Savings Calculator */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-6 space-y-5">
                <div className="flex items-center gap-2.5">
                  <Calculator className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    {t(lang, 'حاسبة وفر الكربون السنوية التفاعلية للسائقين', 'Interactive Annual Driver Carbon Calculator')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">{t(lang, 'نوع المركبة', 'Vehicle Type')}</label>
                    <select
                      value={calcVehicle}
                      onChange={(e) => setCalcVehicle(e.target.value as VehicleType)}
                      className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-sm text-white"
                    >
                      {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
                        <option key={vt} value={vt}>
                          {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      {t(lang, 'المسافة الموفرة يومياً (كم):', 'Daily Distance Saved (km):')} {calcDistanceKm}
                    </label>
                    <input
                      type="range"
                      min={0.2}
                      max={8}
                      step={0.2}
                      value={calcDistanceKm}
                      onChange={(e) => setCalcDistanceKm(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      {t(lang, 'وقت الانتظار الموفر (دقيقة):', 'Idle Time Saved (min):')} {calcIdleMin}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={calcIdleMin}
                      onChange={(e) => setCalcIdleMin(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      {t(lang, 'أيام الاستخدام أسبوعياً:', 'Days / Week:')} {calcDaysPerWeek}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={7}
                      step={1}
                      value={calcDaysPerWeek}
                      onChange={(e) => setCalcDaysPerWeek(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-white/10 pt-4">
                  <div>
                    <div className="text-xs text-slate-400">{t(lang, 'CO2 الموفر سنوياً', 'Annual CO2 Saved')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                      {annualCalcResult.annualCo2Kg} kg
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t(lang, 'الوقود الموفر', 'Fuel Saved')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-cyan-400 tabular-nums">
                      {annualCalcResult.annualFuelLiters} L
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t(lang, 'الوفر المالي السنوي', 'Annual Savings')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-amber-400 tabular-nums">
                      {annualCalcResult.annualMoneySar} SAR
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t(lang, 'مكافئ الأشجار سنوياً', 'Trees Equivalent / yr')}</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold text-emerald-300 tabular-nums">
                      <Trees className="h-5 w-5" />
                      {annualCalcResult.annualTrees}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ledger */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <h3 className="text-base font-bold text-white mb-3">
                  {t(lang, 'سجل الحركات الكربونية', 'Carbon Ledger History')}
                </h3>
                {transactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t(lang, 'لا توجد حركات كربونية مسجلة بعد.', 'No carbon transactions recorded yet.')}
                  </p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <div>
                          <div className="text-slate-100">
                            {lang === 'ar' ? tx.descriptionAr : tx.descriptionEn}
                          </div>
                          <div className="font-mono text-xs text-slate-500">{tx.date}</div>
                        </div>
                        <div className="flex items-center gap-4 font-mono text-xs">
                          <span className="text-cyan-400">{tx.co2Kg} kg CO2</span>
                          <span className="font-bold text-emerald-400">+{tx.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. 2D SIMULATOR */}
          {activeTab === 'sim2d' && (
            <Simulator2D
              lang={lang}
              spots={spots}
              onParkVehicle={handleParkVehicle}
              onAddSpot={handleAddParkingSpot}
              smokeAlert={smokeAlert}
              weather={weather2d}
              onChangeWeather={handleWeather2dChange}
              ecoConservation={ecoConservation}
              bessCharge={bessCharge}
              smartNightActive={smartNightActive}
              nightPowerReductionPct={projectSettings.nightPowerReductionPct}
              onAutoDispatchRobot={(spotId, plate, kwh) => {
                void recordRobotChargingSession(spotId, plate, kwh ?? 24.5);
                appendAudit(
                  `إرسال تلقائي لروبوت EcoCharge Bot X1 إلى ${spotId} لشحن ${plate}`,
                  `Auto-dispatched EcoCharge Bot X1 to ${spotId} for ${plate}`
                );
              }}
              onRushEvent={(msg) => showToast(msg)}
              activeMergedEvent={activeMergedEvent}
              activeMergedTour={activeMergedTour}
            />
          )}

          {/* 7. 3D SIMULATOR */}
          {activeTab === 'sim3d' && (
            <Simulator3D
              lang={lang}
              spots={spots}
              bessCharge={bessCharge}
              ecoConservation={ecoConservation}
              smartNightActive={smartNightActive}
              nightPowerReductionPct={projectSettings.nightPowerReductionPct}
              lightingMode={lighting3D}
              onChangeLightingMode={setLighting3D}
              onToggleSmartNight={() => {
                const nextActive = !smartNightActive;
                handleUpdateProjectSettings({
                  ...projectSettings,
                  smartNightModeEnabled: nextActive ? true : false,
                  smartNightForceActive: nextActive,
                });
                showToast(
                  nextActive
                    ? t(
                        lang,
                        `تم تفعيل الوضع الليلي المريح للعين في 3D (خفض الطاقة -${projectSettings.nightPowerReductionPct}%)`,
                        `3D Eye-Comfort Night Mode enabled (Power -${projectSettings.nightPowerReductionPct}%)`
                      )
                    : t(lang, 'تم إيقاف الوضع الليلي الذكي مؤقتاً', 'Smart Night Mode paused')
                );
              }}
              onParkVehicle={handleParkVehicle}
              onAddSpot={handleAddParkingSpot}
            />
          )}

          {/* LIVE GOOGLE MAPS PARKING STREAM */}
          {activeTab === 'livemap' && (
            <LiveParkingMap
              lang={lang}
              spots={spots}
              bessCharge={bessCharge}
              solarKw={solarKw}
              smokeAlert={smokeAlert}
              onToggleSpot={(spotId) => {
                setSpots((prev) =>
                  prev.map((s) =>
                    s.id === spotId
                      ? {
                          ...s,
                          status: s.status === 'available' ? 'occupied' : 'available',
                          vehicleType: s.status === 'available' ? 'ELECTRIC' : undefined,
                          vehiclePlate: undefined,
                        }
                      : s
                  )
                );
              }}
              onParkVehicle={handleParkVehicle}
              onAddSpot={handleAddParkingSpot}
              onReserveBay={(spotId) => {
                setBookSpotId(spotId);
                setActiveTab('reservations');
              }}
              onTriggerLowBessTest={() => triggerLowBessAlert(16)}
            />
          )}

          {/* 8. ESG REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {t(lang, 'تقرير الاستدامة ESG Scope 3 ومبادرة السعودية الخضراء', 'ESG Scope 3 & Saudi Green Initiative Report')}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {t(lang, 'تصدير بيانات خفض الانبعاثات وحساب مكافئ الأشجار المعتمدة', 'Export verified carbon reduction metrics & tree equivalence')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const csv = [
                        'Date,Description,CO2_Saved_kg,Points',
                        ...transactions.map(
                          (tx) => `"${tx.date}","${tx.descriptionEn}",${tx.co2Kg},${tx.points}`
                        ),
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'ecopark-esg-scope3-report.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <Download className="h-4 w-4" />
                    {t(lang, 'تصدير تقرير ESG CSV', 'Export ESG CSV Report')}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-white/10 pt-4">
                  <div className="rounded-xl bg-[#08121D] p-4">
                    <div className="text-xs text-slate-400">{t(lang, 'إجمالي CO2 الموفر', 'Cumulative CO2 Avoided')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">{stats.totalCo2Kg} kg</div>
                  </div>
                  <div className="rounded-xl bg-[#08121D] p-4">
                    <div className="text-xs text-slate-400">{t(lang, 'مكافئ امتصاص الأشجار اليومي', 'Daily Tree Absorption Eq.')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-cyan-400">
                      {(stats.totalCo2Kg / 0.06).toFixed(1)} {t(lang, 'شجرة/يوم', 'trees/day')}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#08121D] p-4">
                    <div className="text-xs text-slate-400">{t(lang, 'امتثال معيار Scope 3', 'ESG Scope 3 Compliance')}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">ISO-14064 Ready</div>
                  </div>
                </div>
              </div>

              <AnnualSustainabilityReport
                lang={lang}
                spots={spots}
                reservations={reservations}
                transactions={transactions}
                v2gSessions={v2gSessions}
                solarKw={solarKw}
                bessCharge={bessCharge}
                ecoConservation={ecoConservation}
                smartNightActive={smartNightActive}
                projectSettings={projectSettings}
                onNotify={(msgAr, msgEn) => showToast(t(lang, msgAr, msgEn))}
              />

              <WordThesisExporterPanel
                lang={lang}
                totalSpots={spots.length}
                reservationsCount={reservations.length}
                totalCo2Kg={stats.totalCo2Kg}
                bessCharge={bessCharge}
                solarKw={solarKw}
                activeMergedTour={activeMergedTour}
                activeMergedEvent={activeMergedEvent}
                onNotify={showToast}
              />
            </div>
          )}

          {/* 9. GLOBAL SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
                <p className="text-xs text-slate-400">
                  {t(
                    lang,
                    'ابحث في الحجوزات والمركبات واللوحات والتقارير والمستخدمين',
                    'Search across reservations, vehicles, plates, tickets, reports, and users'
                  )}
                </p>
                <div className="relative">
                  <Search className="absolute top-3 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t(
                      lang,
                      'اكتب رقم اللوحة أو رمز التذكرة...',
                      'Type plate number or ticket code...'
                    )}
                    className="w-full rounded-xl border border-white/10 bg-[#08121D] py-2.5 ps-10 pe-4 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all', ar: 'الكل', en: 'All' },
                      { id: 'vehicles', ar: 'المركبات', en: 'Vehicles' },
                      { id: 'reservations', ar: 'الحجوزات', en: 'Reservations' },
                      { id: 'tickets', ar: 'التذاكر', en: 'Tickets' },
                      { id: 'reports', ar: 'التقارير', en: 'Reports' },
                      { id: 'users', ar: 'المستخدمون', en: 'Users' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSearchCategory(cat.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        searchCategory === cat.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-white/10 bg-[#08121D] text-slate-300'
                      }`}
                    >
                      {lang === 'ar' ? cat.ar : cat.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 divide-y divide-white/10">
                {(searchCategory === 'all' || searchCategory === 'tickets') &&
                  reservations
                    .filter(
                      (r) =>
                        !searchQuery ||
                        r.ticketCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        r.plateNumber.includes(searchQuery)
                    )
                    .map((r) => (
                      <div key={`t-${r.id}`} className="flex items-center justify-between py-3 text-sm">
                        <button
                          onClick={() => setActiveTicket(r)}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          {r.ticketCode} – {t(lang, 'تذكرة خضراء', 'Green Pass')} ({r.plateNumber})
                        </button>
                        <span className="text-xs text-slate-400">{t(lang, 'تذاكر', 'Tickets')}</span>
                      </div>
                    ))}

                {(searchCategory === 'all' || searchCategory === 'vehicles') &&
                  spots
                    .filter(
                      (s) =>
                        s.vehiclePlate &&
                        (!searchQuery || s.vehiclePlate.includes(searchQuery) || s.label.includes(searchQuery))
                    )
                    .map((s) => (
                      <div key={`v-${s.id}`} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-white">
                          {s.vehiclePlate} – {s.vehicleType} ({s.label})
                        </span>
                        <span className="text-xs text-slate-400">{t(lang, 'مركبات', 'Vehicles')}</span>
                      </div>
                    ))}

                {(searchCategory === 'all' || searchCategory === 'users') &&
                  users
                    .filter(
                      (u) =>
                        !searchQuery ||
                        u.name.includes(searchQuery) ||
                        u.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((u) => (
                      <div key={`u-${u.id}`} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-white">
                          {u.name} · <span className="font-mono text-xs text-cyan-400">{u.role}</span>
                        </span>
                        <span className="text-xs text-slate-400">{t(lang, 'المستخدمون', 'Users')}</span>
                      </div>
                    ))}

                {reservations.length === 0 && users.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t(lang, 'لا توجد سجلات مطابقة حالياً.', 'No matching records found yet.')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 10. USERS & 9 RBAC ROLES */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {t(lang, 'إدارة المستخدمين والأدوار (9 أدوار RBAC)', 'Users & 9 RBAC Roles')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t(
                      lang,
                      `الأدمن الحصري: ${ADMIN_EMAIL} · يُقبل السائق والضيف تلقائياً، وتخضع باقي الأدوار للقبول أو الرفض.`,
                      `Exclusive Admin: ${ADMIN_EMAIL} · Driver & Guest auto-activate; other roles require Approve/Reject.`
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {currentUser.email.toLowerCase() === ADMIN_EMAIL && (
                    <button
                      type="button"
                      onClick={() => setAddUserModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                    >
                      <UserPlus className="h-4 w-4" />
                      {t(lang, 'إضافة مستخدم ودور', 'Add User & Role')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setClearModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/25"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t(lang, 'تفريغ بيانات النظام (Firestore)', 'Clear System Data')}
                  </button>
                </div>
              </div>

              {/* 9 RBAC Roles Reference Strip */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {ALL_ROLES.map((r) => {
                  const isAdminOnly = r === 'Super Admin';
                  const autoApproved = isRoleAutoApproved(r);
                  return (
                    <div
                      key={r}
                      className="rounded-xl border border-white/10 bg-[#0D1E2E] p-3 text-xs"
                    >
                      <div className="font-bold text-white">
                        {lang === 'ar' ? ROLE_LABELS_AR[r] : r}
                      </div>
                      <div
                        className={`mt-1 text-[11px] font-medium ${
                          isAdminOnly
                            ? 'text-amber-400'
                            : autoApproved
                              ? 'text-emerald-400'
                              : 'text-cyan-400'
                        }`}
                      >
                        {isAdminOnly
                          ? t(lang, 'حصري لحساب الأدمن فقط', 'Exclusive Admin Account')
                          : autoApproved
                            ? t(lang, 'تفعيل تلقائي مباشر', 'Auto-Approved (No Review)')
                            : t(lang, 'يتطلب قبول / رفض الأدمن', 'Requires Admin Approval')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 overflow-x-auto">
                {users.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    {t(lang, 'لا توجد حسابات مستخدمين محملة بعد.', 'No user records loaded yet.')}
                  </p>
                ) : (
                  <table className="w-full text-start text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-slate-400">
                        <th className="pb-3 text-start">{t(lang, 'الاسم', 'Name')}</th>
                        <th className="pb-3 text-start">{t(lang, 'البريد', 'Email')}</th>
                        <th className="pb-3 text-start">{t(lang, 'الدور', 'Role')}</th>
                        <th className="pb-3 text-start">{t(lang, 'الحالة', 'Status')}</th>
                        <th className="pb-3 text-start">{t(lang, 'إجراءات الأدمن والاعتماد', 'Approval & Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => {
                        const isTargetAdmin = u.email.toLowerCase() === ADMIN_EMAIL;
                        const isAutoRole = isRoleAutoApproved(u.role);
                        const isViewerAdmin = currentUser.email.toLowerCase() === ADMIN_EMAIL;
                        const needsReview = !isTargetAdmin && !isAutoRole;

                        return (
                          <tr key={u.id} className="hover:bg-white/5">
                            <td className="py-3 font-semibold text-white">{u.name}</td>
                            <td className="py-3 font-mono text-xs text-slate-300">{u.email}</td>
                            <td className="py-3 text-xs text-cyan-300">
                              {lang === 'ar' ? ROLE_LABELS_AR[u.role] : u.role}
                            </td>
                            <td className="py-3 text-xs font-semibold">
                              <span
                                className={
                                  u.status === 'active'
                                    ? 'text-emerald-400'
                                    : u.status === 'rejected'
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                                }
                              >
                                {u.status === 'active'
                                  ? t(lang, 'مفعّل', 'Active')
                                  : u.status === 'rejected'
                                    ? t(lang, 'مرفوض', 'Rejected')
                                    : t(lang, 'قيد المراجعة', 'Pending Approval')}
                              </span>
                            </td>
                            <td className="py-3">
                              {isTargetAdmin ? (
                                <span className="text-xs font-semibold text-amber-400">
                                  {t(lang, 'حساب الأدمن الأعلى فقط', 'Exclusive Super Admin')}
                                </span>
                              ) : isViewerAdmin ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {needsReview ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!firebaseUser || !firebaseUser.emailVerified) return;
                                          const targetPath = `users/${u.id}`;
                                          try {
                                            await setDoc(
                                              doc(db, 'users', u.id),
                                              { status: 'active', updatedAt: serverTimestamp() },
                                              { merge: true }
                                            );
                                            appendAudit(
                                              `قبول وتفعيل حساب ${u.name} (${u.role})`,
                                              `Approved account ${u.name} (${u.role})`
                                            );
                                            showToast(
                                              t(lang, `تم قبول ${u.name}`, `Approved ${u.name}`)
                                            );
                                          } catch (err) {
                                            handleFirestoreError(err, OperationType.UPDATE, targetPath);
                                          }
                                        }}
                                        className="flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        {t(lang, 'قبول', 'Approve')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!firebaseUser || !firebaseUser.emailVerified) return;
                                          const targetPath = `users/${u.id}`;
                                          try {
                                            await setDoc(
                                              doc(db, 'users', u.id),
                                              { status: 'rejected', updatedAt: serverTimestamp() },
                                              { merge: true }
                                            );
                                            appendAudit(
                                              `رفض طلب دور ${u.name} (${u.role})`,
                                              `Rejected role request for ${u.name} (${u.role})`
                                            );
                                            showToast(
                                              t(lang, `تم رفض ${u.name}`, `Rejected ${u.name}`)
                                            );
                                          } catch (err) {
                                            handleFirestoreError(err, OperationType.UPDATE, targetPath);
                                          }
                                        }}
                                        className="flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-400/40 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        {t(lang, 'رفض', 'Reject')}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[11px] text-emerald-400 me-1">
                                      {t(lang, 'قبول تلقائي (سائق/ضيف)', 'Auto-Approved')}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingUser(u)}
                                    className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-400/50"
                                  >
                                    {t(lang, 'تعديل الدور', 'Edit Role')}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Audit Log */}
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                <h3 className="text-sm font-bold text-white mb-3">
                  {t(lang, 'سجل التدقيق الأمني (Audit Log)', 'System Audit Log')}
                </h3>
                {auditLogs.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {t(lang, 'لم تُسجّل أحداث تدقيق بعد.', 'No audit events recorded yet.')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#08121D] px-3.5 py-2 text-xs"
                      >
                        <span className="text-slate-200">
                          {lang === 'ar' ? log.actionAr : log.actionEn}
                        </span>
                        <span className="font-mono text-slate-500">
                          {log.actor} ({log.role}) · {log.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add User Modal (Admin only) */}
              {addUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!firebaseUser || !firebaseUser.emailVerified) return;
                      if (!newUserName.trim() || !newUserEmail.trim()) return;
                      setNewUserSaving(true);
                      const cleanEmail = newUserEmail.trim().toLowerCase();
                      const assignedRole: UserRole =
                        cleanEmail === ADMIN_EMAIL
                          ? 'Super Admin'
                          : newUserRole === 'Super Admin'
                            ? 'Operator'
                            : newUserRole;
                      const initialStatus: 'active' | 'pending' =
                        cleanEmail === ADMIN_EMAIL || isRoleAutoApproved(assignedRole)
                          ? 'active'
                          : 'pending';
                      const newDocId = `usr_${Date.now()}`;
                      const targetPath = `users/${newDocId}`;
                      try {
                        await setDoc(doc(db, 'users', newDocId), {
                          uid: newDocId,
                          name: newUserName.trim(),
                          email: cleanEmail,
                          role: assignedRole,
                          status: initialStatus,
                          preferredLang: lang,
                          updatedAt: serverTimestamp(),
                        });
                        appendAudit(
                          `إضافة مستخدم جديد: ${newUserName.trim()} (${assignedRole})`,
                          `Added user: ${newUserName.trim()} (${assignedRole})`
                        );
                        setNewUserName('');
                        setNewUserEmail('');
                        setNewUserRole('Operator');
                        setAddUserModalOpen(false);
                        showToast(
                          t(lang, 'تمت إضافة المستخدم وحفظ الدور في Firestore.', 'User & role saved to Firestore.')
                        );
                      } catch (err) {
                        handleFirestoreError(err, OperationType.CREATE, targetPath);
                      } finally {
                        setNewUserSaving(false);
                      }
                    }}
                    className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0D1E2E] p-6 space-y-4"
                  >
                    <h3 className="text-base font-bold text-white">
                      {t(lang, 'إضافة مستخدم جديد وتعيين الدور (RBAC)', 'Add New User & Assign RBAC Role')}
                    </h3>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">
                        {t(lang, 'الاسم الكامل', 'Full Name')}
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder={t(lang, 'مثال: أحمد محمد', 'e.g. Ahmed Mohamed')}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">
                        {t(lang, 'البريد الإلكتروني', 'Email Address')}
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">
                        {t(lang, 'الدور في المنظومة (RBAC)', 'RBAC Role')}
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        {ALL_ROLES.filter((r) => r !== 'Super Admin').map((r) => (
                          <option key={r} value={r}>
                            {lang === 'ar' ? ROLE_LABELS_AR[r] : r}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {isRoleAutoApproved(newUserRole)
                          ? t(lang, 'يُفعّل تلقائياً فور الإضافة.', 'Auto-activated immediately.')
                          : t(lang, 'يُضاف بحالة قيد المراجعة ويمكنك قبوله أو رفضه فوراً.', 'Added as Pending; you can Approve or Reject.')}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setAddUserModalOpen(false)}
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300"
                      >
                        {t(lang, 'إلغاء', 'Cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={newUserSaving}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-60"
                      >
                        {newUserSaving ? t(lang, 'جاري الحفظ...', 'Saving...') : t(lang, 'إضافة المستخدم', 'Add User')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit User Role Modal */}
              {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                  <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0D1E2E] p-6 space-y-4">
                    <h3 className="text-base font-bold text-white">
                      {t(lang, 'تعديل صلاحيات:', 'Edit Role:')} {editingUser.name}
                    </h3>
                    <select
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white"
                    >
                      {ALL_ROLES.filter(
                        (r) => r !== 'Super Admin' || editingUser.email.toLowerCase() === ADMIN_EMAIL
                      ).map((r) => (
                        <option key={r} value={r}>
                          {lang === 'ar' ? ROLE_LABELS_AR[r] : r}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(null)}
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300"
                      >
                        {t(lang, 'إلغاء', 'Cancel')}
                      </button>
                      <button
                        onClick={async () => {
                          if (!firebaseUser || !firebaseUser.emailVerified) return;
                          const targetPath = `users/${editingUser.id}`;
                          const nextRole: UserRole =
                            editingUser.email.toLowerCase() === ADMIN_EMAIL
                              ? 'Super Admin'
                              : editingUser.role === 'Super Admin'
                                ? 'Driver'
                                : editingUser.role;
                          const nextStatus: 'active' | 'pending' = isRoleAutoApproved(nextRole)
                            ? 'active'
                            : editingUser.status === 'rejected'
                              ? 'pending'
                              : editingUser.status;
                          try {
                            await setDoc(
                              doc(db, 'users', editingUser.id),
                              {
                                role: nextRole,
                                status: nextStatus,
                                updatedAt: serverTimestamp(),
                              },
                              { merge: true }
                            );
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, targetPath);
                          }
                          appendAudit(
                            `تحديث دور ${editingUser.name} إلى ${nextRole}`,
                            `Updated ${editingUser.name} role to ${nextRole}`
                          );
                          setEditingUser(null);
                        }}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
                      >
                        {t(lang, 'تحديث', 'Update')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 11. HELP & ARCHITECTURE EXPLANATION */}
          {activeTab === 'help' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <h3 className="text-sm font-bold text-emerald-400">
                    {t(lang, 'البدء السريع', 'Quick Start')}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {t(
                      lang,
                      'سجّل الدخول بالبريد الإلكتروني أو بحساب Google، احجز موقفاً أو امسح لوحة السيارة عبر كاميرا ANPR، واحصل فوراً على تذكرتك الخضراء QR.',
                      'Sign in via Email/Password or Google, reserve a bay or scan a plate via ANPR, and receive your Smart Green QR Pass.'
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <h3 className="text-sm font-bold text-cyan-400">
                    {t(lang, 'التذكرة الخضراء والنقاط', 'Green Ticket & Points')}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {t(
                      lang,
                      'تحصل المركبات الكهربائية على إعفاء 100% و+30 نقطة، والهجينة خصم 50% (5 ر.س) و+18 نقطة، بينما تسهم ضريبة الديزل في التشجير الوطني.',
                      'EVs enjoy 0 SAR & +30 pts, Hybrids 5 SAR & +18 pts, while Diesel carbon tax funds national afforestation.'
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5">
                  <h3 className="text-sm font-bold text-amber-400">
                    {t(lang, 'الطاقة و BESS (<20%)', 'Energy & BESS (<20%)')}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {t(
                      lang,
                      'عند انخفاض شحن بطاريات BESS عن 20% يطلق النظام إنذاراً مرئياً وصوتياً، ويوقف تفريغ V2G لحماية الشبكة عند تفعيل وضع Eco-Conservation.',
                      'When BESS drops below 20%, visual & siren alerts fire and Eco-Conservation mode suspends V2G discharge.'
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
                <h3 className="text-base font-bold text-white">
                  {t(lang, 'شرح: كيف يُحسب CO2 الموفر؟', 'How is CO2 Saved Calculated?')}
                </h3>
                <div
                  dir="ltr"
                  className="rounded-xl border border-white/10 bg-[#08121D] p-4 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto"
                >
                  CO2_Saved(kg) = [(Distance_Saved_km × Emission_Factor_Drive_g_km) + (Time_Saved_min × Emission_Factor_Idle_g_min)] / 1000
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {t(
                    lang,
                    'نضرب المسافة الموفرة بالكيلومتر في معامل انبعاث القيادة (بنزين: 192، ديزل: 171، هجين: 92، كهرباء: 0 جم/كم)، ونضيف الوقت الموفر مضروباً في معامل الانبعاث أثناء الوقوف الخامل، ثم نقسم على 1000 لنحصل على الكيلوجرام.',
                    'We multiply distance saved by the driving emission factor and add idle time saved multiplied by idle emission factor, then divide by 1000 to yield kilograms of CO2 avoided.'
                  )}
                </p>
                <button
                  onClick={() => setCopilotOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  {t(lang, 'اسأل المساعد الذكي Gemini Copilot', 'Ask Gemini Copilot')}
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Leaf className="h-4 w-4" />
                  <span>
                    {t(
                      lang,
                      'عن المنظومة · مشروع رقم 108 · فريق Team 19 – تيم 19',
                      'About Platform · Project #108 · Team 19'
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t(
                    lang,
                    'تم تطوير منصة إيكو-بارك AI v5.0 Master Edition في المعهد العالي للإدارة وتكنولوجيا المعلومات بكفر الشيخ لتكون نموذجاً عملياً للمدن الذكية المتوافقة مع معايير ESG Scope 3 ومبادرة السعودية الخضراء.',
                    'Built at the Higher Institute of Management and Information Technology in Kafr El-Sheikh as a full-stack smart city model aligned with ESG Scope 3 & Saudi Green Initiative.'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 12. LANGUAGE SWITCHER */}
          {activeTab === 'language' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
                <h2 className="text-base font-bold text-white">
                  {t(lang, 'لغة الواجهة واتجاه العرض', 'Interface Language & Direction')}
                </h2>
                <button
                  onClick={() => setLang('ar')}
                  className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold transition ${
                    lang === 'ar'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'border border-white/10 bg-[#08121D] text-slate-200 hover:border-emerald-400/40'
                  }`}
                >
                  العربية (RTL) – افتراضي
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold transition ${
                    lang === 'en'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'border border-white/10 bg-[#08121D] text-slate-200 hover:border-emerald-400/40'
                  }`}
                >
                  English (LTR)
                </button>
                <p className="text-xs text-slate-400">
                  {t(
                    lang,
                    'الاتجاه يتغير تلقائياً مع اللغة، وتُحفظ تفضيلاتك محلياً وفي حسابك.',
                    'Layout direction updates automatically between RTL and LTR and persists to your profile.'
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
                <div className="text-xs text-slate-400">
                  {lang === 'ar' ? 'English Preview' : 'معاينة الواجهة'}
                </div>
                <div className="text-lg font-bold text-emerald-400">Eco-Park AI</div>
                <div className="divide-y divide-white/10 text-sm">
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-300">Occupancy</span>
                    <span className="font-mono text-white tabular-nums">{stats.occupancyPct}%</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-300">CO2 saved</span>
                    <span className="font-mono text-cyan-400 tabular-nums">{stats.totalCo2Kg} kg</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-300">BESS charge</span>
                    <span className={`font-mono tabular-nums ${bessCritical ? 'text-red-400' : 'text-emerald-400'}`}>
                      {bessCharge}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('reservations')}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
                >
                  Confirm booking
                </button>
              </div>
            </div>
          )}

          {/* 13. MAINTENANCE & SENSOR HEALTH */}
          {activeTab === 'maintenance' && (
            <MaintenanceHealthPanel
              lang={lang}
              spots={spots}
              bessCharge={bessCharge}
              solarKw={solarKw}
              smokeAlert={smokeAlert}
              autoLoadBalance={projectSettings.autoLoadBalance}
              thermalGuardLimitC={projectSettings.thermalGuardLimitC}
              supervisorName={currentUser?.name || projectSettings.supervisorName}
              chargerRatings={chargerRatings}
              onSaveChargerRating={handleSaveChargerRating}
              robotChargingLogs={robotChargingLogs}
              onVerifyRobotSession={(logId) => {
                void handleVerifyRobotSession(logId);
                appendAudit(
                  `اعتماد المشرف لجلسة شحن الروبوت ${logId}`,
                  `Supervisor verified robot charging session ${logId}`
                );
                showToast(
                  t(lang, `تم اعتماد جلسة الشحن ${logId}.`, `Charging session ${logId} verified.`)
                );
              }}
              onSimulateBotSession={(bayId) => {
                const sampleKwh = Number((22 + Math.random() * 14).toFixed(1));
                const samplePlate = `EV ${Math.floor(1100 + Math.random() * 8800)}`;
                void recordRobotChargingSession(bayId, samplePlate, sampleKwh);
                appendAudit(
                  `تسجيل جلسة شحن روبوتي ${sampleKwh} kWh للموقف ${bayId}`,
                  `Logged EcoCharge Bot session ${sampleKwh} kWh at bay ${bayId}`
                );
                showToast(
                  t(
                    lang,
                    `تم تسجيل جلسة EcoCharge Bot X1 (${sampleKwh} kWh) في الموقف ${bayId}.`,
                    `Logged EcoCharge Bot X1 session (${sampleKwh} kWh) at bay ${bayId}.`
                  )
                );
              }}
              onToggleLoadBalance={() =>
                handleUpdateProjectSettings({
                  ...projectSettings,
                  autoLoadBalance: !projectSettings.autoLoadBalance,
                })
              }
              onLogMaintenanceAudit={appendAudit}
              onCreateWorkOrder={(order) => {
                setWorkOrders((prev) => [order, ...prev]);
                appendAudit(
                  `إنشاء أمر صيانة تنبؤية تلقائي ${order.id} للموقف ${order.bayId}`,
                  `Auto-created predictive maintenance work order ${order.id} for ${order.bayId}`
                );
              }}
              onDispatchSupervisorAlert={(bayLabel, healthPct, reasonAr, reasonEn) => {
                const title = t(
                  lang,
                  `⚠️ تنبيه صيانة تنبؤية للمشرفين: شاحن ${bayLabel} (${healthPct}%)`,
                  `⚠️ Predictive Maintenance Alert: Charger ${bayLabel} (${healthPct}%)`
                );
                const body = lang === 'ar' ? reasonAr : reasonEn;
                dispatchBrowserPushNotification(title, body, `ecopark-pred-${bayLabel}`);
                appendAudit(
                  `إرسال إشعار صيانة تنبؤية للمشرفين حول ${bayLabel}: ${reasonAr}`,
                  `Dispatched predictive maintenance alert for ${bayLabel}: ${reasonEn}`
                );
                showToast(`${title} — ${body}`);
              }}
              onNotify={showToast}
            />
          )}

          {/* 14. ALERTS, AUDIO & PER-BAY ENERGY DASHBOARD */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              <BayPowerTelemetryChart
                lang={lang}
                spots={spots}
                solarKw={solarKw}
                ecoConservation={ecoConservation}
                chargingRobot={chargingRobot}
                autoLoadBalance={projectSettings.autoLoadBalance}
                smartNightActive={smartNightActive}
                nightPowerReductionPct={projectSettings.nightPowerReductionPct}
              />
              <AudioSettingsPanel
                lang={lang}
                prefs={audioPrefs}
                onUpdatePrefs={handleUpdateAudioPrefs}
                onNotify={showToast}
              />
            </div>
          )}

          {/* 15. AUTONOMOUS CHARGING & EVACUATION ROBOTS */}
          {activeTab === 'robots' && (
            <AutonomousRobotsPanel
              lang={lang}
              spots={spots}
              bessCharge={bessCharge}
              smokeAlert={smokeAlert}
              flashFxEnabled={flashFxEnabled}
              chargingRobot={chargingRobot}
              evacRobot={evacRobot}
              onUpdateChargingRobot={setChargingRobot}
              onUpdateEvacRobot={setEvacRobot}
              onLogRobotCharge={async (spotId, plate, kwh) => {
                const txId = `tx-bot-${Date.now()}`;
                const co2Gain = Number((kwh * 0.42).toFixed(2));
                const tx: CarbonTransaction = {
                  id: txId,
                  date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                  descriptionAr: `شحن روبوتي متنقل ${kwh} kWh للمركبة ${plate} (${spotId})`,
                  descriptionEn: `Mobile Robot Charge ${kwh} kWh for ${plate} (${spotId})`,
                  points: 25,
                  co2Kg: co2Gain,
                  type: 'v2g',
                };
                setTransactions((prev) => [tx, ...prev]);
                if (firebaseUser && firebaseUser.emailVerified) {
                  try {
                    await setDoc(doc(db, 'carbonTransactions', txId), {
                      ...tx,
                      userId: firebaseUser.uid,
                      createdAtServer: serverTimestamp(),
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, `carbonTransactions/${txId}`);
                  }
                }
                appendAudit(
                  `اكتمال شحن روبوت EcoCharge X1 بمقدار ${kwh} kWh في ${spotId}`,
                  `EcoCharge X1 completed ${kwh} kWh session at ${spotId}`
                );
                await recordRobotChargingSession(spotId, plate, kwh);
              }}
              onClearSmokeAlert={() => {
                if (smokeAlert) handleToggleSmokeAlert();
              }}
              onLogAudit={appendAudit}
              onNotify={showToast}
            />
          )}

          {/* 16. DYNAMIC PRICING & SMART BILLING */}
          {activeTab === 'billing' && (
            <SmartBillingPanel
              lang={lang}
              spots={spots}
              reservations={reservations}
              bessCharge={bessCharge}
              solarKw={solarKw}
              onDispatchPeakShave={(dropPct, kwhShaved, sarSaved) => {
                const nextBess = Math.max(15, bessCharge - dropPct);
                triggerLowBessAlert(nextBess);
                appendAudit(
                  `تقليص أحمال الذروة عبر BESS: إزاحة ${kwhShaved} kWh وتوفير ${sarSaved} ر.س`,
                  `BESS Peak-Shaving Dispatched: Shaved ${kwhShaved} kWh, saved ${sarSaved} SAR`
                );
                showToast(
                  t(
                    lang,
                    `تم تفريغ ${kwhShaved} kWh من BESS لتقليص ذروة الشبكة وتوفير ${sarSaved} ر.س!`,
                    `Dispatched ${kwhShaved} kWh from BESS for peak-shaving, saving ${sarSaved} SAR!`
                  )
                );
              }}
              onNotify={showToast}
            />
          )}

          {/* 17. WEATHER, SOLAR FORECAST, PROJECT 107 EVENTS & MULTI-BRANCH ESG */}
          {activeTab === 'forecast' && (
            <div className="space-y-6">
              <ForecastBranchPanel
                lang={lang}
                spots={spots}
                solarKw={solarKw}
                bessCharge={bessCharge}
                totalCo2Kg={stats.totalCo2Kg}
                onActivateEcoConservation={handleActivateEcoConservation}
                onNotify={showToast}
              />

              <div className="rounded-xl border border-cyan-500/30 bg-[#0A1724] p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t(
                      lang,
                      'منظومة إدارة الفعاليات والتنبؤ بالحضور وترشيد الموارد المدمجة (مشروع 107)',
                      'Integrated Event Attendance Forecast & Zero-Waste Resource Rationing (Project 107)'
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      lang,
                      'يربط جدول الفعاليات مباشرةً بحالة BESS (مع تنبيه تلقائي عند تعارض وقت الفعالية ونقص الطاقة) وتوسيع مواقف 2D/3D.',
                      'Connects event schedules directly with live BESS reserve (raising conflict alerts & Eco-Conservation prompts) and 2D/3D capacity.'
                    )}
                  </p>
                </div>
                <MergedPlatformsHub
                  lang={lang}
                  spots={spots}
                  bessCharge={bessCharge}
                  solarKw={solarKw}
                  ecoConservation={ecoConservation}
                  defaultDriverName={currentUser.name}
                  embeddedMode="p107"
                  activeTour={activeMergedTour}
                  activeEvent={activeMergedEvent}
                  onSyncTour={setActiveMergedTour}
                  onSyncEvent={setActiveMergedEvent}
                  onExecuteTriProjectSynergy={handleExecuteTriProjectSynergy}
                  onNavigateTab={setActiveTab}
                  onBookCombinedReservation={async (opts) => {
                    const candidate =
                      spotsRef.current.find(
                        (s) => s.status === 'available' && (opts.vehicleType === 'ELECTRIC' ? s.hasCharger : true)
                      ) || spotsRef.current.find((s) => s.status === 'available');
                    const spotId = candidate?.id || spotsRef.current[0]?.id || 'A-01';
                    const nowIso = new Date().toISOString().slice(0, 16);
                    const exitIso = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
                    await createReservationInternal({
                      branch: opts.branch,
                      spotId,
                      driverName: opts.driverName,
                      plateNumber: opts.plateNumber,
                      vehicleType: opts.vehicleType,
                      entryTime: nowIso,
                      exitTime: exitIso,
                      isVip: opts.isVip,
                      summonRobot: opts.summonRobot,
                    });
                    void appendAudit(opts.sourceLabelAr, opts.sourceLabelEn);
                  }}
                  onPrepareEventCapacity={(eventTitle, targetBaysNeeded, enableEco) => {
                    let added = 0;
                    const cappedTarget = Math.min(24, targetBaysNeeded);
                    while (spotsRef.current.length < cappedTarget) {
                      handleAddParkingSpot();
                      added += 1;
                    }
                    if (enableEco && !ecoConservation) {
                      setEcoConservation(true);
                    }
                    void appendAudit(
                      `تجهيز موارد فعالية (مشروع 107): ${eventTitle} · إضافة ${added} مواقف وتفعيل الترشيد`,
                      `Prepared Project 107 Event (${eventTitle}): +${added} bays & rationing active`
                    );
                    return added;
                  }}
                  onNotify={showToast}
                />
              </div>
            </div>
          )}

          {/* 18. FLEETS, WORK ORDERS & EMERGENCY DRILLS */}
          {activeTab === 'operations' && (
            <OperationsHubPanel
              lang={lang}
              spots={spots}
              bessCharge={bessCharge}
              solarKw={solarKw}
              smokeAlert={smokeAlert}
              currentUserName={currentUser?.name || projectSettings.supervisorName}
              currentUserRole={currentUser?.role || 'Operator'}
              fleetPermits={fleetPermits}
              workOrders={workOrders}
              drillHistory={drillHistory}
              reservations={reservations}
              anprScanLogs={anprScanLogs}
              robotChargingLogs={robotChargingLogs}
              shiftHandovers={shiftHandovers}
              adminWastePolicy={adminWastePolicy}
              onUpdateAdminWastePolicy={handleUpdateAdminWastePolicy}
              activeMergedTour={activeMergedTour}
              activeMergedEvent={activeMergedEvent}
              onSignShiftHandover={async (rec) => {
                setShiftHandovers((prev) => {
                  const next = [rec, ...prev];
                  try {
                    localStorage.setItem('ecopark_shift_handovers', JSON.stringify(next));
                  } catch {
                    // ignore quota errors
                  }
                  return next;
                });
                appendAudit(
                  `توقيع محضر تسليم الوردية إلى ${rec.incomingSupervisor} (${rec.incomingRole})`,
                  `Signed shift handover to ${rec.incomingSupervisor} (${rec.incomingRole})`
                );
                showToast(
                  t(
                    lang,
                    `تم توثيق محضر تسليم الوردية (${rec.id}) إلى ${rec.incomingSupervisor}.`,
                    `Signed and logged shift handover (${rec.id}) to ${rec.incomingSupervisor}.`
                  )
                );
                if (firebaseUser && firebaseUser.emailVerified) {
                  try {
                    await setDoc(doc(db, 'shiftHandovers', rec.id), {
                      ...rec,
                      userId: firebaseUser.uid,
                      createdAtServer: serverTimestamp(),
                    });
                  } catch (err) {
                    console.warn('ShiftHandover Firestore save:', err);
                  }
                }
              }}
              onAddFleetPermit={(permit) => {
                setFleetPermits((prev) => [permit, ...prev]);
                appendAudit(
                  `تسجيل تصريح أسطول/VIP تلقائي للوحة ${permit.plateNumber}`,
                  `Registered ANPR auto-gate permit for ${permit.plateNumber}`
                );
                showToast(
                  t(lang, `تمت إضافة تصريح ${permit.plateNumber} للقائمة البيضاء.`, `Added ${permit.plateNumber} to ANPR whitelist.`)
                );
              }}
              onToggleFleetPermit={(id) =>
                setFleetPermits((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
                )
              }
              onSimulatePermitGateEntry={(permit) => {
                const avail = spots.find((s) => s.status === 'available') || handleAddParkingSpot();
                handleParkVehicle(avail.id, permit.vehicleType, permit.plateNumber);
                appendAudit(
                  `عبور تلقائي ANPR للتصريح ${permit.plateNumber} نحو الموقف ${avail.label}`,
                  `ANPR auto-gate entry for permit ${permit.plateNumber} to ${avail.label}`
                );
                showToast(
                  t(
                    lang,
                    `فُتحت البوابة آلياً للتصريح ${permit.plateNumber} وتم توجيهها للموقف ${avail.label}!`,
                    `Auto-gate opened for ${permit.plateNumber} → bay ${avail.label}!`
                  )
                );
              }}
              onAddWorkOrder={(order) => {
                setWorkOrders((prev) => [order, ...prev]);
                appendAudit(
                  `فتح أمر عمل صيانة ${order.id} للموقع ${order.bayId}`,
                  `Created maintenance work order ${order.id} for ${order.bayId}`
                );
                showToast(t(lang, `تم إصدار تذكرة الصيانة ${order.id}.`, `Work order ${order.id} issued.`));
              }}
              onAdvanceWorkOrder={(id) => {
                setWorkOrders((prev) =>
                  prev.map((wo) => {
                    if (wo.id !== id) return wo;
                    const nextStatus =
                      wo.status === 'open'
                        ? 'in_progress'
                        : wo.status === 'in_progress'
                          ? 'resolved'
                          : 'resolved';
                    return { ...wo, status: nextStatus };
                  })
                );
                appendAudit(`تحديث حالة أمر العمل ${id}`, `Updated work order ${id} status`);
              }}
              onStartEmergencyDrill={() => {
                const startedAt = Date.now();
                if (!smokeAlert) handleToggleSmokeAlert();
                triggerLowBessAlert(16);
                setEvacRobot((prev) => ({
                  ...prev,
                  phase: 'escorting',
                  targetZone: 'B-04',
                  laserGuideActive: true,
                  sirenBeaconActive: true,
                }));
                appendAudit(
                  'بدء مناورة طوارئ شاملة لقياس سرعة الاستجابة',
                  'Started full emergency readiness & response drill'
                );
                return startedAt;
              }}
              onCompleteEmergencyDrill={(startedAtMs) => {
                const durationSec = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
                const grade: EmergencyDrillRun['grade'] =
                  durationSec <= 20 ? 'A+' : durationSec <= 45 ? 'A' : 'B';
                if (smokeAlert) handleToggleSmokeAlert();
                stopAllAlarms();
                stopCopilotSpeech();
                setBessCharge(88);
                setEvacRobot((prev) => ({
                  ...prev,
                  phase: 'patrol',
                  laserGuideActive: false,
                  sirenBeaconActive: false,
                }));
                const run: EmergencyDrillRun = {
                  id: `DRILL-${Date.now()}`,
                  scenarioAr: 'مناورة قطاع B-04 + هبوط BESS',
                  scenarioEn: 'Sector B-04 Smoke + BESS Drop Drill',
                  startedAtMs,
                  durationSec,
                  grade,
                  completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                setDrillHistory((prev) => [run, ...prev]);
                appendAudit(
                  `إتمام مناورة الطوارئ في ${durationSec} ثانية (تقييم ${grade})`,
                  `Completed emergency drill in ${durationSec}s (Grade ${grade})`
                );
                showToast(
                  t(
                    lang,
                    `اكتملت المناورة في ${durationSec} ثانية بتقييم ${grade}!`,
                    `Emergency drill completed in ${durationSec}s (Grade ${grade})!`
                  )
                );
              }}
              onNotify={showToast}
            />
          )}

          {/* 19. SETTINGS & INSTITUTIONAL IDENTITY */}
          {activeTab === 'settings' && (
            <SystemSettingsPanel
              lang={lang}
              settings={projectSettings}
              totalBays={spots.length}
              flashFxEnabled={flashFxEnabled}
              onUpdateSettings={handleUpdateProjectSettings}
              onToggleFlashFx={() => setFlashFxEnabled((prev) => !prev)}
              onNavigateTab={setActiveTab}
              onAddManualBay={() => {
                handleAddParkingSpot();
              }}
              onNotify={showToast}
            />
          )}

          {/* 20. ZERO-MOCK DATA PURGE & DATA HYGIENE STUDIO */}
          {activeTab === 'data_hygiene' && (
            <DataHygienePanel
              lang={lang}
              reservations={reservations}
              transactions={transactions}
              redeemedPoints={redeemedPoints}
              v2gSessions={v2gSessions}
              auditLogs={auditLogs}
              supervisorAlerts={supervisorAlerts}
              anprScanLogs={anprScanLogs}
              ecoToggleEvents={ecoToggleEvents}
              chargerRatings={chargerRatings}
              robotChargingLogs={robotChargingLogs}
              shiftHandovers={shiftHandovers}
              fleetPermits={fleetPermits}
              workOrders={workOrders}
              drillHistory={drillHistory}
              spots={spots}
              bessCharge={bessCharge}
              solarKw={solarKw}
              isEmailVerified={Boolean(firebaseUser?.emailVerified)}
              isAdminUser={Boolean(currentUser?.email.toLowerCase() === ADMIN_EMAIL)}
              zeroMockMode={zeroMockMode}
              onExecuteWipe={executeDataWipe}
              onExportFullBackup={handleExportFullBackupJson}
              onSeedRealisticDemo={handleSeedRealisticDemoData}
              onPruneRecords={handlePruneRecords}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* In-app Confirmation Modal for Clear System Data */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/35 bg-[#0D1E2E] p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">
                {t(lang, 'تأكيد تفريغ بيانات النظام', 'Confirm Clear System Data')}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {t(
                lang,
                'سيؤدي هذا الإجراء إلى حذف جميع الحجوزات والمعاملات الكربونية وجلسات V2G وسجلات التدقيق من Firestore وإعادة المواقف لحالة التوفر الكامل.',
                'This will permanently delete all reservations, carbon transactions, V2G sessions, and audit logs from Firestore and reset parking bays to clean available state.'
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={clearingData}
                onClick={() => setClearModalOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                {t(lang, 'إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={clearingData}
                onClick={handleClearSystemData}
                className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearingData
                  ? t(lang, 'جاري التفريغ...', 'Clearing...')
                  : t(lang, 'تأكيد التفريغ النهائي', 'Confirm & Clear All')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Green QR Pass Modal */}
      <GreenTicketModal
        lang={lang}
        ticket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onSummonChargingRobot={(spotId, plate) => {
          playHydraulicGateSound();
          setChargingRobot((prev) => ({
            ...prev,
            phase: 'charging',
            targetSpotId: spotId,
            targetPlate: plate,
            powerKw: 45,
            batteryPct: Math.max(25, prev.batteryPct - 5),
          }));
          setActiveTicket(null);
          setActiveTab('robots');
          showToast(
            t(
              lang,
              `تم استدعاء روبوت الشحن المتنقل للموقف ${spotId} (${plate})!`,
              `Mobile charging robot dispatched to ${spotId} (${plate})!`
            )
          );
        }}
      />

      {/* Quick Scan Camera QR Check-In Modal */}
      <QuickScanCheckInModal
        lang={lang}
        isOpen={quickScanOpen}
        reservations={reservations}
        onClose={() => setQuickScanOpen(false)}
        onCheckInReservation={handleCheckInReservation}
      />

      {/* Gemini AI Copilot Slide-over Drawer */}
      <CopilotDrawer
        lang={lang}
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        contextSummary={{
          totalSpots: stats.total,
          occupancyPct: stats.occupancyPct,
          availableSpots: stats.available,
          bessCharge,
          solarKw,
          ecoConservation,
          smokeAlert,
          totalCo2Kg: stats.totalCo2Kg,
          totalPoints: stats.totalPoints,
          avgTempC: stats.thermal.avgTempC,
          peakTempC: stats.thermal.peakTempC,
          peakBayLabel: stats.thermal.peakBayLabel,
          thermalCongestionPct: stats.thermal.congestionIndexPct,
          activeTab,
        }}
        onExecuteAction={handleCopilotAction}
      />

      {/* Entrance Gate Kiosk Display Overlay */}
      {projectSettings.gateKioskMode && (
        <GateKioskOverlay
          lang={lang}
          settings={projectSettings}
          spots={spots}
          solarKw={solarKw}
          bessCharge={bessCharge}
          avgTempC={stats.thermal.avgTempC}
          onExitKiosk={() =>
            handleUpdateProjectSettings({ ...projectSettings, gateKioskMode: false })
          }
        />
      )}
      </div>
    </div>
  );
}
