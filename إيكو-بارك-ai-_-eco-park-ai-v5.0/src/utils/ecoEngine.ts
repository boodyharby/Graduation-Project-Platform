import {
  AudioPreferences,
  BessToneId,
  CompletionToneId,
  FcmToneId,
  FireToneId,
  ParkingSpot,
  VehicleType,
  WeatherCondition2D,
} from '../types/parking';

export interface VehicleEmissionSpec {
  type: VehicleType;
  labelAr: string;
  labelEn: string;
  driveGPerKm: number;
  idleGPerMin: number;
  exhaustPpm: number;
  fuelLPerKm: number;
  idleFuelLPerMin: number;
  feeSar: number;
  carbonTaxSar: number;
  pointsReward: number;
  badgeColor: string;
  carColorHex: string;
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleEmissionSpec> = {
  ELECTRIC: {
    type: 'ELECTRIC',
    labelAr: 'كهربائية (EV)',
    labelEn: 'Electric (EV)',
    driveGPerKm: 0.0,
    idleGPerMin: 0.0,
    exhaustPpm: 0,
    fuelLPerKm: 0.0,
    idleFuelLPerMin: 0.0,
    feeSar: 0,
    carbonTaxSar: 0,
    pointsReward: 30,
    badgeColor: '#10B981',
    carColorHex: '#06B6D4',
  },
  HYBRID: {
    type: 'HYBRID',
    labelAr: 'هجينة (Hybrid)',
    labelEn: 'Hybrid',
    driveGPerKm: 92.0,
    idleGPerMin: 3.5,
    exhaustPpm: 110,
    fuelLPerKm: 0.042,
    idleFuelLPerMin: 0.004,
    feeSar: 5,
    carbonTaxSar: 0,
    pointsReward: 18,
    badgeColor: '#34D399',
    carColorHex: '#10B981',
  },
  GASOLINE: {
    type: 'GASOLINE',
    labelAr: 'بنزين (Gasoline)',
    labelEn: 'Gasoline',
    driveGPerKm: 192.0,
    idleGPerMin: 18.5,
    exhaustPpm: 340,
    fuelLPerKm: 0.085,
    idleFuelLPerMin: 0.015,
    feeSar: 10,
    carbonTaxSar: 0,
    pointsReward: 10,
    badgeColor: '#F59E0B',
    carColorHex: '#F59E0B',
  },
  DIESEL: {
    type: 'DIESEL',
    labelAr: 'ديزل (Diesel)',
    labelEn: 'Diesel',
    driveGPerKm: 171.0,
    idleGPerMin: 14.8,
    exhaustPpm: 420,
    fuelLPerKm: 0.075,
    idleFuelLPerMin: 0.012,
    feeSar: 12,
    carbonTaxSar: 5,
    pointsReward: 5,
    badgeColor: '#EF4444',
    carColorHex: '#EF4444',
  },
};

export interface CarbonSavingsResult {
  co2SavedKg: number;
  fuelSavedLiters: number;
  moneySavedSar: number;
  treesDailyEquivalent: number;
  treesAnnualEquivalent: number;
}

export function calculateCarbonSavings(
  vehicleType: VehicleType,
  distanceSavedKm: number,
  timeSavedMin: number
): CarbonSavingsResult {
  const spec = VEHICLE_SPECS[vehicleType];
  const effectiveDriveFactor = vehicleType === 'ELECTRIC' ? 120.0 : spec.driveGPerKm;
  const effectiveIdleFactor = vehicleType === 'ELECTRIC' ? 8.0 : spec.idleGPerMin;

  const co2SavedKg =
    (distanceSavedKm * effectiveDriveFactor + timeSavedMin * effectiveIdleFactor) / 1000;

  const fuelSavedLiters =
    distanceSavedKm * spec.fuelLPerKm + timeSavedMin * spec.idleFuelLPerMin;

  const moneySavedSar = fuelSavedLiters * 2.33;
  const treesDailyEquivalent = co2SavedKg / 0.06;
  const treesAnnualEquivalent = co2SavedKg / 21.77;

  return {
    co2SavedKg: Number(co2SavedKg.toFixed(3)),
    fuelSavedLiters: Number(fuelSavedLiters.toFixed(3)),
    moneySavedSar: Number(moneySavedSar.toFixed(2)),
    treesDailyEquivalent: Number(treesDailyEquivalent.toFixed(2)),
    treesAnnualEquivalent: Number(treesAnnualEquivalent.toFixed(2)),
  };
}

export function calculateAnnualDriverSavings(
  vehicleType: VehicleType,
  dailyDistanceSavedKm: number,
  dailyTimeSavedMin: number,
  daysPerWeek: number
) {
  const annualMultiplier = daysPerWeek * 52;
  const single = calculateCarbonSavings(vehicleType, dailyDistanceSavedKm, dailyTimeSavedMin);
  const annualCo2Kg = single.co2SavedKg * annualMultiplier;
  const annualFuelLiters = single.fuelSavedLiters * annualMultiplier;
  const annualMoneySar = annualFuelLiters * 2.33;
  const annualTrees = annualCo2Kg / 21.77;

  return {
    annualCo2Kg: Number(annualCo2Kg.toFixed(1)),
    annualFuelLiters: Number(annualFuelLiters.toFixed(1)),
    annualMoneySar: Number(annualMoneySar.toFixed(0)),
    annualTrees: Number(annualTrees.toFixed(1)),
    annualPoints: VEHICLE_SPECS[vehicleType].pointsReward * annualMultiplier,
  };
}

export interface BayThermalInfo {
  spotId: string;
  label: string;
  tempC: number;
  level: 'cool' | 'warm' | 'hot' | 'critical';
}

export interface LotThermalTelemetry {
  avgTempC: number;
  laneTempC: number;
  peakTempC: number;
  peakBayLabel: string;
  congestionIndexPct: number;
  bayTemps: Record<string, BayThermalInfo>;
}

/**
 * Computes real-time parking thermal congestion telemetry directly linked to current bay occupancy,
 * vehicle propulsion mix, active water-misting cooling, and smoke/fire alerts.
 */
export function computeLotThermalStats(
  spots: ParkingSpot[],
  showMisting: boolean,
  smokeAlert: boolean,
  weather: WeatherCondition2D = 'sunny'
): LotThermalTelemetry {
  const total = Math.max(spots.length, 1);
  const occupiedSpots = spots.filter((s) => s.status !== 'available');
  const occupancyRatio = occupiedSpots.length / total;
  const coolingOffset = showMisting ? -3.1 : 0;
  const weatherTempOffset = weather === 'rainy' ? -5.2 : weather === 'stormy' ? -3.8 : 2.1;

  const bayTemps: Record<string, BayThermalInfo> = {};
  let sumTemp = 0;
  let peakTempC = 24.0;
  let peakBayLabel = spots[0]?.label || 'A-01';
  let thermalLoadUnits = 0;

  spots.forEach((spot) => {
    // Base shaded temperature under solar canopies (26.5°C) + ambient crowding transfer + weather
    let temp = 26.5 + occupancyRatio * 4.8 + coolingOffset + weatherTempOffset;

    if (spot.status === 'reserved') {
      temp += 2.8;
      thermalLoadUnits += 0.35;
    } else if (spot.status === 'occupied') {
      if (spot.vehicleType === 'DIESEL') {
        temp += 17.5;
        thermalLoadUnits += 1.0;
      } else if (spot.vehicleType === 'GASOLINE') {
        temp += 15.2;
        thermalLoadUnits += 0.9;
      } else if (spot.vehicleType === 'HYBRID') {
        temp += 7.4;
        thermalLoadUnits += 0.55;
      } else {
        // Electric fast-charging battery heat dissipation
        temp += spot.hasCharger ? 3.8 : 2.4;
        thermalLoadUnits += 0.3;
      }
    }

    if (smokeAlert && spot.id === 'B-04') {
      temp += 21.0;
      thermalLoadUnits += 1.4;
    }

    const rounded = Number(Math.max(24.0, temp).toFixed(1));
    const level: BayThermalInfo['level'] =
      rounded >= 45 ? 'critical' : rounded >= 38 ? 'hot' : rounded >= 31.5 ? 'warm' : 'cool';

    bayTemps[spot.id] = {
      spotId: spot.id,
      label: spot.label,
      tempC: rounded,
      level,
    };

    sumTemp += rounded;
    if (rounded > peakTempC) {
      peakTempC = rounded;
      peakBayLabel = spot.label;
    }
  });

  const laneTempC = Number(
    Math.max(21.0, 33.5 + occupancyRatio * 10.2 + (showMisting ? -2.4 : 0) + weatherTempOffset).toFixed(1)
  );
  const avgTempC = Number((sumTemp / total).toFixed(1));
  const congestionIndexPct = Math.min(
    100,
    Math.round(((occupancyRatio * 0.55 + (thermalLoadUnits / total) * 0.45) * 100) + (smokeAlert ? 18 : 0))
  );

  return {
    avgTempC,
    laneTempC,
    peakTempC: Number(peakTempC.toFixed(1)),
    peakBayLabel,
    congestionIndexPct,
    bayTemps,
  };
}

export interface WeatherProfileSpec {
  id: WeatherCondition2D;
  labelAr: string;
  labelEn: string;
  baseEfficiencyPct: number;
  irradianceWm2: number;
  windKmh: number;
  consumptionMultiplier: number;
  canopyModeAr: string;
  canopyModeEn: string;
}

export const WEATHER_PROFILES: Record<WeatherCondition2D, WeatherProfileSpec> = {
  sunny: {
    id: 'sunny',
    labelAr: 'مشمس',
    labelEn: 'Sunny',
    baseEfficiencyPct: 94,
    irradianceWm2: 985,
    windKmh: 11,
    consumptionMultiplier: 1.0,
    canopyModeAr: 'تتبع شمسي أقصى كفاءة',
    canopyModeEn: 'Peak Solar Tracking',
  },
  rainy: {
    id: 'rainy',
    labelAr: 'ممطر',
    labelEn: 'Rainy',
    baseEfficiencyPct: 32,
    irradianceWm2: 310,
    windKmh: 26,
    consumptionMultiplier: 1.15,
    canopyModeAr: 'إضاءة مسار + تصريف مياه',
    canopyModeEn: 'Wet Lighting + Drainage Pumps',
  },
  stormy: {
    id: 'stormy',
    labelAr: 'عاصف',
    labelEn: 'Stormy',
    baseEfficiencyPct: 12,
    irradianceWm2: 115,
    windKmh: 64,
    consumptionMultiplier: 1.32,
    canopyModeAr: 'وضع حماية الألواح من الرياح',
    canopyModeEn: 'Wind-Stow Canopy Protection',
  },
};

export interface WeatherEnergySnapshot {
  weather: WeatherCondition2D;
  solarEfficiencyPct: number;
  solarOutputKw: number;
  irradianceWm2: number;
  windKmh: number;
  evChargerLoadKw: number;
  facilityLoadKw: number;
  totalConsumptionKw: number;
  netBalanceKw: number;
}

export function isSmartNightWindowActive(
  enabled: boolean,
  forceActive: boolean,
  startHour = 22,
  endHour = 5,
  now: Date = new Date()
): boolean {
  if (forceActive) return true;
  if (!enabled) return false;
  const hour = now.getHours();
  if (startHour === endHour) return true;
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

export function computeWeatherEnergyProfile(
  weather: WeatherCondition2D,
  spots: ParkingSpot[],
  mistingActive: boolean,
  ecoConservation: boolean,
  wavePhase = 0,
  nightReductionPct = 0
): WeatherEnergySnapshot {
  const spec = WEATHER_PROFILES[weather];
  const wave = Math.sin(wavePhase);
  const efficiencyJitter = weather === 'sunny' ? wave * 1.4 : weather === 'rainy' ? wave * 2.2 : wave * 2.8;
  const solarEfficiencyPct = Number(
    Math.max(5, Math.min(99, spec.baseEfficiencyPct + efficiencyJitter)).toFixed(1)
  );
  // Rated PV canopy capacity = 250 kW
  const solarOutputKw = Number(((250 * solarEfficiencyPct) / 100).toFixed(1));
  const irradianceWm2 = Math.max(
    45,
    Math.round(spec.irradianceWm2 + wave * (weather === 'sunny' ? 18 : 28))
  );
  const windKmh = Math.max(
    4,
    Math.round(spec.windKmh + Math.cos(wavePhase * 1.3) * (weather === 'stormy' ? 9 : 3))
  );

  const nightFactor = Math.max(0.35, 1 - Math.max(0, Math.min(65, nightReductionPct)) / 100);

  // Active EV charger draw across occupied or reserved EV bays
  let evChargerLoadKw = 0;
  spots.forEach((s) => {
    if (s.hasCharger && s.status !== 'available') {
      const baseDraw = s.vehicleType === 'ELECTRIC' ? s.chargerKw * 0.78 : s.vehicleType === 'HYBRID' ? s.chargerKw * 0.35 : 0;
      const ecoAdjusted = ecoConservation ? baseDraw * 0.65 : baseDraw;
      evChargerLoadKw += ecoAdjusted * (nightReductionPct > 0 ? Math.max(0.7, nightFactor) : 1);
    }
  });
  evChargerLoadKw = Number(evChargerLoadKw.toFixed(1));

  // Facility baseline: ANPR gate, ventilation/drainage, canopy floodlights, misting pumps
  const occupiedCount = spots.filter((s) => s.status !== 'available').length;
  const mistingKw = mistingActive && weather === 'sunny' ? 8.5 : mistingActive ? 3.2 : 0;
  const baseFacilityKw = 14 + occupiedCount * 1.4 + mistingKw;
  const ecoDimmingFactor = ecoConservation ? 0.76 : 1.0;
  const facilityLoadKw = Number(
    (
      baseFacilityKw *
      spec.consumptionMultiplier *
      ecoDimmingFactor *
      nightFactor +
      Math.abs(wave) * 1.1
    ).toFixed(1)
  );

  const totalConsumptionKw = Number((evChargerLoadKw + facilityLoadKw).toFixed(1));
  const netBalanceKw = Number((solarOutputKw - totalConsumptionKw).toFixed(1));

  return {
    weather,
    solarEfficiencyPct,
    solarOutputKw,
    irradianceWm2,
    windKmh,
    evChargerLoadKw,
    facilityLoadKw,
    totalConsumptionKw,
    netBalanceKw,
  };
}

// ======================== AUDIO CUSTOMIZATION & REALISTIC WEB AUDIO ENGINE ========================
const AUDIO_PREFS_STORAGE_KEY = 'ecopark_audio_prefs';

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  muted: false,
  voiceEnabled: true,
  volume: 0.85,
  fireTone: 'nfpa_bell',
  bessTone: 'industrial_klaxon',
  completionTone: 'eco_chime',
  fcmTone: 'egyptian_hospitality',
};

let cachedAudioPrefs: AudioPreferences = (() => {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFERENCES;
    return { ...DEFAULT_AUDIO_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
})();

export function getAudioPreferences(): AudioPreferences {
  return { ...cachedAudioPrefs };
}

export function setAudioPreferences(next: AudioPreferences): AudioPreferences {
  cachedAudioPrefs = {
    ...DEFAULT_AUDIO_PREFERENCES,
    ...next,
    volume: Math.max(0.05, Math.min(1, Number(next.volume) || 0.85)),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(cachedAudioPrefs));
    } catch {
      // ignore storage quota errors
    }
  }
  if (cachedAudioPrefs.muted) {
    stopAllAlarms();
    stopCopilotSpeech();
  }
  return { ...cachedAudioPrefs };
}

