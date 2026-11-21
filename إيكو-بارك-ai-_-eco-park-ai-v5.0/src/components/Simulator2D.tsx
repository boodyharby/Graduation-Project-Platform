import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Bot,
  CloudLightning,
  CloudRain,
  Droplets,
  Flame,
  Gauge,
  Moon,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  Sun,
  ThermometerSun,
  Wind,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ActiveMergedEventState,
  ActiveMergedTourState,
  Language,
  ParkingSpot,
  SimCar,
  VehicleType,
  WeatherCondition2D,
} from '../types/parking';
import {
  VEHICLE_SPECS,
  WEATHER_PROFILES,
  calculateCarbonSavings,
  computeLotThermalStats,
  computeWeatherEnergyProfile,
  playHydraulicGateSound,
  speakGuidance,
} from '../utils/ecoEngine';
import { t } from '../data/i18n';

interface Simulator2DProps {
  lang: Language;
  spots: ParkingSpot[];
  onParkVehicle: (spotId: string, vehicleType: VehicleType, plate: string) => void;
  onAddSpot: () => ParkingSpot;
  smokeAlert: boolean;
  weather: WeatherCondition2D;
  onChangeWeather: (weather: WeatherCondition2D) => void;
  ecoConservation: boolean;
  bessCharge: number;
  smartNightActive?: boolean;
  nightPowerReductionPct?: number;
  onTriggerCarArrival?: (type: VehicleType) => void;
  onAutoDispatchRobot?: (spotId: string, plate: string, deliveredKwh?: number) => void;
  onRushEvent?: (msg: string) => void;
  activeMergedEvent?: ActiveMergedEventState | null;
  activeMergedTour?: ActiveMergedTourState | null;
}

interface MistingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface WindStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface WeatherTrendPoint {
  tickLabel: string;
  solarKw: number;
  consumptionKw: number;
  efficiencyPct: number;
}

function getSpot2DCoords(spot: ParkingSpot, allSpots: ParkingSpot[]): { x: number; y: number; bw: number } {
  const topSpots = allSpots.filter((s) => s.row === 'top');
  const bottomSpots = allSpots.filter((s) => s.row === 'bottom');
  const cols = Math.max(5, topSpots.length, bottomSpots.length);
  const rowList = spot.row === 'top' ? topSpots : bottomSpots;
  const idx = Math.max(0, rowList.findIndex((s) => s.id === spot.id));
  const xStart = 140;
  const xEnd = 740;
  const step = cols > 1 ? (xEnd - xStart) / (cols - 1) : 0;
  const bw = Math.min(96, Math.max(54, Math.floor(step - 12)));
  const x = cols === 1 ? 440 : xStart + idx * step;
  const y = spot.row === 'top' ? 110 : 330;
  return { x, y, bw };
}

