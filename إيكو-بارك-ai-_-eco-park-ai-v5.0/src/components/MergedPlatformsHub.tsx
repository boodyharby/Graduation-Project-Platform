import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowLeftRight,
  BatteryCharging,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Droplets,
  Layers,
  Leaf,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  Route,
  Sparkles,
  Trees,
  Users,
  Zap,
} from 'lucide-react';
import {
  ActiveMergedEventState,
  ActiveMergedTourState,
  Language,
  NavTab,
  ParkingSpot,
  VehicleType,
} from '../types/parking';
import { BRANCHES } from '../data/initialData';
import { t } from '../data/i18n';
import { VEHICLE_SPECS, calculateCarbonSavings } from '../utils/ecoEngine';

interface MergedPlatformsHubProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  ecoConservation: boolean;
  defaultDriverName: string;
  embeddedMode?: 'p101' | 'p107' | 'all';
  onBindBookingFields?: (branch: string, vehicleType: VehicleType) => void;
  activeTour?: ActiveMergedTourState | null;
  activeEvent?: ActiveMergedEventState | null;
  onSyncTour?: (tour: ActiveMergedTourState) => void;
  onSyncEvent?: (evt: ActiveMergedEventState) => void;
  onExecuteTriProjectSynergy?: (
    tour: ActiveMergedTourState,
    evt: ActiveMergedEventState
  ) => Promise<void>;
  onNavigateTab?: (tab: NavTab) => void;
  onBookCombinedReservation: (opts: {
    branch: string;
    driverName: string;
    plateNumber: string;
    vehicleType: VehicleType;
    isVip: boolean;
    summonRobot: boolean;
    sourceLabelAr: string;
    sourceLabelEn: string;
  }) => Promise<void>;
  onPrepareEventCapacity: (
    eventTitle: string,
    targetBaysNeeded: number,
    enableEco: boolean
  ) => number;
  onNotify: (msg: string) => void;
}

interface TourStop {
  id: string;
  nameAr: string;
  nameEn: string;
  distanceKm: number;
  durationMin: number;
  categoryAr: string;
  categoryEn: string;
  ecoChargeStop: boolean;
}

interface CityTourHub {
  id: string;
  branchName: string;
  cityAr: string;
  cityEn: string;
  stops: TourStop[];
}

const CITY_TOUR_HUBS: CityTourHub[] = [
  {
    id: 'jerusalem',
    branchName: BRANCHES[4],
    cityAr: 'القدس والمسار التراثي — فلسطين المحتلة',
    cityEn: 'Jerusalem Heritage Route — Occupied Palestine',
    stops: [
      {
        id: 'j1',
        nameAr: 'محطة شحن باب العامود الخضراء',
        nameEn: 'Damascus Gate Green EV Hub',
        distanceKm: 4.5,
        durationMin: 25,
        categoryAr: 'موقف شحن',
        categoryEn: 'EV Hub',
        ecoChargeStop: true,
      },
      {
        id: 'j2',
        nameAr: 'بلدة القدس القديمة والمسجد الأقصى',
        nameEn: 'Old City & Al-Aqsa Heritage Zone',
        distanceKm: 3.2,
        durationMin: 90,
        categoryAr: 'معلم تاريخي',
        categoryEn: 'Heritage',
        ecoChargeStop: false,
      },
      {
        id: 'j3',
        nameAr: 'جبل الزيتون والحديقة البيوفيلية',
        nameEn: 'Mount of Olives Biophilic Overlook',
        distanceKm: 5.8,
        durationMin: 45,
        categoryAr: 'طبيعة',
        categoryEn: 'Eco Overlook',
        ecoChargeStop: true,
      },
      {
        id: 'j4',
        nameAr: 'المتحف البيئي وسوق الحرف التقليدية',
        nameEn: 'Eco Museum & Artisan Souq',
        distanceKm: 6.1,
        durationMin: 55,
        categoryAr: 'ثقافة',
        categoryEn: 'Culture',
        ecoChargeStop: false,
      },
    ],
  },
  {
    id: 'kafr',
    branchName: BRANCHES[0],
    cityAr: 'كفر الشيخ وبحيرة البرلس — المسار البيئي',
    cityEn: 'Kafr El-Sheikh & Burullus Eco Route',
    stops: [
      {
        id: 'k1',
        nameAr: 'مجمع إيكو-بارك الرئيسي الذكي',
        nameEn: 'Eco-Park Main Smart Hub',
        distanceKm: 3.0,
        durationMin: 20,
        categoryAr: 'نقطة انطلاق',
        categoryEn: 'Start Bay',
        ecoChargeStop: true,
      },
      {
        id: 'k2',
        nameAr: 'محمية بحيرة البرلس الطبيعية',
        nameEn: 'Lake Burullus Nature Reserve',
        distanceKm: 28.4,
        durationMin: 80,
        categoryAr: 'محمية طبيعية',
        categoryEn: 'Reserve',
        ecoChargeStop: false,
      },
      {
        id: 'k3',
        nameAr: 'حديقة صنعاء المستدامة',
        nameEn: 'Sanaa Sustainable Urban Park',
        distanceKm: 7.5,
        durationMin: 40,
        categoryAr: 'ترفيه أخضر',
        categoryEn: 'Green Park',
        ecoChargeStop: true,
      },
    ],
  },
  {
    id: 'riyadh',
    branchName: BRANCHES[1],
    cityAr: 'الرياض والدرعية التاريخية — المسار الحضري',
    cityEn: 'Riyadh & Historic Diriyah Eco Route',
    stops: [
      {
        id: 'r1',
        nameAr: 'حي الطريف التاريخي بالدرعية',
        nameEn: 'At-Turaif UNESCO Heritage District',
        distanceKm: 18.2,
        durationMin: 95,
        categoryAr: 'تراث عالمي',
        categoryEn: 'Heritage',
        ecoChargeStop: true,
      },
      {
        id: 'r2',
        nameAr: 'وادي حنيفة والممرات الخضراء',
        nameEn: 'Wadi Hanifah Green Trail',
        distanceKm: 11.4,
        durationMin: 60,
        categoryAr: 'طبيعة',
        categoryEn: 'Green Trail',
        ecoChargeStop: false,
      },
      {
        id: 'r3',
        nameAr: 'مركز الملك عبدالله المالي KAFD',
        nameEn: 'KAFD Smart Eco District',
        distanceKm: 9.6,
        durationMin: 45,
        categoryAr: 'مدينة ذكية',
        categoryEn: 'Smart City',
        ecoChargeStop: true,
      },
    ],
  },
  {
    id: 'jeddah',
    branchName: BRANCHES[2],
    cityAr: 'جدة التاريخية والكورنيش المستدام',
    cityEn: 'Historic Jeddah & Waterfront Route',
    stops: [
      {
        id: 'jd1',
        nameAr: 'جدة التاريخية (البلد)',
        nameEn: 'Al-Balad Heritage District',
        distanceKm: 8.5,
        durationMin: 85,
        categoryAr: 'تراث',
        categoryEn: 'Heritage',
        ecoChargeStop: true,
      },
      {
        id: 'jd2',
        nameAr: 'واجهة روشن البحرية ومحطة الشمس',
        nameEn: 'Waterfront Promenade & PV Station',
        distanceKm: 14.0,
        durationMin: 50,
        categoryAr: 'ساحلي',
        categoryEn: 'Waterfront',
        ecoChargeStop: true,
      },
    ],
  },
];