let sharedAudioCtx: AudioContext | null = null;
const activeAlarmNodes: Array<{ stop: () => void }> = [];

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createHornDistortionCurve(amount = 32): Float32Array<ArrayBuffer> {
  const nSamples = 256;
  const buffer = new ArrayBuffer(nSamples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export function stopAllAlarms() {
  while (activeAlarmNodes.length > 0) {
    const item = activeAlarmNodes.pop();
    try {
      item?.stop();
    } catch {
      // ignore already stopped nodes
    }
  }
}

let cachedReverbBuffer: AudioBuffer | null = null;

function getGarageReverbBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedReverbBuffer && cachedReverbBuffer.sampleRate === ctx.sampleRate) {
    return cachedReverbBuffer;
  }
  const duration = 0.85;
  const length = Math.floor(ctx.sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // Early concrete reflections + natural exponential garage tail decay
      const decay = Math.pow(1 - i / length, 2.8);
      const earlyBoost = i < ctx.sampleRate * 0.06 && i % 420 < 4 ? 1.45 : 1.0;
      channelData[i] = (Math.random() * 2 - 1) * decay * earlyBoost * 0.45;
    }
  }
  cachedReverbBuffer = impulse;
  return impulse;
}

function connectGarageAcousticBus(ctx: AudioContext, now: number): {
  dryInput: GainNode;
  masterOut: GainNode;
} {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-15, now);
  compressor.knee.setValueAtTime(10, now);
  compressor.ratio.setValueAtTime(6, now);
  compressor.attack.setValueAtTime(0.003, now);
  compressor.release.setValueAtTime(0.16, now);

  const masterOut = ctx.createGain();
  masterOut.gain.setValueAtTime(0.36 * cachedAudioPrefs.volume, now);

  const dryInput = ctx.createGain();
  dryInput.gain.setValueAtTime(0.78, now);

  const wetSend = ctx.createGain();
  wetSend.gain.setValueAtTime(0.36, now);

  const convolver = ctx.createConvolver();
  convolver.buffer = getGarageReverbBuffer(ctx);

  const wetTone = ctx.createBiquadFilter();
  wetTone.type = 'lowpass';
  wetTone.frequency.setValueAtTime(2400, now);

  dryInput.connect(masterOut);
  dryInput.connect(wetSend);
  wetSend.connect(convolver);
  convolver.connect(wetTone);
  wetTone.connect(masterOut);

  masterOut.connect(compressor);
  compressor.connect(ctx.destination);

  return { dryInput, masterOut };
}