export const Simulator2D: React.FC<Simulator2DProps> = ({
  lang,
  spots,
  onParkVehicle,
  onAddSpot,
  smokeAlert,
  weather,
  onChangeWeather,
  ecoConservation,
  bessCharge,
  smartNightActive = false,
  nightPowerReductionPct = 40,
  onTriggerCarArrival,
  onAutoDispatchRobot,
  onRushEvent,
  activeMergedEvent = null,
  activeMergedTour = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);
  const [isPaused, setIsPaused] = useState(false);
  const [showMisting, setShowMisting] = useState(true);
  const [showThermal, setShowThermal] = useState(true);
  const [activeCars, setActiveCars] = useState<SimCar[]>([]);
  const [wavePhase, setWavePhase] = useState(0);
  const [telemetry, setTelemetry] = useState({
    arrivalSeconds: 6.4,
    distanceSavedM: 145,
    co2SavedG: 428,
    targetSpotLabel: 'A-01',
  });

  // Rush Hour Traffic Simulation State
  const [trafficSimRunning, setTrafficSimRunning] = useState(false);
  const [arrivalRatePerMin, setArrivalRatePerMin] = useState<number>(10);
  const [rushScenario, setRushScenario] = useState<'morning_ev' | 'evening_peak' | 'mixed'>('morning_ev');
  const [autoExpandRush, setAutoExpandRush] = useState(true);
  const [autoDispatchRobotRush, setAutoDispatchRobotRush] = useState(true);
  const [rushStats, setRushStats] = useState({
    dispatchedCount: 0,
    autoExpandedCount: 0,
    robotDispatchedCount: 0,
  });
  const [rushEvents, setRushEvents] = useState<
    { id: string; time: string; msg: string; kind: 'arrival' | 'expand' | 'robot' }[]
  >([]);

  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  const mistingRef = useRef(showMisting);
  mistingRef.current = showMisting;
  const thermalRef = useRef(showThermal);
  thermalRef.current = showThermal;
  const smokeRef = useRef(smokeAlert);
  smokeRef.current = smokeAlert;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const ecoRef = useRef(ecoConservation);
  ecoRef.current = ecoConservation;
  const effectiveNightReduction = smartNightActive ? nightPowerReductionPct : 0;
  const nightReductionRef = useRef(effectiveNightReduction);
  nightReductionRef.current = effectiveNightReduction;

  const carsRef = useRef<SimCar[]>([]);
  const particlesRef = useRef<MistingParticle[]>([]);
  const raindropsRef = useRef<RainDrop[]>([]);
  const windStreaksRef = useRef<WindStreak[]>([]);
  const activeSimRobotRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    bayLabel: string;
    plate: string;
    phase: 'lane_out' | 'docking' | 'charging' | 'undocking' | 'returning';
    chargeTimer: number;
  } | null>(null);

  const availableCount = spots.filter((s) => s.status === 'available').length;

  const thermalStats = useMemo(
    () => computeLotThermalStats(spots, showMisting, smokeAlert, weather),
    [spots, showMisting, smokeAlert, weather]
  );

  const weatherEnergy = useMemo(
    () =>
      computeWeatherEnergyProfile(
        weather,
        spots,
        showMisting,
        ecoConservation,
        wavePhase,
        effectiveNightReduction
      ),
    [weather, spots, showMisting, ecoConservation, wavePhase, effectiveNightReduction]
  );

  const [trendSeries, setTrendSeries] = useState<WeatherTrendPoint[]>(() => {
    const initial = computeWeatherEnergyProfile(weather, spots, showMisting, ecoConservation, 0);
    return Array.from({ length: 12 }, (_, idx) => ({
      tickLabel: `-${(11 - idx) * 2}s`,
      solarKw: initial.solarOutputKw,
      consumptionKw: initial.totalConsumptionKw,
      efficiencyPct: initial.solarEfficiencyPct,
    }));
  });

  // Real-time weather & load telemetry ticker (every 1.2s scaled cleanly)
  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setWavePhase((prev) => prev + 0.55);
    }, Math.max(500, Math.round(1400 / speed)));
    return () => window.clearInterval(timer);
  }, [isPaused, speed]);

  // Append live snapshot to chart whenever weather, spots, ecoConservation, misting, smart night, or wavePhase updates
  useEffect(() => {
    const snap = computeWeatherEnergyProfile(
      weather,
      spots,
      showMisting,
      ecoConservation,
      wavePhase,
      effectiveNightReduction
    );
    const nowLabel = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      minute: '2-digit',
      second: '2-digit',
    });
    setTrendSeries((prev) => [
      ...prev.slice(-13),
      {
        tickLabel: nowLabel,
        solarKw: snap.solarOutputKw,
        consumptionKw: snap.totalConsumptionKw,
        efficiencyPct: snap.solarEfficiencyPct,
      },
    ]);
  }, [weather, spots, showMisting, ecoConservation, wavePhase, effectiveNightReduction, lang]);

  const appendRushEvent = (
    msg: string,
    kind: 'arrival' | 'expand' | 'robot'
  ) => {
    const time = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setRushEvents((prev) =>
      [
        {
          id: `re-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          time,
          msg,
          kind,
        },
        ...prev,
      ].slice(0, 6)
    );
  };

  const launchVehicle = (
    vehicleType: VehicleType,
    options?: { silent?: boolean; forceExpandOnFull?: boolean }
  ): { target: ParkingSpot; plate: string; autoExpanded: boolean } | null => {
    const available = spotsRef.current.filter((s) => s.status === 'available');
    let target =
      vehicleType === 'ELECTRIC'
        ? available.find((s) => s.hasCharger) || available[0]
        : vehicleType === 'HYBRID'
          ? available.find((s) => s.zone === 'Eco-Hybrid') || available[0]
          : available[0];

    let allSpotsForCoord = spotsRef.current;
    let autoExpanded = false;
    if (!target) {
      if (options?.forceExpandOnFull === false || spotsRef.current.length >= 24) {
        return null;
      }
      target = onAddSpot();
      allSpotsForCoord = [...spotsRef.current, target];
      autoExpanded = true;
    }

    const { x: tx, y: ty } = getSpot2DCoords(target, allSpotsForCoord);
    const spec = VEHICLE_SPECS[vehicleType];
    const distSavedKm = Math.max(0.15, (180 - target.distanceFromGateMeters) / 1000 + 0.18);
    const timeSavedMin = 2.4;
    const savings = calculateCarbonSavings(vehicleType, distSavedKm, timeSavedMin);
    const randomDigits = Math.floor(1000 + Math.random() * 8999);
    const plate = `س ص م ${randomDigits}`;

    const newCar: SimCar = {
      id: `sim-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      plate,
      vehicleType,
      targetSpotId: target.id,
      x: 840,
      y: 220,
      targetX: tx,
      targetY: ty,
      angle: Math.PI,
      phase: 'entering',
      color: spec.carColorHex,
      distanceSavedM: Math.round(distSavedKm * 1000),
      co2SavedG: Math.round(savings.co2SavedKg * 1000),
      arrivalSeconds: Number((target.distanceFromGateMeters / 5.2).toFixed(1)),
    };

    carsRef.current = [...carsRef.current.filter((c) => c.phase !== 'parked').slice(-5), newCar];
    setActiveCars(carsRef.current);
    setTelemetry({
      arrivalSeconds: newCar.arrivalSeconds,
      distanceSavedM: newCar.distanceSavedM,
      co2SavedG: newCar.co2SavedG,
      targetSpotLabel: target.label,
    });

    if (!options?.silent) {
      playHydraulicGateSound();
      speakGuidance(
        lang === 'ar'
          ? `أهلاً بك، يرجى التوجه عبر المسار الأخضر إلى الموقف ${target.label}`
          : `Welcome. Follow the green eco-route to bay ${target.label}`,
        lang
      );
    }

    if (onTriggerCarArrival) {
      onTriggerCarArrival(vehicleType);
    }

    return { target, plate, autoExpanded };
  };

  const handleManualAddSpot = () => {
    const newSpot = onAddSpot();
    setTelemetry((prev) => ({
      ...prev,
      targetSpotLabel: newSpot.label,
    }));
  };

  const handleReset = () => {
    setTrafficSimRunning(false);
    activeSimRobotRef.current = null;
    carsRef.current = [];
    setActiveCars([]);
    setIsPaused(false);
    setRushStats({ dispatchedCount: 0, autoExpandedCount: 0, robotDispatchedCount: 0 });
    setRushEvents([]);
    setTelemetry({
      arrivalSeconds: 6.4,
      distanceSavedM: 145,
      co2SavedG: 428,
      targetSpotLabel: spotsRef.current[0]?.label || 'A-01',
    });
  };

  // Live Rush Hour Traffic Simulation Interval
  useEffect(() => {
    if (!trafficSimRunning || isPaused) return;
    const intervalMs = Math.max(950, Math.round(60000 / Math.max(2, arrivalRatePerMin)));

    const pickVehicleType = (): VehicleType => {
      const r = Math.random();
      if (rushScenario === 'morning_ev') {
        if (r < 0.65) return 'ELECTRIC';
        if (r < 0.90) return 'HYBRID';
        return 'GASOLINE';
      }
      if (rushScenario === 'evening_peak') {
        if (r < 0.45) return 'ELECTRIC';
        if (r < 0.70) return 'HYBRID';
        if (r < 0.90) return 'GASOLINE';
        return 'DIESEL';
      }
      if (r < 0.35) return 'ELECTRIC';
      if (r < 0.65) return 'HYBRID';
      if (r < 0.90) return 'GASOLINE';
      return 'DIESEL';
    };

    const timer = window.setInterval(() => {
      const vt = pickVehicleType();
      const result = launchVehicle(vt, {
        silent: true,
        forceExpandOnFull: autoExpandRush,
      });

      if (!result) {
        appendRushEvent(
          t(
            lang,
            'الساحة ممتلئة — فعّل التوسيع التلقائي لإضافة مواقف إضافية.',
            'Parking lot full — enable Auto Bay Expansion to handle surge.'
          ),
          'expand'
        );
        setTrafficSimRunning(false);
        return;
      }

      const { target, plate, autoExpanded } = result;
      setRushStats((prev) => ({
        dispatchedCount: prev.dispatchedCount + 1,
        autoExpandedCount: prev.autoExpandedCount + (autoExpanded ? 1 : 0),
        robotDispatchedCount: prev.robotDispatchedCount,
      }));

      if (autoExpanded) {
        const expandMsg = t(
          lang,
          `توسيع تلقائي للمواقف (+1 موقف ${target.label}) استجابةً لذروة الوصول`,
          `Auto bay expansion triggered (+1 bay ${target.label}) for rush surge`
        );
        appendRushEvent(expandMsg, 'expand');
        onRushEvent?.(expandMsg);
      } else {
        appendRushEvent(
          t(
            lang,
            `وصول ذروة: توجيه ${plate} (${VEHICLE_SPECS[vt].labelAr}) → ${target.label}`,
            `Rush arrival: routed ${plate} (${VEHICLE_SPECS[vt].labelEn}) → ${target.label}`
          ),
          'arrival'
        );
      }

      // Trigger autonomous EcoCharge Bot X1 for EVs on non-charger bays or high-demand EV arrivals
      const shouldDispatchBot =
        autoDispatchRobotRush &&
        vt === 'ELECTRIC' &&
        (!target.hasCharger || Math.random() < 0.55);

      if (shouldDispatchBot) {
        const allWithTarget = spotsRef.current.some((s) => s.id === target.id)
          ? spotsRef.current
          : [...spotsRef.current, target];
        const { x: rx, y: ry } = getSpot2DCoords(target, allWithTarget);
        const deliveredKwh = Number((18 + Math.random() * 16).toFixed(1));
        activeSimRobotRef.current = {
          active: true,
          x: 68,
          y: 220,
          targetX: rx,
          targetY: ry,
          bayLabel: target.label,
          plate,
          phase: 'lane_out',
          chargeTimer: 0,
        };
        setRushStats((prev) => ({
          ...prev,
          robotDispatchedCount: prev.robotDispatchedCount + 1,
        }));
        onAutoDispatchRobot?.(target.id, plate, deliveredKwh);
        appendRushEvent(
          t(
            lang,
            `انطلاق EcoCharge Bot X1 آلياً إلى ${target.label} لشحن ${plate} (${deliveredKwh} kWh)`,
            `EcoCharge Bot X1 auto-dispatched to ${target.label} for ${plate} (${deliveredKwh} kWh)`
          ),
          'robot'
        );
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    trafficSimRunning,
    isPaused,
    arrivalRatePerMin,
    rushScenario,
    autoExpandRush,
    autoDispatchRobotRush,
    lang,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    let dashOffset = 0;

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 42; i++) {
        particlesRef.current.push({
          x: 130 + Math.random() * 620,
          y: 60 + Math.random() * 320,
          vx: (Math.random() - 0.5) * 14,
          vy: -8 - Math.random() * 14,
          life: Math.random() * 2,
          maxLife: 1.5 + Math.random() * 1.5,
          r: 1.5 + Math.random() * 2.5,
        });
      }
    }

    if (raindropsRef.current.length === 0) {
      for (let i = 0; i < 160; i++) {
        raindropsRef.current.push({
          x: Math.random() * 880,
          y: Math.random() * 430,
          len: 10 + Math.random() * 14,
          speed: 260 + Math.random() * 200,
          alpha: 0.25 + Math.random() * 0.45,
        });
      }
    }

    if (windStreaksRef.current.length === 0) {
      for (let i = 0; i < 24; i++) {
        windStreaksRef.current.push({
          x: Math.random() * 880,
          y: 25 + Math.random() * 380,
          len: 50 + Math.random() * 85,
          speed: 280 + Math.random() * 240,
          alpha: 0.14 + Math.random() * 0.22,
        });
      }
    }

    const render = (now: number) => {
      const rawDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const dt = pausedRef.current ? 0 : rawDt * speedRef.current;

      const W = canvas.width;
      const H = canvas.height;
      const curWeather = weatherRef.current;
      ctx.clearRect(0, 0, W, H);

      // Background Asphalt conditioned by Weather
      ctx.fillStyle =
        curWeather === 'stormy' ? '#050E18' : curWeather === 'rainy' ? '#071422' : '#081521';
      ctx.fillRect(0, 0, W, H);

      // Subtle asphalt grid texture
      ctx.strokeStyle =
        curWeather === 'sunny' ? 'rgba(255, 255, 255, 0.035)' : 'rgba(148, 163, 184, 0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // Wet tarmac puddle reflections when Rainy or Stormy
      if (curWeather === 'rainy' || curWeather === 'stormy') {
        const puddleAlpha = curWeather === 'stormy' ? 0.14 : 0.09;
        [
          { cx: 240, cy: 215, rx: 72, ry: 16 },
          { cx: 480, cy: 224, rx: 94, ry: 18 },
          { cx: 660, cy: 212, rx: 64, ry: 14 },
        ].forEach((puddle) => {
          ctx.fillStyle = `rgba(56, 189, 248, ${puddleAlpha})`;
          ctx.beginPath();
          ctx.ellipse(puddle.cx, puddle.cy, puddle.rx, puddle.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      const currentSpots = spotsRef.current;
      const liveThermal = computeLotThermalStats(
        currentSpots,
        mistingRef.current,
        smokeRef.current,
        curWeather
      );
      const liveWeatherEnergy = computeWeatherEnergyProfile(
        curWeather,
        currentSpots,
        mistingRef.current,
        ecoRef.current,
        now * 0.002,
        nightReductionRef.current
      );
      const occupiedRatio =
        currentSpots.filter((s) => s.status !== 'available').length /
        Math.max(currentSpots.length, 1);

      // Data-Bound Thermal Heatmap Layer
      if (thermalRef.current) {
        const canopyHeatAlpha = 0.16 + occupiedRatio * 0.22;
        const coolTop = ctx.createLinearGradient(90, 45, 760, 175);
        coolTop.addColorStop(0, `rgba(6, 182, 212, ${canopyHeatAlpha})`);
        coolTop.addColorStop(
          0.5,
          occupiedRatio > 0.65
            ? `rgba(245, 158, 11, ${canopyHeatAlpha})`
            : `rgba(16, 185, 129, ${canopyHeatAlpha})`
        );
        coolTop.addColorStop(1, `rgba(6, 182, 212, ${canopyHeatAlpha})`);
        ctx.fillStyle = coolTop;
        ctx.fillRect(85, 45, 705, 130);

        const coolBot = ctx.createLinearGradient(90, 265, 760, 395);
        coolBot.addColorStop(0, `rgba(16, 185, 129, ${canopyHeatAlpha})`);
        coolBot.addColorStop(
          0.5,
          occupiedRatio > 0.65
            ? `rgba(245, 158, 11, ${canopyHeatAlpha})`
            : `rgba(6, 182, 212, ${canopyHeatAlpha})`
        );
        coolBot.addColorStop(1, `rgba(16, 185, 129, ${canopyHeatAlpha})`);
        ctx.fillStyle = coolBot;
        ctx.fillRect(85, 265, 705, 130);

        const laneAlpha = 0.14 + occupiedRatio * 0.36;
        const laneGrad = ctx.createLinearGradient(85, 182, 805, 258);
        laneGrad.addColorStop(0, `rgba(245, 158, 11, ${laneAlpha})`);
        laneGrad.addColorStop(0.5, `rgba(239, 68, 68, ${laneAlpha + 0.08})`);
        laneGrad.addColorStop(1, `rgba(245, 158, 11, ${laneAlpha})`);
        ctx.fillStyle = laneGrad;
        ctx.fillRect(85, 182, 725, 76);

        currentSpots.forEach((spot) => {
          const { x, y } = getSpot2DCoords(spot, currentSpots);
          const bayInfo = liveThermal.bayTemps[spot.id];
          if (!bayInfo) return;

          if (spot.status === 'available' && !(smokeRef.current && spot.id === 'B-04')) {
            const gCool = ctx.createRadialGradient(x, y, 4, x, y, 40);
            gCool.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
            gCool.addColorStop(1, 'rgba(6, 182, 212, 0)');
            ctx.fillStyle = gCool;
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.fill();
            return;
          }

          const radius = bayInfo.level === 'critical' ? 74 : bayInfo.level === 'hot' ? 64 : 50;
          const g = ctx.createRadialGradient(x, y, 6, x, y, radius);
          if (bayInfo.level === 'critical' || bayInfo.level === 'hot') {
            g.addColorStop(0, 'rgba(239, 68, 68, 0.72)');
            g.addColorStop(0.45, 'rgba(249, 115, 22, 0.42)');
            g.addColorStop(0.75, 'rgba(245, 158, 11, 0.18)');
            g.addColorStop(1, 'rgba(245, 158, 11, 0)');
          } else if (bayInfo.level === 'warm') {
            g.addColorStop(0, 'rgba(245, 158, 11, 0.50)');
            g.addColorStop(0.6, 'rgba(16, 185, 129, 0.16)');
            g.addColorStop(1, 'rgba(16, 185, 129, 0)');
          } else {
            g.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
            g.addColorStop(1, 'rgba(6, 182, 212, 0)');
          }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Photovoltaic Solar Canopy Array Strip (Top & Bottom Canopy Borders)
      const pvAlpha =
        curWeather === 'sunny' ? 0.85 : curWeather === 'rainy' ? 0.35 : 0.22;
      const pvFill =
        curWeather === 'sunny'
          ? `rgba(245, 158, 11, ${pvAlpha * 0.28})`
          : curWeather === 'rainy'
            ? `rgba(56, 189, 248, ${pvAlpha * 0.25})`
            : `rgba(148, 163, 184, ${pvAlpha * 0.24})`;
      const pvStroke =
        curWeather === 'sunny'
          ? `rgba(251, 191, 36, ${pvAlpha})`
          : curWeather === 'rainy'
            ? `rgba(56, 189, 248, ${pvAlpha})`
            : `rgba(245, 158, 11, ${0.5 + 0.3 * Math.sin(now * 0.008)})`;

      [18, 396].forEach((barY) => {
        ctx.fillStyle = pvFill;
        ctx.strokeStyle = pvStroke;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.roundRect(105, barY, 670, 16, 4);
        ctx.fill();
        ctx.stroke();

        // PV cell grid divisions
        ctx.strokeStyle =
          curWeather === 'sunny' ? 'rgba(253, 224, 71, 0.35)' : 'rgba(148, 163, 184, 0.18)';
        for (let px = 135; px < 765; px += 30) {
          ctx.beginPath();
          ctx.moveTo(px, barY + 2);
          ctx.lineTo(px, barY + 14);
          ctx.stroke();
        }
      });

      ctx.fillStyle = curWeather === 'sunny' ? '#FDE047' : curWeather === 'rainy' ? '#7DD3FC' : '#FBBF24';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `PV ARRAY: ${liveWeatherEnergy.solarEfficiencyPct}% · ${liveWeatherEnergy.solarOutputKw} kW`,
        440,
        29
      );

      // Green Sustainable Environment: Perimeter Biophilic Bioswales & Shade Eco-Trees
      [5, 417].forEach((beltY) => {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(105, beltY, 670, 8, 4);
        ctx.fill();
        ctx.stroke();

        for (let tx = 130; tx <= 750; tx += 78) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.52)';
          ctx.beginPath();
          ctx.arc(tx, beltY + 4, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(110, 231, 183, 0.78)';
          ctx.beginPath();
          ctx.arc(tx - 1.5, beltY + 3.2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Central driving lane
      ctx.fillStyle = thermalRef.current ? 'rgba(13, 32, 48, 0.50)' : '#0D2030';
      ctx.fillRect(80, 182, 740, 76);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(95, 220);
      ctx.lineTo(805, 220);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Parking Bays dynamically
      currentSpots.forEach((spot) => {
        const { x, y, bw } = getSpot2DCoords(spot, currentSpots);
        const bh = 68;
        const bx = x - bw / 2;
        const by = y - bh / 2;

        if (spot.status === 'available') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
        } else if (spot.status === 'reserved') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        }

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.stroke();

        // Bay label
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(spot.label, x, spot.row === 'top' ? by - 8 : by + bh + 16);

        // Live Thermal Temp Readout per Bay when Thermal Heatmap is ON
        if (thermalRef.current) {
          const bayInfo = liveThermal.bayTemps[spot.id];
          if (bayInfo) {
            ctx.fillStyle =
              bayInfo.level === 'critical' || bayInfo.level === 'hot'
                ? '#FCA5A5'
                : bayInfo.level === 'warm'
                  ? '#FDE047'
                  : '#67E8F9';
            ctx.font = '700 9px "JetBrains Mono", monospace';
            ctx.fillText(
              `${bayInfo.tempC}°C`,
              x,
              spot.row === 'top' ? by - 22 : by + bh + 29
            );
          }
        }

        // EV charger badge
        if (spot.hasCharger) {
          ctx.fillStyle = '#06B6D4';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillText(`⚡${spot.chargerKw}kW`, x, spot.row === 'top' ? by + 13 : by + bh - 6);
        }

        // Parked car silhouette
        if (spot.status === 'occupied' || spot.status === 'reserved') {
          const carCol =
            spot.status === 'reserved'
              ? '#F59E0B'
              : spot.vehicleType === 'ELECTRIC'
                ? '#06B6D4'
                : spot.vehicleType === 'HYBRID'
                  ? '#10B981'
                  : '#EF4444';
          const carW = Math.min(58, bw - 14);
          ctx.fillStyle = carCol;
          ctx.beginPath();
          ctx.roundRect(x - carW / 2, y - 15, carW, 30, 6);
          ctx.fill();
          ctx.fillStyle = '#091420';
          ctx.beginPath();
          ctx.roundRect(x - carW * 0.24, y - 11, carW * 0.44, 22, 3);
          ctx.fill();
        }
      });

      // Glowing Green Eco-Navigation Path to next target or active car's target
      const activeMovingCar = carsRef.current.find((c) => c.phase !== 'parked');
      const highlightSpot =
        (activeMovingCar && currentSpots.find((s) => s.id === activeMovingCar.targetSpotId)) ||
        currentSpots.find((s) => s.status === 'available') ||
        currentSpots[0];

      if (highlightSpot) {
        const { x: hx, y: hy } = getSpot2DCoords(highlightSpot, currentSpots);
        dashOffset -= dt * 36;
        ctx.save();
        ctx.strokeStyle = '#14D896';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 12;
        ctx.setLineDash([12, 10]);
        ctx.lineDashOffset = dashOffset;
        ctx.beginPath();
        ctx.moveTo(815, 220);
        ctx.lineTo(hx, 220);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        const beaconPhase = (now * 0.0022) % 1;
        const beaconRadius = 16 + beaconPhase * 28;
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(20, 216, 150, ${(1 - beaconPhase) * 0.75})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hx, hy, beaconRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Smart Entry Gate (Right side)
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.roundRect(820, 192, 42, 56, 6);
      ctx.fill();
      ctx.fillStyle = '#08121D';
      ctx.font = '700 10px "Cairo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ANPR', 841, 224);

      // BESS Station on left
      ctx.fillStyle = '#12263A';
      ctx.strokeStyle = liveWeatherEnergy.netBalanceKw >= 0 ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(22, 178, 48, 84, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = liveWeatherEnergy.netBalanceKw >= 0 ? '#10B981' : '#F59E0B';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText('BESS', 46, 216);
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillText(liveWeatherEnergy.netBalanceKw >= 0 ? 'CHG +' : 'SUP -', 46, 232);

      // Update & draw moving cars
      carsRef.current = carsRef.current.map((car) => {
        if (car.phase === 'parked' || dt === 0) return car;
        const speedPx = 145 * dt;
        let { x, y, angle } = car;
        let phase: SimCar['phase'] = car.phase;

        if (phase === 'entering') {
          x -= speedPx;
          angle = Math.PI;
          if (x <= 780) {
            phase = 'lane';
          }
        } else if (phase === 'lane') {
          const dx = car.targetX - x;
          if (Math.abs(dx) <= speedPx) {
            x = car.targetX;
            phase = 'turning';
            angle = car.targetY < 220 ? -Math.PI / 2 : Math.PI / 2;
          } else {
            x += Math.sign(dx) * speedPx;
            angle = dx < 0 ? Math.PI : 0;
          }
        } else if (phase === 'turning') {
          const dy = car.targetY - y;
          if (Math.abs(dy) <= speedPx) {
            y = car.targetY;
            phase = 'parked';
            onParkVehicle(car.targetSpotId, car.vehicleType, car.plate);
          } else {
            y += Math.sign(dy) * speedPx;
          }
        }

        return { ...car, x, y, phase, angle };
      });

      carsRef.current.forEach((car) => {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(-24, -13, 52, 30, 7);
        ctx.fill();
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-26, -14, 52, 28, 7);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(2, -10, 14, 20, 3);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(23, -11, 3, 5);
        ctx.fillRect(23, 6, 3, 5);
        ctx.restore();
      });

      // Autonomous EcoCharge Bot X1 Rover Animation during Rush Hour Dispatch
      const bot = activeSimRobotRef.current;
      if (bot && bot.active) {
        const botSpeed = 165 * dt;
        const dockStopY = bot.targetY < 220 ? bot.targetY + 42 : bot.targetY - 42;

        if (dt > 0) {
          if (bot.phase === 'lane_out') {
            const dx = bot.targetX - bot.x;
            if (Math.abs(dx) <= botSpeed) {
              bot.x = bot.targetX;
              bot.phase = 'docking';
            } else {
              bot.x += Math.sign(dx) * botSpeed;
            }
          } else if (bot.phase === 'docking') {
            const dy = dockStopY - bot.y;
            if (Math.abs(dy) <= botSpeed) {
              bot.y = dockStopY;
              bot.phase = 'charging';
              bot.chargeTimer = 0;
            } else {
              bot.y += Math.sign(dy) * botSpeed;
            }
          } else if (bot.phase === 'charging') {
            bot.chargeTimer += rawDt;
            if (bot.chargeTimer >= 1.25) {
              bot.phase = 'undocking';
            }
          } else if (bot.phase === 'undocking') {
            const dy = 220 - bot.y;
            if (Math.abs(dy) <= botSpeed) {
              bot.y = 220;
              bot.phase = 'returning';
            } else {
              bot.y += Math.sign(dy) * botSpeed;
            }
          } else if (bot.phase === 'returning') {
            const dx = 68 - bot.x;
            if (Math.abs(dx) <= botSpeed) {
              activeSimRobotRef.current = null;
            } else {
              bot.x += Math.sign(dx) * botSpeed;
            }
          }
        }

        if (activeSimRobotRef.current) {
          ctx.save();
          // Charging beam when docked
          if (bot.phase === 'charging') {
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.015);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + pulse * 0.55})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(bot.x, bot.y);
            ctx.lineTo(bot.targetX, bot.targetY);
            ctx.stroke();

            ctx.strokeStyle = `rgba(16, 185, 129, ${0.4 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bot.targetX, bot.targetY, 16 + pulse * 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Robot Chassis
          ctx.fillStyle = '#0891B2';
          ctx.strokeStyle = '#67E8F9';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bot.x - 13, bot.y - 10, 26, 20, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0F172A';
          ctx.font = '700 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('BOT', bot.x, bot.y + 3);
          ctx.restore();
        }
      }

      // Water Misting Particles
      if (mistingRef.current) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.x = 140 + Math.random() * 600;
            p.y = 140 + Math.random() * 200;
            p.life = 0;
          }
          const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.45;
          ctx.fillStyle = `rgba(103, 232, 249, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Dynamic Weather Particles Overlay (Sunny beams / Rainy drops / Stormy gusts & rain)
      if (curWeather === 'sunny') {
        const sunGrad = ctx.createLinearGradient(0, 0, 340, 260);
        sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.14)');
        sunGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.04)');
        sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, W, H);
      } else {
        const isStorm = curWeather === 'stormy';
        const activeDrops = isStorm ? raindropsRef.current.length : 95;
        const slantX = isStorm ? -0.42 : -0.16;

        // Atmospheric overcast tint
        ctx.fillStyle = isStorm ? 'rgba(15, 23, 42, 0.22)' : 'rgba(14, 116, 144, 0.07)';
        ctx.fillRect(0, 0, W, H);

        ctx.lineWidth = isStorm ? 1.4 : 1.05;
        for (let i = 0; i < activeDrops; i++) {
          const d = raindropsRef.current[i];
          const fall = d.speed * (isStorm ? 1.4 : 1.0) * dt;
          d.y += fall;
          d.x += fall * slantX;
          if (d.y > H) {
            d.y = -15;
            d.x = Math.random() * (W + 140);
          }
          if (d.x < -30) {
            d.x = W + 20;
          }
          ctx.strokeStyle = isStorm
            ? `rgba(186, 230, 253, ${Math.min(0.75, d.alpha + 0.18)})`
            : `rgba(125, 211, 252, ${d.alpha})`;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.len * slantX, d.y + d.len);
          ctx.stroke();
        }

        if (isStorm) {
          // Animated wind-gust ribbons sweeping across the lot
          windStreaksRef.current.forEach((w) => {
            w.x -= w.speed * dt;
            if (w.x + w.len < 0) {
              w.x = W + Math.random() * 120;
              w.y = 25 + Math.random() * (H - 50);
            }
            const gWind = ctx.createLinearGradient(w.x, w.y, w.x + w.len, w.y + 8);
            gWind.addColorStop(0, 'rgba(226, 232, 240, 0)');
            gWind.addColorStop(0.5, `rgba(226, 232, 240, ${w.alpha})`);
            gWind.addColorStop(1, 'rgba(226, 232, 240, 0)');
            ctx.strokeStyle = gWind;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(w.x, w.y);
            ctx.lineTo(w.x + w.len, w.y + 8);
            ctx.stroke();
          });

          // Periodic brief high-altitude storm lightning shimmer along upper edge
          const flashWindow = (now * 0.00045) % 1;
          if (flashWindow > 0.96) {
            ctx.fillStyle = 'rgba(224, 242, 254, 0.12)';
            ctx.fillRect(0, 0, W, H);
          }
        }
      }

      // Thermal Scale Legend in Canvas when active
      if (thermalRef.current) {
        ctx.fillStyle = 'rgba(8, 18, 29, 0.90)';
        ctx.beginPath();
        ctx.roundRect(14, 386, 265, 30, 6);
        ctx.fill();
        const scaleGrad = ctx.createLinearGradient(56, 0, 178, 0);
        scaleGrad.addColorStop(0, '#06b6d4');
        scaleGrad.addColorStop(0.5, '#f59e0b');
        scaleGrad.addColorStop(1, '#ef4444');
        ctx.fillStyle = scaleGrad;
        ctx.fillRect(56, 396, 122, 9);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('24°C', 20, 405);
        ctx.fillText(`48°C · ${liveThermal.congestionIndexPct}%`, 184, 405);
      }

      // Smoke/Fire Radar Overlay if active
      if (smokeRef.current) {
        const pulse = 0.25 + Math.abs(Math.sin(now * 0.006)) * 0.3;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.beginPath();
        ctx.arc(570, 330, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [onParkVehicle]);

  const weatherSpec = WEATHER_PROFILES[weather];

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">
            {t(lang, 'إطلاق مركبة:', 'Launch Vehicle:')}
          </span>
          {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
            <button
              key={vt}
              onClick={() => launchVehicle(vt)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12263A] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/50 hover:bg-emerald-500/15 whitespace-nowrap shrink-0"
            >
              <Zap className="h-3.5 w-3.5" style={{ color: VEHICLE_SPECS[vt].badgeColor }} />
              {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
            </button>
          ))}

          <button
            type="button"
            onClick={handleManualAddSpot}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 ${
              availableCount === 0
                ? 'eco-amber-flash border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {availableCount === 0
              ? t(lang, 'المواقف ممتلئة · إضافة موقف جديد', 'Lot Full · + Add New Bay')
              : t(lang, '+ إضافة موقف (2D & 3D)', '+ Add Bay (2D & 3D)')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Weather Condition Selector */}
          <div
            role="group"
            aria-label={t(lang, 'الظروف الجوية', 'Weather Condition')}
            className="flex items-center rounded-lg border border-white/10 bg-[#08121D] p-1 gap-1"
          >
            <button
              type="button"
              onClick={() => onChangeWeather('sunny')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap ${
                weather === 'sunny'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              {t(lang, 'مشمس', 'Sunny')}
            </button>
            <button
              type="button"
              onClick={() => onChangeWeather('rainy')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap ${
                weather === 'rainy'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <CloudRain className="h-3.5 w-3.5" />
              {t(lang, 'ممطر', 'Rainy')}
            </button>
            <button
              type="button"
              onClick={() => onChangeWeather('stormy')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap ${
                weather === 'stormy'
                  ? 'bg-indigo-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <CloudLightning className="h-3.5 w-3.5" />
              {t(lang, 'عاصف', 'Stormy')}
            </button>
          </div>

          <div className="flex items-center rounded-lg border border-white/10 bg-[#08121D] p-1">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition ${
                  speed === spd
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12263A] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5 text-amber-400" />}
            {isPaused ? t(lang, 'استئناف', 'Resume') : t(lang, 'إيقاف', 'Pause')}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12263A] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t(lang, 'إعادة', 'Reset')}
          </button>

          <button
            onClick={() => setShowMisting((m) => !m)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              showMisting
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                : 'border-white/10 bg-[#12263A] text-slate-400'
            }`}
          >
            <Droplets className="h-3.5 w-3.5" />
            {t(lang, 'رذاذ التبريد', 'Misting')}
          </button>

          <button
            onClick={() => setShowThermal((th) => !th)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              showThermal
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                : 'border-white/10 bg-[#12263A] text-slate-400'
            }`}
          >
            <ThermometerSun className="h-3.5 w-3.5" />
            {t(lang, 'الخريطة الحرارية 2D', '2D Thermal Map')}
          </button>
        </div>
      </div>

      {/* Live Weather Impact on Solar & Power Consumption Strip */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-7">
          {/* Solar Panel Efficiency */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t(lang, 'كفاءة الألواح الشمسية', 'Solar Canopy Efficiency')}</span>
              <Sun
                className={`h-4 w-4 ${
                  weather === 'sunny'
                    ? 'text-amber-400'
                    : weather === 'rainy'
                      ? 'text-sky-400'
                      : 'text-slate-400'
                }`}
              />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${
                  weatherEnergy.solarEfficiencyPct >= 70
                    ? 'text-amber-400'
                    : weatherEnergy.solarEfficiencyPct >= 25
                      ? 'text-sky-400'
                      : 'text-rose-400'
                }`}
              >
                {weatherEnergy.solarEfficiencyPct}%
              </span>
              <span className="font-mono text-xs text-slate-300 tabular-nums">
                ({weatherEnergy.solarOutputKw} kW)
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  weather === 'sunny'
                    ? 'bg-amber-400'
                    : weather === 'rainy'
                      ? 'bg-sky-400'
                      : 'bg-rose-400'
                }`}
                style={{ width: `${weatherEnergy.solarEfficiencyPct}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400 tabular-nums">
              {t(
                lang,
                `الإشعاع الشمسي: ${weatherEnergy.irradianceWm2} W/m²`,
                `Irradiance: ${weatherEnergy.irradianceWm2} W/m²`
              )}
            </div>
          </div>

          {/* Instantaneous Power Consumption */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t(lang, 'معدل استهلاك الطاقة اللحظي', 'Instant Power Consumption')}</span>
              <Gauge className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-cyan-300 tabular-nums">
                {weatherEnergy.totalConsumptionKw}
              </span>
              <span className="font-mono text-xs text-slate-400">kW</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
              <span>
                {t(lang, `شواحن EV: ${weatherEnergy.evChargerLoadKw} kW`, `EV: ${weatherEnergy.evChargerLoadKw} kW`)}
              </span>
              <span>
                {t(lang, `مرافق: ${weatherEnergy.facilityLoadKw} kW`, `Lot: ${weatherEnergy.facilityLoadKw} kW`)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                {t(
                  lang,
                  `معامل الحمل الجوي: ${weatherSpec.consumptionMultiplier.toFixed(2)}x`,
                  `Weather Load Factor: ${weatherSpec.consumptionMultiplier.toFixed(2)}x`
                )}
              </span>
              {smartNightActive && (
                <span className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-300 tabular-nums">
                  <Moon className="h-3 w-3" />
                  -{nightPowerReductionPct}%
                </span>
              )}
            </div>
          </div>

          {/* Net Grid & BESS Flow */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t(lang, 'توازن الطاقة وتدفق BESS', 'Net Power & BESS Flow')}</span>
              <BatteryCharging
                className={`h-4 w-4 ${
                  weatherEnergy.netBalanceKw >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${
                  weatherEnergy.netBalanceKw >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {weatherEnergy.netBalanceKw >= 0 ? '+' : ''}
                {weatherEnergy.netBalanceKw}
              </span>
              <span className="font-mono text-xs text-slate-400">kW</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-300">
              {weatherEnergy.netBalanceKw >= 0
                ? t(lang, `فائض يغذي BESS (${bessCharge}%)`, `Surplus charging BESS (${bessCharge}%)`)
                : t(lang, `سحب تعويضي من BESS (${bessCharge}%)`, `Drawing backup from BESS (${bessCharge}%)`)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              <Wind className="h-3 w-3 text-slate-400" />
              <span>
                {t(
                  lang,
                  `الرياح ${weatherEnergy.windKmh} كم/س · ${weatherSpec.canopyModeAr}`,
                  `Wind ${weatherEnergy.windKmh} km/h · ${weatherSpec.canopyModeEn}`
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Weather Impact Chart */}
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 lg:col-span-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              {t(lang, 'المنحنى اللحظي: الإنتاج الشمسي مقابل الاستهلاك (kW)', 'Real-Time Solar Output vs. Load (kW)')}
            </span>
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? weatherSpec.labelAr : weatherSpec.labelEn}
            </span>
          </div>
          <div className="h-[108px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendSeries} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="sim2dSolarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sim2dLoadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="tickLabel" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#08121D',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value, name) => [
                    `${value ?? 0} kW`,
                    name === 'solarKw'
                      ? t(lang, 'الإنتاج الشمسي', 'Solar Output')
                      : t(lang, 'الاستهلاك اللحظي', 'Power Load'),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="solarKw"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fill="url(#sim2dSolarGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="consumptionKw"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fill="url(#sim2dLoadGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2D Canvas Stage */}
      <div
        className={`relative overflow-hidden rounded-xl border bg-[#081521] transition ${
          smokeAlert ? 'eco-siren-strobe border-red-500/70' : 'border-white/10'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={880}
          height={430}
          className="h-auto w-full block"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0B1927] px-4 py-2 text-xs text-slate-300">
          <span>
            {t(
              lang,
              `البوابة الذكية ← الموقف المستهدف (${telemetry.targetSpotLabel}) · إجمالي المواقف: ${spots.length}`,
              `Smart Gate → Target Bay (${telemetry.targetSpotLabel}) · Total Bays: ${spots.length}`
            )}
          </span>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>{t(lang, 'أخضر: متاح', 'Green: Available')}</span>
            <span>·</span>
            <span>{t(lang, 'أحمر: مشغول', 'Red: Occupied')}</span>
            <span>·</span>
            <span className="font-mono text-cyan-300 tabular-nums">
              {t(
                lang,
                `الطقس: ${weatherSpec.labelAr} (${weatherEnergy.solarEfficiencyPct}% شمسي)`,
                `Weather: ${weatherSpec.labelEn} (${weatherEnergy.solarEfficiencyPct}% Solar)`
              )}
            </span>
            <span>·</span>
            <span className="font-mono text-amber-300 tabular-nums">
              {t(lang, `الازدحام الحراري: ${thermalStats.congestionIndexPct}%`, `Thermal Congestion: ${thermalStats.congestionIndexPct}%`)}
            </span>
            <span>·</span>
            <span className="font-mono text-emerald-300 tabular-nums">
              {t(lang, 'تبريد الغطاء الأخضر: -2.6°C', 'Biophilic Bio-Cool: -2.6°C')}
            </span>
            {smokeAlert && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 font-semibold text-red-400">
                  <Flame className="h-3.5 w-3.5" />
                  {t(lang, 'رصد دخان عند B-04', 'Smoke detected at B-04')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rush Hour Traffic Simulation Panel */}
      <div className="rounded-xl border border-cyan-500/25 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              {t(
                lang,
                'محاكاة حركة المرور وساعات الذروة (Traffic Simulation)',
                'Rush Hour Traffic Simulation & Auto-Dispatch'
              )}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {t(
                lang,
                'تحكّم بمعدل وصول المركبات في ساعات الذروة لمراقبة التوسيع التلقائي للمواقف وإرسال روبوت الشحن EcoCharge Bot X1.',
                'Adjust rush-hour vehicle arrival rate to visualize automatic bay expansion and autonomous EcoCharge Bot dispatching.'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTrafficSimRunning((r) => !r)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              trafficSimRunning
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {trafficSimRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {trafficSimRunning
              ? t(lang, 'إيقاف محاكاة الذروة', 'Stop Traffic Simulation')
              : t(lang, 'تشغيل محاكاة الذروة', 'Start Traffic Simulation')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Arrival Rate & Scenario Controls */}
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200">
                {t(lang, 'معدل وصول المركبات (Arrival Rate):', 'Vehicle Arrival Rate:')}
              </label>
              <span className="font-mono text-sm font-extrabold text-cyan-400 tabular-nums">
                {arrivalRatePerMin} {t(lang, 'مركبة / دقيقة', 'veh / min')}
              </span>
            </div>

            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={arrivalRatePerMin}
              onChange={(e) => setArrivalRatePerMin(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />

            {activeMergedEvent && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px]">
                <div className="text-emerald-200">
                  <span className="font-bold">
                    {t(lang, 'مزامنة فعالية 107:', 'Project 107 Event Surge:')}
                  </span>{' '}
                  {lang === 'ar' ? activeMergedEvent.titleAr : activeMergedEvent.titleEn} ·{' '}
                  <span className="font-mono text-cyan-300">
                    {activeMergedEvent.predictedVehicles} {t(lang, 'مركبة', 'veh')}
                  </span>
                  {activeMergedTour && (
                    <span className="text-slate-300">
                      {' '}
                      · {t(lang, 'مسار 101:', 'Route 101:')} {lang === 'ar' ? activeMergedTour.cityAr : activeMergedTour.cityEn}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const syncedRate = Math.min(
                      24,
                      Math.max(6, Math.round(activeMergedEvent.predictedVehicles / 10))
                    );
                    setArrivalRatePerMin(syncedRate);
                    setRushScenario('morning_ev');
                    setAutoExpandRush(true);
                    setTrafficSimRunning(true);
                    onRushEvent?.(
                      t(
                        lang,
                        `تمت مزامنة تدفق «${activeMergedEvent.titleAr}» (${syncedRate} مركبة/د) مع المحاكي 2D!`,
                        `Synced Project 107 "${activeMergedEvent.titleEn}" inflow (${syncedRate} veh/min) into 2D simulator!`
                      )
                    );
                  }}
                  className="rounded-lg bg-emerald-500 px-2.5 py-1 font-bold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap"
                >
                  {t(lang, 'مزامنة تدفق فعالية 107', 'Sync Project 107 Surge')}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { rate: 4, ar: 'عادي (4/د)', en: 'Off-Peak (4/m)' },
                  { rate: 10, ar: 'ذروة صباحية (10/د)', en: 'Rush Hour (10/m)' },
                  { rate: 18, ar: 'ضغط أقصى (18/د)', en: 'Extreme Surge (18/m)' },
                ].map((preset) => (
                  <button
                    key={preset.rate}
                    type="button"
                    onClick={() => setArrivalRatePerMin(preset.rate)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      arrivalRatePerMin === preset.rate
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-white/10 bg-[#0D1E2E] text-slate-300 hover:border-cyan-400/40'
                    }`}
                  >
                    {lang === 'ar' ? preset.ar : preset.en}
                  </button>
                ))}
              </div>

              <select
                value={rushScenario}
                onChange={(e) =>
                  setRushScenario(e.target.value as 'morning_ev' | 'evening_peak' | 'mixed')
                }
                className="rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400"
              >
                <option value="morning_ev">
                  {t(lang, 'سيناريو: موجة سيارات كهربائية (65% EV)', 'Scenario: Morning EV Wave (65% EV)')}
                </option>
                <option value="evening_peak">
                  {t(lang, 'سيناريو: ذروة مسائية مختلطة', 'Scenario: Evening Mixed Peak')}
                </option>
                <option value="mixed">
                  {t(lang, 'سيناريو: حركة متوازنة', 'Scenario: Balanced City Mix')}
                </option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={autoExpandRush}
                  onChange={(e) => setAutoExpandRush(e.target.checked)}
                  className="accent-emerald-400 h-4 w-4"
                />
                <span>{t(lang, 'توسيع المواقف تلقائياً عند الامتلاء', 'Auto-expand bays at 100% capacity')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={autoDispatchRobotRush}
                  onChange={(e) => setAutoDispatchRobotRush(e.target.checked)}
                  className="accent-cyan-400 h-4 w-4"
                />
                <span>{t(lang, 'إرسال EcoCharge Bot X1 آلياً', 'Auto-dispatch EcoCharge Bot X1')}</span>
              </label>
            </div>
          </div>

          {/* Rush Counters & Live Automation Event Feed */}
          <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#08121D] p-4 flex flex-col justify-between space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#0D1E2E] p-2.5">
                <div className="text-[10px] text-slate-400">{t(lang, 'المركبات الموجهة', 'Routed Cars')}</div>
                <div className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums">
                  {rushStats.dispatchedCount}
                </div>
              </div>
              <div className="rounded-lg bg-[#0D1E2E] p-2.5">
                <div className="text-[10px] text-slate-400">{t(lang, 'توسيع تلقائي', 'Auto Bays Added')}</div>
                <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
                  +{rushStats.autoExpandedCount}
                </div>
              </div>
              <div className="rounded-lg bg-[#0D1E2E] p-2.5">
                <div className="text-[10px] text-slate-400">{t(lang, 'مهام الروبوت', 'Robot Dispatches')}</div>
                <div className="mt-1 font-mono text-lg font-extrabold text-cyan-400 tabular-nums">
                  {rushStats.robotDispatchedCount}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {rushEvents.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-slate-500">
                  {t(
                    lang,
                    'اضغط "تشغيل محاكاة الذروة" لمشاهدة التدفق الآلي وتوسيع المواقف.',
                    'Click "Start Traffic Simulation" to watch live bay expansion & bot dispatches.'
                  )}
                </p>
              ) : (
                rushEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#0D1E2E] px-2.5 py-1.5 text-[11px]"
                  >
                    <span
                      className={`flex items-center gap-1.5 font-medium ${
                        ev.kind === 'expand'
                          ? 'text-emerald-300'
                          : ev.kind === 'robot'
                            ? 'text-cyan-300'
                            : 'text-slate-200'
                      }`}
                    >
                      {ev.kind === 'robot' && <Bot className="h-3 w-3 shrink-0" />}
                      {ev.kind === 'expand' && <PlusCircle className="h-3 w-3 shrink-0" />}
                      <span>{ev.msg}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0 tabular-nums">
                      {ev.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4 Telemetry & Thermal Congestion Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
          <div className="text-xs text-slate-400">{t(lang, 'مؤشر الازدحام الحراري', 'Thermal Congestion Index')}</div>
          <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${thermalStats.congestionIndexPct >= 70 ? 'text-red-400' : thermalStats.congestionIndexPct >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {thermalStats.congestionIndexPct}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t(lang, `معدل الساحة: ${thermalStats.avgTempC}°C`, `Avg Lot Temp: ${thermalStats.avgTempC}°C`)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
          <div className="text-xs text-slate-400">{t(lang, 'أعلى بؤرة حرارية حالياً', 'Peak Thermal Hotspot')}</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {thermalStats.peakTempC}°C · {thermalStats.peakBayLabel}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t(lang, `حرارة الممر: ${thermalStats.laneTempC}°C`, `Driving Lane: ${thermalStats.laneTempC}°C`)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
          <div className="text-xs text-slate-400">{t(lang, 'المسافة الموفرة بالتوجيه الذكي', 'Distance Saved via AI Routing')}</div>
          <div className="mt-1 font-mono text-2xl font-bold text-cyan-400 tabular-nums">
            {telemetry.distanceSavedM} {t(lang, 'م', 'm')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t(lang, `المركبات النشطة: ${activeCars.length}`, `Active Cars: ${activeCars.length}`)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
          <div className="text-xs text-slate-400">{t(lang, 'CO2 الموفر المقدر', 'Estimated CO2 Saved')}</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-300 tabular-nums">
            {telemetry.co2SavedG} {t(lang, 'جم', 'g')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t(lang, `وصول: ${telemetry.arrivalSeconds} ث`, `ETA: ${telemetry.arrivalSeconds} s`)}
          </div>
        </div>
      </div>
    </div>
  );
};