interface SmartEventRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'conference' | 'expo' | 'festival' | 'sports';
  branch: string;
  capacity: number;
  evSharePct: number;
  transitSharePct: number;
  eventWindow: string;
  prepared: boolean;
}

const INITIAL_EVENTS: SmartEventRecord[] = [
  {
    id: 'evt-green-summit',
    nameAr: 'قمة المدن الذكية والاستدامة الحضرية',
    nameEn: 'Smart Cities & Urban Sustainability Summit',
    category: 'conference',
    branch: BRANCHES[0],
    capacity: 420,
    evSharePct: 58,
    transitSharePct: 35,
    eventWindow: '18:00 - 22:00',
    prepared: false,
  },
  {
    id: 'evt-heritage-fest',
    nameAr: 'مهرجان المسارات الثقافية والطاقة النظيفة',
    nameEn: 'Clean Energy & Cultural Trails Festival',
    category: 'festival',
    branch: BRANCHES[4],
    capacity: 680,
    evSharePct: 44,
    transitSharePct: 40,
    eventWindow: '17:00 - 23:00',
    prepared: false,
  },
];

export const MergedPlatformsHub: React.FC<MergedPlatformsHubProps> = ({
  lang,
  spots,
  bessCharge,
  solarKw,
  ecoConservation,
  defaultDriverName,
  embeddedMode = 'all',
  onBindBookingFields,
  onSyncTour,
  onSyncEvent,
  onExecuteTriProjectSynergy,
  onNavigateTab,
  onBookCombinedReservation,
  onPrepareEventCapacity,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<'synergy' | 'p101' | 'p107'>(
    embeddedMode === 'p101' ? 'p101' : embeddedMode === 'p107' ? 'p107' : 'synergy'
  );
  const [synergyBusy, setSynergyBusy] = useState(false);

  // --- PROJECT 101 STATE (Smart Eco-Tourism & Route Planner) ---
  const [selectedCityId, setSelectedCityId] = useState<string>('jerusalem');
  const currentCity = useMemo(
    () => CITY_TOUR_HUBS.find((c) => c.id === selectedCityId) ?? CITY_TOUR_HUBS[0],
    [selectedCityId]
  );
  const [selectedStops, setSelectedStops] = useState<string[]>(['j1', 'j2', 'j3']);
  const [routeVehicle, setRouteVehicle] = useState<VehicleType>('ELECTRIC');
  const [batteryPct, setBatteryPct] = useState<number>(74);
  const [touristName, setTouristName] = useState<string>(defaultDriverName || 'زائر مستدام');
  const [touristPlate, setTouristPlate] = useState<string>('TRV-101');
  const [bookingRouteBusy, setBookingRouteBusy] = useState(false);

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    const city = CITY_TOUR_HUBS.find((c) => c.id === cityId);
    if (city) {
      setSelectedStops(city.stops.slice(0, 2).map((s) => s.id));
      onBindBookingFields?.(city.branchName, routeVehicle);
    }
  };

  const toggleStop = (stopId: string) => {
    setSelectedStops((prev) =>
      prev.includes(stopId)
        ? prev.length > 1
          ? prev.filter((id) => id !== stopId)
          : prev
        : [...prev, stopId]
    );
  };

  const routeMetrics = useMemo(() => {
    const chosen = currentCity.stops.filter((s) => selectedStops.includes(s.id));
    const totalKm = Number(chosen.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(1));
    const totalVisitMin = chosen.reduce((acc, s) => acc + s.durationMin, 0);
    const driveMin = Math.round(totalKm * 1.45);
    const evStopsCount = chosen.filter((s) => s.ecoChargeStop).length;

    // Average EV consumes ~0.35% battery per km, replenished +18% at each Eco-Park charging stop
    const drainPct = Math.round(totalKm * 0.42);
    const chargeBoostPct = routeVehicle === 'ELECTRIC' ? evStopsCount * 16 : 0;
    const endBatteryPct = Math.max(4, Math.min(100, batteryPct - drainPct + chargeBoostPct));
    const carbonResult = calculateCarbonSavings(routeVehicle, totalKm, driveMin * 0.25);

    return {
      chosen,
      totalKm,
      totalMinutes: totalVisitMin + driveMin,
      evStopsCount,
      endBatteryPct,
      co2SavedKg: carbonResult.co2SavedKg,
      moneySavedSar: carbonResult.moneySavedSar,
      rangeWarning: routeVehicle === 'ELECTRIC' && endBatteryPct < 18,
    };
  }, [batteryPct, currentCity, routeVehicle, selectedStops]);

  const handleConfirmTourReservation = async () => {
    setBookingRouteBusy(true);
    try {
      await onBookCombinedReservation({
        branch: currentCity.branchName,
        driverName: touristName.trim() || 'Eco Tourist',
        plateNumber: touristPlate.trim() || 'TRV-101',
        vehicleType: routeVehicle,
        isVip: routeVehicle === 'ELECTRIC',
        summonRobot: routeVehicle === 'ELECTRIC',
        sourceLabelAr: `مسار سياحي 101 (${currentCity.cityAr})`,
        sourceLabelEn: `Project 101 Route (${currentCity.cityEn})`,
      });
    } finally {
      setBookingRouteBusy(false);
    }
  };

  // --- PROJECT 107 STATE (Smart Event Attendance Forecast & Resource Optimization) ---
  const [events, setEvents] = useState<SmartEventRecord[]>(INITIAL_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string>(INITIAL_EVENTS[0].id);
  const [newEvtName, setNewEvtName] = useState('');
  const [newEvtCapacity, setNewEvtCapacity] = useState(320);
  const [newEvtCategory, setNewEvtCategory] = useState<SmartEventRecord['category']>('conference');
  const [newEvtEvShare, setNewEvtEvShare] = useState(50);
  const [newEvtWindow, setNewEvtWindow] = useState('18:00 - 22:00');

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  const eventForecast = useMemo(() => {
    const categoryTurnoutRatio =
      selectedEvent.category === 'conference'
        ? 0.88
        : selectedEvent.category === 'expo'
          ? 0.84
          : selectedEvent.category === 'sports'
            ? 0.94
            : 0.91;

    const predictedAttendance = Math.round(selectedEvent.capacity * categoryTurnoutRatio);
    const privateCarUsers = Math.round(
      predictedAttendance * (1 - selectedEvent.transitSharePct / 100)
    );
    // Average occupancy 2.2 attendees per vehicle
    const predictedVehicles = Math.max(4, Math.ceil(privateCarUsers / 2.2));
    // Capped practical bay pool for simulator coordination
    const targetBaysNeeded = Math.min(24, Math.max(spots.length, Math.ceil(predictedVehicles / 10)));
    const availableNow = spots.filter((s) => s.status === 'available').length;

    // Resource Rationing Calculation (Preventing fixed 100% capacity waste)
    const wasteBaselineKwh = Math.round(selectedEvent.capacity * 1.45);
    const smartRationedKwh = Math.round(
      predictedAttendance * (ecoConservation ? 0.72 : 0.86)
    );
    const energySavedKwh = Math.max(10, wasteBaselineKwh - smartRationedKwh);

    const wasteBaselineWaterL = Math.round(selectedEvent.capacity * 4.2);
    const smartRationedWaterL = Math.round(predictedAttendance * 2.15);
    const waterSavedL = Math.max(40, wasteBaselineWaterL - smartRationedWaterL);

    const wasteReductionPct = Math.round(
      ((energySavedKwh / Math.max(1, wasteBaselineKwh)) * 0.55 +
        (waterSavedL / Math.max(1, wasteBaselineWaterL)) * 0.45) *
        100
    );

    const comparisonChart = [
      {
        metric: t(lang, 'كهرباء (kWh)', 'Power (kWh)'),
        wasted: wasteBaselineKwh,
        rationed: smartRationedKwh,
      },
      {
        metric: t(lang, 'مياه مبردة (×10L)', 'Cooling H2O (×10L)'),
        wasted: Math.round(wasteBaselineWaterL / 10),
        rationed: Math.round(smartRationedWaterL / 10),
      },
      {
        metric: t(lang, 'حمل المواقف المدار', 'Managed Vehicle Wave'),
        wasted: Math.ceil(selectedEvent.capacity / 1.8),
        rationed: predictedVehicles,
      },
    ];

    return {
      predictedAttendance,
      predictedVehicles,
      targetBaysNeeded,
      availableNow,
      energySavedKwh,
      waterSavedL,
      wasteReductionPct,
      solarCoveragePct: Math.min(100, Math.round((solarKw / Math.max(20, smartRationedKwh * 0.42)) * 100)),
      comparisonChart,
    };
  }, [ecoConservation, lang, selectedEvent, solarKw, spots]);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvtName.trim()) return;
    const item: SmartEventRecord = {
      id: `evt-${Date.now()}`,
      nameAr: newEvtName.trim(),
      nameEn: newEvtName.trim(),
      category: newEvtCategory,
      branch: BRANCHES[0],
      capacity: Math.max(40, Math.min(3000, newEvtCapacity)),
      evSharePct: newEvtEvShare,
      transitSharePct: 35,
      eventWindow: newEvtWindow,
      prepared: false,
    };
    setEvents((prev) => [item, ...prev]);
    setSelectedEventId(item.id);
    setNewEvtName('');
    onNotify(
      t(
        lang,
        `تم تسجيل فعالية «${item.nameAr}» وتوليد خطة ترشيد الموارد الآلية.`,
        `Registered event "${item.nameEn}" with automated resource rationing plan.`
      )
    );
  };

  const handleRunEventPrep = () => {
    const addedCount = onPrepareEventCapacity(
      lang === 'ar' ? selectedEvent.nameAr : selectedEvent.nameEn,
      eventForecast.targetBaysNeeded,
      true
    );
    setEvents((prev) =>
      prev.map((ev) => (ev.id === selectedEvent.id ? { ...ev, prepared: true } : ev))
    );
    onNotify(
      t(
        lang,
        `تم تجهيز الفعالية: توسعة ${addedCount} مواقف إضافية في 2D/3D وتفعيل وضع ترشيد الموارد لخفض الفاقد بنسبة ${eventForecast.wasteReductionPct}%.`,
        `Event prepared: expanded ${addedCount} bays in 2D/3D & enabled resource rationing (${eventForecast.wasteReductionPct}% waste reduction).`
      )
    );
  };

  const currentTourState = useMemo<ActiveMergedTourState>(
    () => ({
      cityId: currentCity.id,
      cityAr: currentCity.cityAr,
      cityEn: currentCity.cityEn,
      branchName: currentCity.branchName,
      totalKm: routeMetrics.totalKm,
      co2SavedKg: routeMetrics.co2SavedKg,
      batteryEndPct: routeMetrics.endBatteryPct,
      stopsCount: routeMetrics.chosen.length,
      evStopsCount: routeMetrics.evStopsCount,
    }),
    [currentCity, routeMetrics]
  );

  const currentEventState = useMemo<ActiveMergedEventState>(
    () => ({
      id: selectedEvent.id,
      titleAr: selectedEvent.nameAr,
      titleEn: selectedEvent.nameEn,
      branch: selectedEvent.branch,
      capacity: selectedEvent.capacity,
      predictedAttendance: eventForecast.predictedAttendance,
      predictedVehicles: eventForecast.predictedVehicles,
      targetBaysNeeded: eventForecast.targetBaysNeeded,
      energySavedKwh: eventForecast.energySavedKwh,
      waterSavedL: eventForecast.waterSavedL,
      wasteReductionPct: eventForecast.wasteReductionPct,
      eventWindow: selectedEvent.eventWindow,
      prepared: selectedEvent.prepared,
    }),
    [eventForecast, selectedEvent]
  );

  const lastTourSigRef = useRef<string>('');
  const lastEventSigRef = useRef<string>('');

  useEffect(() => {
    if (!onSyncTour) return;
    const sig = JSON.stringify(currentTourState);
    if (lastTourSigRef.current !== sig) {
      lastTourSigRef.current = sig;
      onSyncTour(currentTourState);
    }
  }, [currentTourState, onSyncTour]);

  useEffect(() => {
    if (!onSyncEvent) return;
    const sig = JSON.stringify(currentEventState);
    if (lastEventSigRef.current !== sig) {
      lastEventSigRef.current = sig;
      onSyncEvent(currentEventState);
    }
  }, [currentEventState, onSyncEvent]);

  const handleRunMasterSynergy = async () => {
    setSynergyBusy(true);
    try {
      if (onExecuteTriProjectSynergy) {
        await onExecuteTriProjectSynergy(currentTourState, currentEventState);
      } else {
        handleRunEventPrep();
      }
      setEvents((prev) =>
        prev.map((ev) => (ev.id === selectedEvent.id ? { ...ev, prepared: true } : ev))
      );
    } finally {
      setSynergyBusy(false);
    }
  };

  const handleMatchRouteCityToEvent = () => {
    const matchedHub = CITY_TOUR_HUBS.find((c) => c.branchName === selectedEvent.branch);
    if (matchedHub) {
      handleSelectCity(matchedHub.id);
      onNotify(
        t(
          lang,
          `تم ربط مسار مشروع 101 تلقائياً بوجهة الفعالية: ${matchedHub.cityAr}`,
          `Matched Project 101 route automatically to event hub: ${matchedHub.cityEn}`
        )
      );
    }
  };

  const effectiveSection =
    embeddedMode === 'p101' ? 'p101' : embeddedMode === 'p107' ? 'p107' : activeSection;

  return (
    <div className="space-y-6">
      {/* Unified Header Banner shown only in 'all' mode */}
      {embeddedMode === 'all' && (
      <div className="rounded-xl border border-emerald-500/35 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {t(
                lang,
                'التكامل الثلاثي الموحد · Eco-Park AI × مشروع 101 × مشروع 107',
                'Unified Smart Hub · Eco-Park AI × Project 101 × Project 107'
              )}
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-white">
              {t(
                lang,
                'تبويب المسارات السياحية المستدامة (101) وإدارة الفعاليات وترشيد الموارد (107)',
                'Smart Tourism Route Planner (101) & Event Resource Forecasting (107)'
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'يربط خطط الرحلات واستكشاف المدن وجدول الفعاليات مباشرةً بمواقف إيكو-بارك والشواحن الشمسية والتوسع الآلي 2D/3D ومنع الفاقد.',
                'Directly connects urban eco-tourism routing and event attendance forecasting into live Eco-Park bays, 2D/3D auto-expansion, solar power, and QR passes.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('synergy')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeSection === 'synergy'
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950'
                  : 'border border-white/10 bg-[#08121D] text-slate-300 hover:bg-white/5'
              }`}
            >
              <Layers className="h-4 w-4" />
              {t(lang, 'التكامل الشامل (كل المشاريع)', 'Full Tri-Project Synergy')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('p101')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeSection === 'p101'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-white/10 bg-[#08121D] text-slate-300 hover:bg-white/5'
              }`}
            >
              <Compass className="h-4 w-4" />
              {t(lang, 'مشروع 101: الرحلات والمسارات السياحية', 'Project 101: Eco-Tourism Routes')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('p107')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeSection === 'p107'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-white/10 bg-[#08121D] text-slate-300 hover:bg-white/5'
              }`}
            >
              <Users className="h-4 w-4" />
              {t(lang, 'مشروع 107: الفعاليات وترشيد الموارد', 'Project 107: Events & Zero-Waste')}
            </button>
          </div>
        </div>

        {/* Shared Live System Telemetry */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-white/10 pt-3">
          <div className="rounded-lg bg-[#08121D] px-3 py-2">
            <div className="text-[11px] text-slate-400">{t(lang, 'المواقف المتاحة للربط', 'Available Bays')}</div>
            <div className="font-mono text-base font-extrabold text-emerald-400 tabular-nums">
              {spots.filter((s) => s.status === 'available').length} / {spots.length}
            </div>
          </div>
          <div className="rounded-lg bg-[#08121D] px-3 py-2">
            <div className="text-[11px] text-slate-400">{t(lang, 'طاقة البطاريات BESS', 'BESS Storage')}</div>
            <div className="font-mono text-base font-extrabold text-cyan-300 tabular-nums">
              {bessCharge}%
            </div>
          </div>
          <div className="rounded-lg bg-[#08121D] px-3 py-2">
            <div className="text-[11px] text-slate-400">{t(lang, 'الإنتاج الشمسي الحي', 'Live Solar PV')}</div>
            <div className="font-mono text-base font-extrabold text-amber-300 tabular-nums">
              {solarKw} kW
            </div>
          </div>
          <div className="rounded-lg bg-[#08121D] px-3 py-2">
            <div className="text-[11px] text-slate-400">{t(lang, 'وضع ترشيد الموارد', 'Eco-Rationing')}</div>
            <div className={`font-mono text-base font-extrabold ${ecoConservation ? 'text-emerald-400' : 'text-slate-300'}`}>
              {ecoConservation ? t(lang, 'مفعّل نشط', 'ACTIVE') : t(lang, 'قياسي', 'Standard')}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ==================== UNIFIED CLOSED-LOOP TRI-PROJECT SYNERGY VIEW ==================== */}
      {effectiveSection === 'synergy' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-500/35 bg-[#0D1E2E] p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  {t(
                    lang,
                    'الحلقة المغلقة للتكامل التلقائي بين كل المشاريع (107 ➔ 101 ➔ Eco-Park 2D/3D ➔ البيئة الخضراء)',
                    'Closed-Loop Cross-Project Orchestration (107 ➔ 101 ➔ Eco-Park 2D/3D ➔ Green Hub)'
                  )}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {t(
                    lang,
                    'تعمل المشاريع الأربعة كمنظومة واحدة مترابطة: توقع الفعالية يضبط السعة والترشيد، والمسار السياحي يوجّه الزوار للشحن وQR، والعائد يموّل التشجير البيوفيلي.',
                    'All four systems operate as one closed loop: event forecast scales capacity & rationing, route planner guides visitors to EV bays & QR passes, and savings fund biophilic planting.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleMatchRouteCityToEvent}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {t(lang, 'مواءمة مسار 101 مع موقع الفعالية 107', 'Align Route 101 Hub to Event 107')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Node 1: Project 107 */}
              <div className="rounded-xl border border-cyan-500/30 bg-[#08121D] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                  <span>1. {t(lang, 'مشروع 107: الفعاليات والترشيد', 'Project 107: Event Engine')}</span>
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-sm font-extrabold text-white">
                  {lang === 'ar' ? currentEventState.titleAr : currentEventState.titleEn}
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300 tabular-nums">
                  <div>{t(lang, `الحضور المتوقع: ${currentEventState.predictedAttendance} شخص`, `Attendance: ${currentEventState.predictedAttendance}`)}</div>
                  <div>{t(lang, `تدفق المركبات: ${currentEventState.predictedVehicles} مركبة`, `Vehicles: ${currentEventState.predictedVehicles}`)}</div>
                  <div className="text-emerald-400">{t(lang, `وفر الطاقة: ${currentEventState.energySavedKwh} kWh · المياه: ${currentEventState.waterSavedL}L`, `Saved: ${currentEventState.energySavedKwh} kWh · ${currentEventState.waterSavedL}L`)}</div>
                </div>
              </div>

              {/* Node 2: Project 101 */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#08121D] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>2. {t(lang, 'مشروع 101: مسار الضيوف', 'Project 101: Eco-Route')}</span>
                  <Compass className="h-4 w-4" />
                </div>
                <div className="text-sm font-extrabold text-white">
                  {lang === 'ar' ? currentTourState.cityAr : currentTourState.cityEn}
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300 tabular-nums">
                  <div>{t(lang, `طول المسار: ${currentTourState.totalKm} كم (${currentTourState.stopsCount} معالم)`, `Distance: ${currentTourState.totalKm} km (${currentTourState.stopsCount} stops)`)}</div>
                  <div>{t(lang, `شحن الوصول: ${currentTourState.batteryEndPct}%`, `Arrival SoC: ${currentTourState.batteryEndPct}%`)}</div>
                  <div className="text-teal-300">{t(lang, `توفير CO₂ بالمسار: ${currentTourState.co2SavedKg} kg`, `Route CO₂ Avoided: ${currentTourState.co2SavedKg} kg`)}</div>
                </div>
              </div>

              {/* Node 3: Eco-Park 2D/3D & QR */}
              <div className="rounded-xl border border-amber-500/30 bg-[#08121D] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span>3. {t(lang, 'إيكو-بارك AI (2D/3D + QR)', 'Eco-Park AI (2D/3D + QR)')}</span>
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-sm font-extrabold text-white">
                  {t(lang, `الهدف التشغيلي: ${currentEventState.targetBaysNeeded} موقف ذكي`, `Target Lot: ${currentEventState.targetBaysNeeded} Bays`)}
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300 tabular-nums">
                  <div>{t(lang, `المواقف الحالية: ${spots.length} | شمسية: ${solarKw} kW`, `Current Bays: ${spots.length} | PV: ${solarKw} kW`)}</div>
                  <div>{t(lang, `ترشيد الموارد: ${ecoConservation ? 'مفعّل' : 'سيُفعّل آلياً'}`, `Rationing: ${ecoConservation ? 'Active' : 'Will Activate'}`)}</div>
                  <div className="text-cyan-300">{t(lang, 'إصدار تذكرة QR + روبوت EcoCharge', 'Issues QR Pass + EcoCharge Bot')}</div>
                </div>
              </div>

              {/* Node 4: Green Sustainability Hub & Wallet */}
              <div className="rounded-xl border border-teal-400/30 bg-[#08121D] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                  <span>4. {t(lang, 'البيئة الخضراء ومحفظة الكربون', 'Green Flora & Carbon Wallet')}</span>
                  <Trees className="h-4 w-4" />
                </div>
                <div className="text-sm font-extrabold text-white">
                  {t(lang, 'تمويل تشجير بيوفيلي + 25 نقطة', 'Biophilic Planting + 25 Pts')}
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300">
                  <div>{t(lang, 'إضافة حزام شجيرات حيوي (+19 kg CO₂/سنة)', 'Plants Bioswale Strip (+19 kg CO₂/yr)')}</div>
                  <div>{t(lang, 'تحديث القراءات في وثيقة Word و2D/3D', 'Updates 2D/3D Flora & 10-Page Word')}</div>
                  <div className="text-emerald-400">
                    {currentEventState.prepared
                      ? t(lang, '✓ التكامل منفّذ ومزامَن حالياً', '✓ Integrated Synergy Synced')
                      : t(lang, 'جاهز للتنفيذ بضغطة واحدة', 'Ready for 1-Click Orchestration')}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={synergyBusy}
                onClick={handleRunMasterSynergy}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-xs font-extrabold text-slate-950 hover:opacity-95 disabled:opacity-50 transition"
              >
                <Sparkles className="h-4 w-4" />
                {synergyBusy
                  ? t(lang, 'جاري تنفيذ التكامل الشامل...', 'Executing Unified Synergy...')
                  : t(
                      lang,
                      'تفعيل التكامل الشامل بين كل المشاريع الآن (101 × 107 × Eco-Park × البيئة الخضراء)',
                      'Execute Full Cross-Project Integration (101 × 107 × Eco-Park × Green Hub)'
                    )}
              </button>

              {onNavigateTab && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sim2d')}
                    className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-white/5"
                  >
                    {t(lang, 'مراقبة التدفق في 2D', 'Open 2D Twin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sim3d')}
                    className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-white/5"
                  >
                    {t(lang, 'معاينة التشجير في 3D', 'Open 3D Twin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('reports')}
                    className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-white/5"
                  >
                    {t(lang, 'تصدير Word المدمج', 'Export Integrated Word')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROJECT 101: SMART TOURISM & ROUTE PLANNER ==================== */}
      {effectiveSection === 'p101' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Route className="h-4 w-4 text-emerald-400" />
                {t(
                  lang,
                  'مشروع 101 — تخصيص مسار الرحلة واستكشاف المدينة الأخضر',
                  'Project 101 — Smart City Explorer & Eco Route Builder'
                )}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {t(lang, 'الوجهة / المدينة المتصلة بفروع إيكو-بارك', 'Destination City & Eco-Park Hub')}
                </label>
                <select
                  value={selectedCityId}
                  onChange={(e) => handleSelectCity(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                >
                  {CITY_TOUR_HUBS.map((city) => (
                    <option key={city.id} value={city.id}>
                      {lang === 'ar' ? city.cityAr : city.cityEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {t(lang, 'نوع مركبة الرحلة', 'Trip Vehicle Type')}
                </label>
                <select
                  value={routeVehicle}
                  onChange={(e) => {
                    const nextVt = e.target.value as VehicleType;
                    setRouteVehicle(nextVt);
                    onBindBookingFields?.(currentCity.branchName, nextVt);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                >
                  {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
                    <option key={vt} value={vt}>
                      {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {t(lang, 'شحن البطارية / الوقود عند الانطلاق:', 'Starting Battery / Range Level:')}
                </span>
                <span className="font-mono font-bold text-cyan-300 tabular-nums">{batteryPct}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                value={batteryPct}
                onChange={(e) => setBatteryPct(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                {t(lang, 'اختر المحطات والمعالم المخصصة في مسارك السياحي:', 'Select Curated City Stops & Charging Waypoints:')}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {currentCity.stops.map((stop) => {
                  const active = selectedStops.includes(stop.id);
                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => toggleStop(stop.id)}
                      className={`rounded-xl border p-3 text-start transition ${
                        active
                          ? 'border-emerald-400 bg-emerald-500/15'
                          : 'border-white/10 bg-[#08121D] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          {lang === 'ar' ? stop.nameAr : stop.nameEn}
                        </span>
                        {stop.ecoChargeStop && (
                          <Zap className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400 tabular-nums">
                        <span>{stop.distanceKm} km · {stop.durationMin} min</span>
                        <span className="text-emerald-300">
                          {lang === 'ar' ? stop.categoryAr : stop.categoryEn}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Project 101 Route Telemetry & Live Eco-Park Reservation */}
          <div className="lg:col-span-5 rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-400" />
                {t(lang, 'ملخص المسار المخصص والربط مع الموقف', 'Route Optimization & Eco-Park Binding')}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'إجمالي المسافة والزمن', 'Distance & Duration')}</div>
                  <div className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums">
                    {routeMetrics.totalKm} km
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    ≈ {routeMetrics.totalMinutes} {t(lang, 'دقيقة جولة + قيادة', 'min tour + drive')}
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'نسبة البطارية عند الوصول', 'Projected Arrival SoC')}</div>
                  <div className={`mt-1 font-mono text-lg font-extrabold tabular-nums ${routeMetrics.rangeWarning ? 'text-red-400' : 'text-emerald-400'}`}>
                    {routeMetrics.endBatteryPct}%
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {routeMetrics.evStopsCount} {t(lang, 'نقطة شحن إيكو-بارك', 'EcoCharge stops')}
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'CO2 الموفر بالمسار الأخضر', 'Route CO2 Avoided')}</div>
                  <div className="mt-1 font-mono text-lg font-extrabold text-teal-300 tabular-nums">
                    {routeMetrics.co2SavedKg} kg
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'وفر الوقود المقدر', 'Fuel Cost Saved')}</div>
                  <div className="mt-1 font-mono text-lg font-extrabold text-amber-300 tabular-nums">
                    {routeMetrics.moneySavedSar} SAR
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={touristName}
                  onChange={(e) => setTouristName(e.target.value)}
                  placeholder={t(lang, 'اسم الزائر / السائق', 'Visitor Name')}
                  className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                />
                <input
                  type="text"
                  value={touristPlate}
                  onChange={(e) => setTouristPlate(e.target.value)}
                  placeholder={t(lang, 'رقم اللوحة', 'Plate Number')}
                  className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={bookingRouteBusy}
              onClick={handleConfirmTourReservation}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              <Navigation className="h-4 w-4" />
              {bookingRouteBusy
                ? t(lang, 'جاري حجز موقف المسار...', 'Booking Route Bay...')
                : t(
                    lang,
                    'اعتماد المسار السياحي وحجز الموقف وتذكرة QR (101 → Eco-Park)',
                    'Confirm Eco-Route & Reserve Eco-Park QR Pass'
                  )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== PROJECT 107: SMART EVENTS & RESOURCE RATIONING ==================== */}
      {effectiveSection === 'p107' && (
        <div className="space-y-6">
          {/* Add New Event Form */}
          <form
            onSubmit={handleAddEvent}
            className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-cyan-400" />
              {t(
                lang,
                'مشروع 107 — جدولة فعالية والتنبؤ بمعدلات الحضور لترشيد الموارد والحد من الفاقد',
                'Project 107 — Event Registration, Attendance Forecast & Zero-Waste Rationing'
              )}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                value={newEvtName}
                onChange={(e) => setNewEvtName(e.target.value)}
                placeholder={t(lang, 'اسم الفعالية أو المؤتمر...', 'Event or conference title...')}
                className="lg:col-span-2 rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                required
              />
              <select
                value={newEvtCategory}
                onChange={(e) => setNewEvtCategory(e.target.value as SmartEventRecord['category'])}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none"
              >
                <option value="conference">{t(lang, 'مؤتمر علمي / مهني', 'Conference')}</option>
                <option value="expo">{t(lang, 'معرض تقني / بيئي', 'Expo')}</option>
                <option value="festival">{t(lang, 'مهرجان ثقافي', 'Festival')}</option>
                <option value="sports">{t(lang, 'فعالية جماهيرية', 'Sports Event')}</option>
              </select>
              <input
                type="number"
                min={40}
                max={3000}
                value={newEvtCapacity}
                onChange={(e) => setNewEvtCapacity(Number(e.target.value))}
                placeholder={t(lang, 'السعة المدعوة', 'Invited Capacity')}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-mono text-white outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 transition"
              >
                <Plus className="h-4 w-4" />
                {t(lang, 'إضافة وتوقع الحضور', 'Add & Forecast')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span>{t(lang, `نسبة الحضور بسيارات كهربائية (EV): ${newEvtEvShare}%`, `Expected EV Share: ${newEvtEvShare}%`)}</span>
              <input
                type="range"
                min={10}
                max={95}
                value={newEvtEvShare}
                onChange={(e) => setNewEvtEvShare(Number(e.target.value))}
                className="w-40 accent-cyan-400"
              />
              <label className="flex items-center gap-2">
                <span>{t(lang, 'نافذة وقت الفعالية:', 'Event Time Window:')}</span>
                <select
                  value={newEvtWindow}
                  onChange={(e) => setNewEvtWindow(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#08121D] px-2 py-1 text-xs font-mono text-white outline-none"
                >
                  <option value="09:00 - 13:00">09:00 - 13:00 ({t(lang, 'نهاري شمسي', 'Solar Peak')})</option>
                  <option value="14:00 - 17:30">14:00 - 17:30 ({t(lang, 'عصري متوسط', 'Afternoon')})</option>
                  <option value="18:00 - 22:00">18:00 - 22:00 ({t(lang, 'ذروة مسائية BESS', 'Evening BESS Peak')})</option>
                  <option value="20:00 - 00:00">20:00 - 00:00 ({t(lang, 'ليلي يعتمد على BESS', 'Night BESS Load')})</option>
                </select>
              </label>
            </div>
          </form>

          {/* Event Picker + Resource Forecast Dashboard */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-3">
              {events.map((ev) => {
                const active = ev.id === selectedEvent.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full rounded-xl border p-4 text-start transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/10'
                        : 'border-white/10 bg-[#0D1E2E] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {lang === 'ar' ? ev.nameAr : ev.nameEn}
                      </span>
                      {ev.prepared && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t(lang, 'مجهّز', 'Ready')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
                      <span>{t(lang, `السعة: ${ev.capacity}`, `Cap: ${ev.capacity}`)}</span>
                      <span>EV: {ev.evSharePct}%</span>
                      <span className="text-amber-300">{ev.eventWindow}</span>
                      <span className="text-cyan-300">{ev.category.toUpperCase()}</span>
                    </div>
                  </button>
                );
              })}

              {/* Execute Preparation directly into Eco-Park 2D/3D + Quick Scan */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-4 space-y-2.5">
                <button
                  type="button"
                  onClick={handleRunEventPrep}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  {t(
                    lang,
                    `تجهيز المواقف (${eventForecast.targetBaysNeeded}) وتفعيل ترشيد الموارد الآلي`,
                    `Provision ${eventForecast.targetBaysNeeded} Bays (2D/3D) & Activate Rationing`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onBookCombinedReservation({
                      branch: selectedEvent.branch,
                      driverName: lang === 'ar' ? `حاضر: ${selectedEvent.nameAr.slice(0, 22)}` : `Guest: ${selectedEvent.nameEn.slice(0, 22)}`,
                      plateNumber: `EVT-${Math.floor(100 + Math.random() * 899)}`,
                      vehicleType: selectedEvent.evSharePct >= 50 ? 'ELECTRIC' : 'HYBRID',
                      isVip: false,
                      summonRobot: true,
                      sourceLabelAr: `تذكرة فعالية 107 (${selectedEvent.nameAr})`,
                      sourceLabelEn: `Project 107 Event Pass (${selectedEvent.nameEn})`,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition"
                >
                  <QrCode className="h-4 w-4" />
                  {t(lang, 'إصدار تذكرة حضور فعالية مرتبطة بـ Quick Scan QR', 'Issue Event Attendee Quick-Scan QR Pass')}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'الحضور المتوقع AI', 'Predicted Attendance')}</div>
                  <div className="mt-1 font-mono text-xl font-extrabold text-white tabular-nums">
                    {eventForecast.predictedAttendance}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {eventForecast.predictedVehicles} {t(lang, 'مركبة وافدة', 'vehicles')}
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="text-[11px] text-slate-400">{t(lang, 'وفر الطاقة الكهربائية', 'Power Saved')}</div>
                  <div className="mt-1 font-mono text-xl font-extrabold text-amber-300 tabular-nums">
                    {eventForecast.energySavedKwh} kWh
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {eventForecast.solarCoveragePct}% {t(lang, 'تغطية شمسية', 'PV share')}
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t(lang, 'وفر المياه', 'Water Saved')}</span>
                    <Droplets className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div className="mt-1 font-mono text-xl font-extrabold text-cyan-300 tabular-nums">
                    {eventForecast.waterSavedL} L
                  </div>
                </div>
                <div className="rounded-xl bg-[#08121D] p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t(lang, 'خفض الفاقد الكلي', 'Waste Prevented')}</span>
                    <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-1 font-mono text-xl font-extrabold text-emerald-400 tabular-nums">
                    -{eventForecast.wasteReductionPct}%
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#08121D] p-4">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>{t(lang, 'مقارنة الفاقد التقليدي مقابل الترشيد الذكي للموارد (مشروع 107)', 'Conventional Resource Waste vs Smart AI Rationing')}</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                    <BatteryCharging className="h-3.5 w-3.5" />
                    {t(lang, 'مدار ببيانات الموقف الحية', 'Synced to Live Lot')}
                  </span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventForecast.comparisonChart} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="metric" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1927',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="wasted" name={t(lang, 'تشغيل تقليدي مُهدر', 'Baseline Uncontrolled')} fill="#F59E0B" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="rationed" name={t(lang, 'تشغيل مرشّد (107 + Eco-Park)', 'Smart Rationed')} fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