/**
 * Realistic Long-Duration (~11.5s) Industrial Substation / Civil-Defense Klaxon Motor Siren
 * Combines rotor inertia sweeps, compressed-air turbulence noise, 3-band brass horn formants,
 * and concrete parking garage stereo convolution reverb.
 */
export function playBessCriticalSiren(toneOverride?: BessToneId) {
  if (cachedAudioPrefs.muted) return;
  const chosenTone = toneOverride || cachedAudioPrefs.bessTone;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    stopAllAlarms();

    const now = ctx.currentTime;
    const { dryInput, masterOut } = connectGarageAcousticBus(ctx, now);

    if (chosenTone === 'substation_pulse') {
      // SCADA Substation Control-Room Dual-Frequency Warning Pulse (~9.6s)
      for (let i = 0; i < 12; i++) {
        const t0 = now + i * 0.8;
        [960, 720].forEach((freq, bIdx) => {
          const t = t0 + bIdx * 0.24;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
          osc.connect(gain);
          gain.connect(dryInput);
          osc.start(t);
          osc.stop(t + 0.22);
          activeAlarmNodes.push({
            stop: () => {
              masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
              try { osc.stop(); } catch {}
            },
          });
        });
      }
      return;
    }

    if (chosenTone === 'sonar_ping') {
      // Power-Grid Deep Descending Sonar Warning (~9.0s)
      for (let i = 0; i < 6; i++) {
        const t0 = now + i * 1.45;
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        sub.type = 'triangle';
        osc.frequency.setValueAtTime(1180, t0);
        osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.72);
        sub.frequency.setValueAtTime(295, t0);
        sub.frequency.exponentialRampToValueAtTime(105, t0 + 0.72);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.42, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
        osc.connect(gain);
        sub.connect(gain);
        gain.connect(dryInput);
        osc.start(t0);
        sub.start(t0);
        osc.stop(t0 + 1.18);
        sub.stop(t0 + 1.18);
        activeAlarmNodes.push({
          stop: () => {
            masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
            try { osc.stop(); sub.stop(); } catch {}
          },
        });
      }
      return;
    }

    // Subtle 50Hz industrial substation transformer hum across the full alarm window
    const humOsc = ctx.createOscillator();
    const humGain = ctx.createGain();
    humOsc.type = 'sine';
    humOsc.frequency.setValueAtTime(100, now);
    humGain.gain.setValueAtTime(0.06, now);
    humOsc.connect(humGain);
    humGain.connect(dryInput);
    humOsc.start(now);
    humOsc.stop(now + 11.6);

    // 3-Band Megaphone Brass Formant Filter Bank (physical industrial horn cabinet resonance)
    const shaper = ctx.createWaveShaper();
    shaper.curve = createHornDistortionCurve(38);
    shaper.oversample = '2x';

    const formantFrequencies = [680, 1410, 2490];
    const formantQs = [2.2, 2.7, 3.1];
    const formantGains = [0.64, 0.5, 0.3];

    formantFrequencies.forEach((freq, idx) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, now);
      bp.Q.setValueAtTime(formantQs[idx], now);
      const fg = ctx.createGain();
      fg.gain.setValueAtTime(formantGains[idx], now);
      shaper.connect(bp);
      bp.connect(fg);
      fg.connect(dryInput);
    });

    // 1. Electrical relay click + SCADA Two-Tone Pre-Alert Chime (0.00s -> 0.36s)
    [987.77, 739.99].forEach((freq, idx) => {
      const chime = ctx.createOscillator();
      const cg = ctx.createGain();
      const t = now + idx * 0.13;
      chime.type = 'sine';
      chime.frequency.setValueAtTime(freq, t);
      cg.gain.setValueAtTime(0.001, t);
      cg.gain.linearRampToValueAtTime(0.24, t + 0.012);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      chime.connect(cg);
      cg.connect(dryInput);
      chime.start(t);
      chime.stop(t + 0.23);
    });

    // 2. Heavy Motor-Driven Siren Rotor Spin-Up (0.28s -> 1.1s)
    const turbine = ctx.createOscillator();
    const turbineGain = ctx.createGain();
    turbine.type = 'sawtooth';
    turbine.frequency.setValueAtTime(115, now + 0.28);
    turbine.frequency.exponentialRampToValueAtTime(590, now + 0.92);
    turbine.frequency.exponentialRampToValueAtTime(420, now + 1.15);
    turbineGain.gain.setValueAtTime(0.001, now + 0.28);
    turbineGain.gain.linearRampToValueAtTime(0.28, now + 0.52);
    turbineGain.gain.exponentialRampToValueAtTime(0.001, now + 1.18);
    turbine.connect(turbineGain);
    turbineGain.connect(shaper);
    turbine.start(now + 0.28);
    turbine.stop(now + 1.2);

    const airNoiseBuf = createNoiseBuffer(ctx, 1.25);

    // 3. 8 Extended Industrial Horn-Turbine Cycles (~11.4 seconds total)
    const cycleCount = 8;
    const cycleStep = 1.32;
    for (let cycle = 0; cycle < cycleCount; cycle++) {
      const t0 = now + 0.45 + cycle * cycleStep;
      const dur = 1.14;

      const oscMain = ctx.createOscillator();
      const oscDetuned = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const oscSub = ctx.createOscillator();
      const lfoPitch = ctx.createOscillator();
      const lfoPitchGain = ctx.createGain();
      const amRotor = ctx.createOscillator();
      const amDepth = ctx.createGain();
      const env = ctx.createGain();

      // Compressed-air stator rush synced with the horn blast
      const airRush = ctx.createBufferSource();
      airRush.buffer = airNoiseBuf;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'bandpass';
      airFilter.frequency.setValueAtTime(1150, t0);
      airFilter.frequency.exponentialRampToValueAtTime(2350, t0 + 0.34);
      airFilter.frequency.exponentialRampToValueAtTime(980, t0 + dur);
      airFilter.Q.setValueAtTime(1.8, t0);
      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(0.001, t0);
      airGain.gain.linearRampToValueAtTime(0.16, t0 + 0.16);
      airGain.gain.exponentialRampToValueAtTime(0.004, t0 + dur);
      airRush.connect(airFilter);
      airFilter.connect(airGain);
      airGain.connect(dryInput);
      airRush.start(t0);
      airRush.stop(t0 + dur + 0.02);

      oscMain.type = 'sawtooth';
      oscDetuned.type = 'sawtooth';
      oscHarmonic.type = 'square';
      oscSub.type = 'triangle';

      // Asymmetric motor-siren wail glide (370Hz -> 935Hz -> 435Hz)
      const peakF = cycle === cycleCount - 1 ? 820 : 935;
      const endF = cycle === cycleCount - 1 ? 190 : 435;
      oscMain.frequency.setValueAtTime(370, t0);
      oscMain.frequency.exponentialRampToValueAtTime(peakF, t0 + 0.36);
      oscMain.frequency.setValueAtTime(peakF, t0 + 0.52);
      oscMain.frequency.exponentialRampToValueAtTime(endF, t0 + dur);

      oscDetuned.frequency.setValueAtTime(376, t0);
      oscDetuned.frequency.exponentialRampToValueAtTime(peakF + 7, t0 + 0.36);
      oscDetuned.frequency.setValueAtTime(peakF + 7, t0 + 0.52);
      oscDetuned.frequency.exponentialRampToValueAtTime(endF + 5, t0 + dur);

      oscHarmonic.frequency.setValueAtTime(740, t0);
      oscHarmonic.frequency.exponentialRampToValueAtTime(peakF * 2, t0 + 0.36);
      oscHarmonic.frequency.exponentialRampToValueAtTime(endF * 2, t0 + dur);

      oscSub.frequency.setValueAtTime(124, t0);
      oscSub.frequency.exponentialRampToValueAtTime(185, t0 + 0.36);
      oscSub.frequency.exponentialRampToValueAtTime(112, t0 + dur);

      // Mechanical diaphragm vibration & rotary louver amplitude chopping
      lfoPitch.type = 'sine';
      lfoPitch.frequency.setValueAtTime(24, t0);
      lfoPitchGain.gain.setValueAtTime(16, t0);
      lfoPitch.connect(lfoPitchGain);
      lfoPitchGain.connect(oscMain.frequency);
      lfoPitchGain.connect(oscDetuned.frequency);

      amRotor.type = 'sine';
      amRotor.frequency.setValueAtTime(11, t0);
      amDepth.gain.setValueAtTime(0.16, t0);
      amRotor.connect(amDepth);
      amDepth.connect(env.gain);

      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(0.76, t0 + 0.08);
      env.gain.setValueAtTime(0.72, t0 + dur - 0.18);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.22, t0);

      oscMain.connect(env);
      oscDetuned.connect(env);
      oscSub.connect(env);
      oscHarmonic.connect(harmonicGain);
      harmonicGain.connect(env);
      env.connect(shaper);

      oscMain.start(t0);
      oscDetuned.start(t0);
      oscHarmonic.start(t0);
      oscSub.start(t0);
      lfoPitch.start(t0);
      amRotor.start(t0);

      oscMain.stop(t0 + dur + 0.03);
      oscDetuned.stop(t0 + dur + 0.03);
      oscHarmonic.stop(t0 + dur + 0.03);
      oscSub.stop(t0 + dur + 0.03);
      lfoPitch.stop(t0 + dur + 0.03);
      amRotor.stop(t0 + dur + 0.03);

      activeAlarmNodes.push({
        stop: () => {
          masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
          try {
            humOsc.stop();
            turbine.stop();
            airRush.stop();
          } catch {
            // ignore stopped
          }
          try {
            oscMain.stop();
            oscDetuned.stop();
            oscHarmonic.stop();
            oscSub.stop();
            lfoPitch.stop();
            amRotor.stop();
          } catch {
            // ignore stopped
          }
        },
      });
    }
  } catch {
    // Audio playback blocked or unavailable
  }
}

/**
 * Realistic Long-Duration (~11.5s) NFPA-72 Temporal-3 Horn-Strobe & Metallic Fire Bell Evacuation Siren
 */
export function playFireAlarmSiren(toneOverride?: FireToneId) {
  if (cachedAudioPrefs.muted) return;
  const chosenTone = toneOverride || cachedAudioPrefs.fireTone;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    stopAllAlarms();

    const now = ctx.currentTime;
    const { dryInput, masterOut } = connectGarageAcousticBus(ctx, now);

    if (chosenTone === 'europa_hi_lo') {
      // European Dual-Tone Hi-Lo Pneumatic Emergency Siren (~9.6s)
      for (let i = 0; i < 16; i++) {
        const t0 = now + i * 0.58;
        const dur = 0.55;
        const f = i % 2 === 0 ? 880 : 660;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const env = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(f, t0);
        osc2.frequency.setValueAtTime(f * 1.5, t0);
        env.gain.setValueAtTime(0.001, t0);
        env.gain.linearRampToValueAtTime(0.48, t0 + 0.02);
        env.gain.setValueAtTime(0.45, t0 + dur - 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc1.connect(env);
        osc2.connect(env);
        env.connect(dryInput);
        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + dur + 0.02);
        osc2.stop(t0 + dur + 0.02);
        activeAlarmNodes.push({
          stop: () => {
            masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
            try { osc1.stop(); osc2.stop(); } catch {}
          },
        });
      }
      return;
    }

    if (chosenTone === 'rapid_piezo') {
      // High-Urgency Piezo Multi-Pulse Evacuator (~9.2s)
      for (let i = 0; i < 22; i++) {
        const t0 = now + i * 0.4;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2480, t0);
        osc.frequency.exponentialRampToValueAtTime(2860, t0 + 0.14);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.32, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        osc.connect(gain);
        gain.connect(dryInput);
        osc.start(t0);
        osc.stop(t0 + 0.25);
        activeAlarmNodes.push({
          stop: () => {
            masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
            try { osc.stop(); } catch {}
          },
        });
      }
      return;
    }

    // 4 full NFPA-72 Temporal-3 evacuation cycles (12 blasts over ~11.4 seconds)
    const offsets: number[] = [];
    for (let c = 0; c < 4; c++) {
      const base = c * 2.85;
      offsets.push(base, base + 0.62, base + 1.24);
    }
    const noiseBuf = createNoiseBuffer(ctx, 0.5);

    offsets.forEach((offset) => {
      const t0 = now + offset;
      const dur = 0.46;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const oscBell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2350, t0);
      noiseFilter.Q.setValueAtTime(2.6, t0);

      const hornResonator = ctx.createBiquadFilter();
      hornResonator.type = 'bandpass';
      hornResonator.frequency.setValueAtTime(1580, t0);
      hornResonator.Q.setValueAtTime(1.45, t0);

      const env = ctx.createGain();
      const noiseGain = ctx.createGain();

      // Dual evacuation piezo/pneumatic horn + metallic bell striker transient
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      oscBell.type = 'sine';

      osc1.frequency.setValueAtTime(510, t0);
      osc1.frequency.exponentialRampToValueAtTime(1480, t0 + dur * 0.68);
      osc1.frequency.setValueAtTime(1480, t0 + dur);

      osc2.frequency.setValueAtTime(1020, t0);
      osc2.frequency.exponentialRampToValueAtTime(2960, t0 + dur * 0.68);

      oscBell.frequency.setValueAtTime(3120, t0);
      bellGain.gain.setValueAtTime(0.28, t0);
      bellGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);

      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(0.72, t0 + 0.018);
      env.gain.setValueAtTime(0.68, t0 + dur - 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      noiseGain.gain.setValueAtTime(0.18, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.008, t0 + dur);

      osc1.connect(env);
      osc2.connect(env);
      oscBell.connect(bellGain);
      bellGain.connect(dryInput);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dryInput);
      env.connect(hornResonator);
      hornResonator.connect(dryInput);

      osc1.start(t0);
      osc2.start(t0);
      oscBell.start(t0);
      noise.start(t0);

      osc1.stop(t0 + dur + 0.02);
      osc2.stop(t0 + dur + 0.02);
      oscBell.stop(t0 + 0.16);
      noise.stop(t0 + dur + 0.02);

      activeAlarmNodes.push({
        stop: () => {
          masterOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
          try {
            osc1.stop();
            osc2.stop();
            oscBell.stop();
            noise.stop();
          } catch {
            // ignore stopped
          }
        },
      });
    });
  } catch {
    // Ignore audio errors
  }
}

export function playReservationCompleteSound(toneOverride?: CompletionToneId) {
  if (cachedAudioPrefs.muted) return;
  const chosenTone = toneOverride || cachedAudioPrefs.completionTone;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = cachedAudioPrefs.volume;

    if (chosenTone === 'crystal_bell') {
      [880, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.16;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18 * vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.68);
      });
      return;
    }

    if (chosenTone === 'futuristic_trill') {
      [587.33, 739.99, 880, 1174.66, 1479.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.065;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14 * vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
      return;
    }

    // Default 'eco_chime': warm harmonic Green Eco-Pass Major-9th arpeggio
    [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.13 * vol, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {
    // ignore
  }
}

export function playSensorHeartbeatTick() {
  if (cachedAudioPrefs.muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.06);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04 * cachedAudioPrefs.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // ignore
  }
}

/**
 * Realistic Pneumatic Hydraulic Gate Servo + RFID Green Pass Chime
 */
export function playHydraulicGateSound() {
  if (cachedAudioPrefs.muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = cachedAudioPrefs.volume;
    // Pneumatic air-release burst
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.36);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(1400, now);
    nFilter.frequency.exponentialRampToValueAtTime(650, now + 0.35);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.07 * vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.36);

    // Hydraulic actuator motor ramp
    const servo = ctx.createOscillator();
    const servoGain = ctx.createGain();
    servo.type = 'triangle';
    servo.frequency.setValueAtTime(95, now);
    servo.frequency.exponentialRampToValueAtTime(210, now + 0.42);
    servoGain.gain.setValueAtTime(0.09 * vol, now);
    servoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    servo.connect(servoGain);
    servoGain.connect(ctx.destination);
    servo.start(now);
    servo.stop(now + 0.47);

    // Eco-pass confirmation chord
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + 0.14 + idx * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.095 * vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    // Ignore audio errors
  }
}

export type FcmAlertCategory =
  | 'welcome'
  | 'reservation'
  | 'emergency'
  | 'energy'
  | 'solar'
  | 'maintenance'
  | 'general';

export function inferFcmCategory(tagOrTitle = ''): FcmAlertCategory {
  const s = tagOrTitle.toLowerCase();
  if (s.includes('welcome') || s.includes('مفعّلة') || s.includes('اشتغلت')) return 'welcome';
  if (s.includes('emergency') || s.includes('smoke') || s.includes('fire') || s.includes('طوارئ') || s.includes('دخان')) {
    return 'emergency';
  }
  if (s.includes('res-') || s.includes('booking') || s.includes('حجز') || s.includes('تذكرة')) return 'reservation';
  if (s.includes('solar') || s.includes('شمسي')) return 'solar';
  if (s.includes('bess') || s.includes('conflict') || s.includes('energy') || s.includes('طاقة')) return 'energy';
  if (s.includes('pred') || s.includes('maint') || s.includes('صيانة')) return 'maintenance';
  return 'general';
}

/**
 * Custom FCM Push Notification Sound Library (Web Audio synthesized chimes using ecoEngine preferences)
 */
export function playFcmNotificationSound(
  category: FcmAlertCategory = 'general',
  toneOverride?: FcmToneId
) {
  if (cachedAudioPrefs.muted) return;
  const chosenTone: FcmToneId = toneOverride || cachedAudioPrefs.fcmTone || 'egyptian_hospitality';
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = cachedAudioPrefs.volume;

    // Distinct urgent double-pulse telemetry tone for Emergency FCM alerts
    if (category === 'emergency' && !toneOverride) {
      [
        { freq: 1046.5, offset: 0, dur: 0.16 },
        { freq: 783.99, offset: 0.17, dur: 0.16 },
        { freq: 1046.5, offset: 0.36, dur: 0.24 },
      ].forEach(({ freq, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + offset;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18 * vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
      return;
    }

    if (chosenTone === 'scada_ping') {
      [783.99, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.11;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15 * vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.34);
      });
      return;
    }

    if (chosenTone === 'vip_bell' || (category === 'reservation' && !toneOverride)) {
      [659.25, 830.61, 987.77, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.085;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14 * vol, t + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.44);
      });
      return;
    }

    // Default 'egyptian_hospitality' / welcome / solar / energy warm ascending shimmer
    const notes =
      category === 'solar' || category === 'energy'
        ? [440, 554.37, 659.25, 880]
        : [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.075;
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.135 * vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  } catch {
    // Ignore audio context errors
  }
}

export function playCallConnectTone() {
  if (cachedAudioPrefs.muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = cachedAudioPrefs.volume;
    // Soft modern Egyptian phone ring-tap + pickup confirmation
    [
      { f: 440, t: 0, d: 0.14 },
      { f: 554.37, t: 0.15, d: 0.14 },
      { f: 659.25, t: 0.34, d: 0.22 },
      { f: 880, t: 0.42, d: 0.28 },
    ].forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.linearRampToValueAtTime(0.12 * vol, now + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d + 0.02);
    });
  } catch {
    // ignore
  }
}

export function playCallEndTone() {
  if (cachedAudioPrefs.muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = cachedAudioPrefs.volume;
    [659.25, 493.88, 392.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11 * vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {
    // ignore
  }
}

/**
 * Speaks incoming FCM alerts or notification activation confirmation in a warm,
 * friendly Egyptian Arabic (Masri) tone.
 */
export function speakFcmFriendlyEgyptianNotice(
  title: string,
  body: string,
  lang: 'ar' | 'en' = 'ar',
  category: FcmAlertCategory = 'general'
) {
  if (cachedAudioPrefs.muted || !cachedAudioPrefs.voiceEnabled) return;

  const stripEmoji = (s: string) =>
    s
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/[*_`#|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const cleanTitle = stripEmoji(title);
  const cleanBody = stripEmoji(body);

  let spokenText = '';
  if (category === 'welcome') {
    spokenText =
      lang === 'ar'
        ? 'أهلاً بيك يا فندم! تم تفعيل إشعارات إيكو-بارك مصر بنجاح، وأول ما يوصلك حجز أو تنبيه للطاقة هبلغك فوراً بصوت واضح وودود. نورت الدنيا!'
        : 'Welcome! Eco-Park Egypt push notifications are now active. I will notify you immediately whenever a booking finishes or energy needs attention!';
  } else {
    spokenText =
      lang === 'ar'
        ? `يا فندم عندك إشعار جديد: ${cleanTitle}. ${cleanBody}`
        : `New Eco-Park alert: ${cleanTitle}. ${cleanBody}`;
  }

  const friendlyStyle =
    lang === 'ar'
      ? 'Warm, smiling, very friendly Egyptian Arabic (Masri dialect) host speaking cheerfully and clearly to welcome or update a friend'
      : 'Warm, cheerful, friendly hospitality host speaking clearly';

  speakCopilotReply(spokenText, lang, 'Zephyr', undefined, friendlyStyle).catch(() => {
    speakGuidance(spokenText, lang, 1.04, 1.02);
  });
}

function pickEgyptianOrArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => v.lang.toLowerCase() === 'ar-eg') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('ar-eg')) ||
    voices.find((v) => v.name.toLowerCase().includes('egypt') || v.name.toLowerCase().includes('hoda') || v.name.toLowerCase().includes('shakir')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ||
    null
  );
}

export function speakGuidance(
  text: string,
  lang: 'ar' | 'en' = 'ar',
  pitch = 1.0,
  rate = 1.02,
  onSpeakingChange?: (speaking: boolean) => void
) {
  if (cachedAudioPrefs.muted || !cachedAudioPrefs.voiceEnabled) {
    onSpeakingChange?.(false);
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onSpeakingChange?.(false);
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
    if (lang === 'ar') {
      const egVoice = pickEgyptianOrArabicVoice();
      if (egVoice) utterance.voice = egVoice;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = cachedAudioPrefs.volume;
    utterance.onend = () => onSpeakingChange?.(false);
    utterance.onerror = () => onSpeakingChange?.(false);
    window.speechSynthesis.speak(utterance);
  } catch {
    onSpeakingChange?.(false);
  }
}

let activeCopilotAudio: HTMLAudioElement | null = null;
let safetySpeechTimer: number | null = null;
let activeTtsAbort: AbortController | null = null;
const clientTtsAudioCache = new Map<string, { audioBase64: string; mimeType: string }>();

export function stopCopilotSpeech() {
  if (safetySpeechTimer !== null) {
    window.clearTimeout(safetySpeechTimer);
    safetySpeechTimer = null;
  }
  if (activeTtsAbort) {
    try {
      activeTtsAbort.abort();
    } catch {
      // ignore
    }
    activeTtsAbort = null;
  }
  if (activeCopilotAudio) {
    try {
      activeCopilotAudio.pause();
      activeCopilotAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeCopilotAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Speaks Copilot responses using Gemini Neural TTS (/api/tts) with fast client cache + 2.8s timeout,
 * falling back seamlessly to Egyptian Arabic (ar-EG) Web Speech Synthesis so the assistant never hangs.
 */
export async function speakCopilotReply(
  text: string,
  lang: 'ar' | 'en',
  voiceName = 'Zephyr',
  onSpeakingChange?: (speaking: boolean) => void,
  styleHint?: string,
  preferInstant = false
): Promise<void> {
  if (cachedAudioPrefs.muted || !cachedAudioPrefs.voiceEnabled) {
    onSpeakingChange?.(false);
    return;
  }
  const cleaned = text.replace(/[*_`#]/g, '').trim();
  if (!cleaned) {
    onSpeakingChange?.(false);
    return;
  }

  stopCopilotSpeech();
  onSpeakingChange?.(true);

  if (preferInstant) {
    speakGuidance(cleaned, lang, 1.0, 1.04, onSpeakingChange);
    return;
  }

  const cacheKey = `${voiceName}|${lang}|${cleaned.slice(0, 240)}`;
  const cachedPayload = clientTtsAudioCache.get(cacheKey);

  const playBase64Payload = async (audioBase64: string, mimeType = 'audio/wav'): Promise<boolean> => {
    try {
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audio.volume = cachedAudioPrefs.volume;
      activeCopilotAudio = audio;
      audio.onended = () => {
        if (activeCopilotAudio === audio) activeCopilotAudio = null;
        onSpeakingChange?.(false);
      };
      audio.onerror = () => {
        if (activeCopilotAudio === audio) activeCopilotAudio = null;
        speakGuidance(cleaned, lang, 1.0, 1.03, onSpeakingChange);
      };
      await audio.play();
      return true;
    } catch {
      if (activeCopilotAudio) {
        activeCopilotAudio = null;
      }
      return false;
    }
  };

  if (cachedPayload) {
    const ok = await playBase64Payload(cachedPayload.audioBase64, cachedPayload.mimeType);
    if (ok) return;
  }

  try {
    const controller = new AbortController();
    activeTtsAbort = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 2800);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: cleaned,
        lang,
        voiceName,
        styleHint:
          styleHint ||
          (lang === 'ar'
            ? 'Warm, friendly, natural Egyptian Arabic (Masri dialect) smart-city engineer speaking clearly'
            : undefined),
      }),
    });
    window.clearTimeout(timeoutId);
    if (activeTtsAbort === controller) {
      activeTtsAbort = null;
    }

    if (res.ok) {
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (data.audioBase64) {
        if (clientTtsAudioCache.size >= 25) {
          const oldest = clientTtsAudioCache.keys().next().value;
          if (oldest) clientTtsAudioCache.delete(oldest);
        }
        clientTtsAudioCache.set(cacheKey, {
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/wav',
        });
        const ok = await playBase64Payload(data.audioBase64, data.mimeType || 'audio/wav');
        if (ok) return;
      }
    }
  } catch {
    // Timed out or aborted -> fall through to instant Web Speech ar-EG
  } finally {
    activeTtsAbort = null;
  }

  // Instant Browser Web Speech (ar-EG) fallback
  speakGuidance(cleaned, lang, 1.0, 1.03, onSpeakingChange);
}

/**
 * Control-Room Safety Announcer: waits briefly for the initial siren blast
 * then reads critical BESS or fire safety warnings in an authoritative, clear Egyptian Arabic voice.
 */
export function speakSafetyWarning(
  text: string,
  lang: 'ar' | 'en' = 'ar',
  delayMs = 1550
) {
  if (cachedAudioPrefs.muted || !cachedAudioPrefs.voiceEnabled) return;
  if (safetySpeechTimer !== null) {
    window.clearTimeout(safetySpeechTimer);
  }
  const styleHint =
    lang === 'ar'
      ? 'Authoritative, calm, serious Egyptian Arabic smart-city emergency safety announcer in a control room'
      : 'Authoritative, calm, professional emergency control-room safety announcer';

  safetySpeechTimer = window.setTimeout(() => {
    safetySpeechTimer = null;
    if (cachedAudioPrefs.muted || !cachedAudioPrefs.voiceEnabled) return;
    speakCopilotReply(text, lang, 'Charon', undefined, styleHint).catch(() => {
      speakGuidance(text, lang, 0.94, 0.96);
    });
  }, delayMs);
}

/**
 * Deterministic 9x9 QR matrix pattern derived from ticket code
 */
export function buildQrMatrix(code: string): number[][] {
  const size = 9;
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const setFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid[r0 + r][c0 + c] = r === 1 && c === 1 ? 0 : 1;
      }
    }
  };
  setFinder(0, 0);
  setFinder(0, size - 3);
  setFinder(size - 3, 0);

  let hash = 2166136261;
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 3 && c < 3;
      const inTopRight = r < 3 && c >= size - 3;
      const inBottomLeft = r >= size - 3 && c < 3;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      hash ^= r * 31 + c * 17;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = Math.abs(hash) % 10 > 4 ? 1 : 0;
    }
  }
  return grid;
}
