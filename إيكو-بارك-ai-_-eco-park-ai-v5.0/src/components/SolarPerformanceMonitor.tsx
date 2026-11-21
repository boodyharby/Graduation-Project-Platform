import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertOctagon,
  CheckCircle2,
  CloudHail,
  CloudLightning,
  CloudRain,
  Flame,
  Gauge,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sun,
  TrendingDown,
  Wind,
  Wrench,
} from 'lucide-react';
import { Language, WeatherCondition2D } from '../types/parking';
import { t } from '../data/i18n';
import { WEATHER_PROFILES } from '../utils/ecoEngine';

type ExtremePresetId = 'nominal' | 'sandstorm' | 'heatwave' | 'monsoon_hail' | 'custom';

interface ExtremeWeatherParams {
  presetId: ExtremePresetId;
  dustPct: number;
  cloudOpacityPct: number;
  ambientTempC: number;
  windKmh: number;
}

const EXTREME_PRESETS: Record<
  Exclude<ExtremePresetId, 'custom'>,
  ExtremeWeatherParams & { labelAr: string; labelEn: string }
> = {
  nominal: {
    presetId: 'nominal',
    labelAr: 'الوضع القياسي للطقس',
    labelEn: 'Nominal Baseline',
    dustPct: 6,
    cloudOpacityPct: 10,
    ambientTempC: 28,
    windKmh: 16,
  },
  sandstorm: {
    presetId: 'sandstorm',
    labelAr: 'عاصفة رملية كثيفة',
    labelEn: 'Severe Sandstorm',
    dustPct: 74,
    cloudOpacityPct: 78,
    ambientTempC: 44,
    windKmh: 84,
  },
  heatwave: {
    presetId: 'heatwave',
    labelAr: 'موجة حر شديدة (+52°C)',
    labelEn: 'Extreme Heatwave (+52°C)',
    dustPct: 26,
    cloudOpacityPct: 14,
    ambientTempC: 52,
    windKmh: 18,
  },
  monsoon_hail: {
    presetId: 'monsoon_hail',
    labelAr: 'عاصفة مطرية وبرد',
    labelEn: 'Monsoon & Hail Squall',
    dustPct: 38,
    cloudOpacityPct: 88,
    ambientTempC: 18,
    windKmh: 92,
  },
};

interface SolarPerformanceMonitorProps {
  lang: Language;
  solarKw: number;
  weather: WeatherCondition2D;
  spotsCount: number;
  onChangeWeather?: (weather: WeatherCondition2D) => void;
  onAdjustSolarKw?: (kw: number) => void;
  onScenarioTelemetryChange?: (dustPct: number, windKmh: number) => void;
  onTriggerMaintenanceAlert?: (payload: {
    efficiencyPct: number;
    actualKw: number;
    expectedAvgKw: number;
    weather: WeatherCondition2D;
    weatherLabel: string;
    scenarioSummaryAr?: string;
    scenarioSummaryEn?: string;
  }) => void;
}

const HISTORICAL_WEATHER_BENCHMARKS: Record<
  WeatherCondition2D,
  { avgOutputKw: number; peakKw: number; hourlyShape: number[] }
> = {
  sunny: {
    avgOutputKw: 195,
    peakKw: 235,
    hourlyShape: [0.68, 0.78, 0.88, 0.96, 1.05, 1.12, 1.15, 1.1, 1.02, 0.92, 0.78, 0.66],
  },
  rainy: {
    avgOutputKw: 88,
    peakKw: 112,
    hourlyShape: [0.72, 0.8, 0.88, 0.94, 1.02, 1.08, 1.05, 0.98, 0.92, 0.85, 0.76, 0.7],
  },
  stormy: {
    avgOutputKw: 46,
    peakKw: 62,
    hourlyShape: [0.7, 0.76, 0.82, 0.9, 1.0, 1.06, 1.04, 0.96, 0.88, 0.82, 0.74, 0.68],
  },
};

export const SolarPerformanceMonitor: React.FC<SolarPerformanceMonitorProps> = ({
  lang,
  solarKw,
  weather,
  spotsCount,
  onChangeWeather,
  onAdjustSolarKw,
  onScenarioTelemetryChange,
  onTriggerMaintenanceAlert,
}) => {
  const weatherSpec = WEATHER_PROFILES[weather];
  const benchmark = HISTORICAL_WEATHER_BENCHMARKS[weather];

  // Scale slightly only if extra solar canopies were added beyond baseline 12 bays
  const canopyScale = 1 + Math.max(0, spotsCount - 12) * 0.03;
  const expectedAvgKw = Number((benchmark.avgOutputKw * canopyScale).toFixed(1));
  const threshold70Kw = Number((expectedAvgKw * 0.7).toFixed(1));
  const performancePct = Math.min(
    160,
    Math.max(0, Math.round((solarKw / Math.max(1, expectedAvgKw)) * 100))
  );
  const isBelow70 = performancePct < 70;
  const varianceKw = Number((solarKw - expectedAvgKw).toFixed(1));

  // Extreme weather scenario customizer state
  const [scenario, setScenario] = useState<ExtremeWeatherParams>(EXTREME_PRESETS.nominal);
  const [liveSyncScenario, setLiveSyncScenario] = useState<boolean>(false);

  useEffect(() => {
    onScenarioTelemetryChange?.(scenario.dustPct, scenario.windKmh);
  }, [onScenarioTelemetryChange, scenario.dustPct, scenario.windKmh]);

  const [lastAlertAt, setLastAlertAt] = useState<string | null>(null);
  const [manualTicketSent, setManualTicketSent] = useState(false);
  const prevBelowRef = useRef<boolean>(false);

  // Compute simulated extreme-weather output and predictive diagnostics
  const scenarioPhysics = useMemo(() => {
    const dustFactor = Math.max(0.25, 1 - scenario.dustPct * 0.0068);
    const irradianceFactor = Math.max(0.18, 1 - scenario.cloudOpacityPct * 0.0072);
    const thermalDelta = Math.max(0, scenario.ambientTempC - 25);
    const thermalFactor = Math.max(0.7, 1 - thermalDelta * 0.0048);
    const windStowActive = scenario.windKmh >= 75;
    const stowFactor = windStowActive ? 0.65 : 1;

    const combinedFactor = dustFactor * irradianceFactor * thermalFactor * stowFactor;
    const projectedKw = Number(Math.max(5, expectedAvgKw * combinedFactor).toFixed(1));
    const projectedEfficiencyPct = Math.min(
      140,
      Math.max(2, Math.round((projectedKw / Math.max(1, expectedAvgKw)) * 100))
    );
    const efficiencyDropPct = Math.max(0, 100 - projectedEfficiencyPct);
    const soilingCleanUrgency: 'normal' | 'elevated' | 'critical' =
      scenario.dustPct >= 55 ? 'critical' : scenario.dustPct >= 30 ? 'elevated' : 'normal';

    const thermalHazard = scenario.ambientTempC >= 45;
    const stressIndex =
      scenario.dustPct * 0.45 +
      Math.max(0, scenario.ambientTempC - 30) * 1.4 +
      (windStowActive ? 25 : scenario.windKmh * 0.25) +
      scenario.cloudOpacityPct * 0.15;

    const predictiveFaultLeadHours = Math.max(
      2,
      Math.round(Math.max(2, 96 - stressIndex * 0.92))
    );

    let actionAr = 'الألواح في حالة تشغيل مستقرة ولا يلزم تدخل وقائي فوري.';
    let actionEn = 'Panels within healthy envelope; no immediate preventive intervention required.';

    if (scenario.dustPct >= 55 && windStowActive) {
      actionAr =
        'تفعيل قفل الأمان للمتتبعات ضد الرياح (Stow) وجدولة روبوت التنظيف الجاف وفحص مرشحات العاكس فوراً.';
      actionEn =
        'Lock trackers into wind-stow safety angle, schedule robotic dry-brush cleaning & inspect inverter filters.';
    } else if (scenario.dustPct >= 55) {
      actionAr =
        'جدولة غسيل وتنظيف روبوتي عاجل للألواح الشمسية بسبب تراكم الغبار الكثيف.';
      actionEn =
        'Dispatch urgent robotic solar canopy cleaning cycle due to heavy dust/sand soiling.';
    } else if (thermalHazard) {
      actionAr =
        'تفعيل التبريد المساعد للعاكس وتقليص تيار الشحن السريع DC لتفادي الإجهاد الحراري.';
      actionEn =
        'Activate auxiliary inverter cooling and throttle DC fast-charge draw to prevent thermal derating.';
    } else if (windStowActive) {
      actionAr =
        'تأمين زوايا الألواح في وضع الحماية من العاصفة الهوائية ومراجعة شدادات الهيكل.';
      actionEn =
        'Engage aerodynamic stow tilt angle across canopy trackers and verify structural mount torque.';
    } else if (projectedEfficiencyPct < 70) {
      actionAr =
        'انخفاض الإشعاع دون العتبة التشغيلية 70%: تفعيل تعويض BESS وفحص سلسلة الألواح.';
      actionEn =
        'Solar yield below 70% threshold: engage BESS compensation and run string impedance diagnostics.';
    }

    const activeLabelAr =
      scenario.presetId === 'custom'
        ? 'سيناريو طقس متطرف مخصص'
        : EXTREME_PRESETS[scenario.presetId].labelAr;
    const activeLabelEn =
      scenario.presetId === 'custom'
        ? 'Custom Extreme Scenario'
        : EXTREME_PRESETS[scenario.presetId].labelEn;

    return {
      projectedKw,
      projectedEfficiencyPct,
      efficiencyDropPct,
      windStowActive,
      thermalHazard,
      soilingCleanUrgency,
      predictiveFaultLeadHours,
      actionAr,
      actionEn,
      activeLabelAr,
      activeLabelEn,
    };
  }, [expectedAvgKw, scenario]);

  const activeScenarioSummary = useMemo(() => {
    const isNonNominal =
      scenario.presetId !== 'nominal' ||
      scenario.dustPct > 15 ||
      scenario.cloudOpacityPct > 25 ||
      scenario.ambientTempC > 38 ||
      scenario.windKmh > 55;
    if (!isNonNominal) return undefined;
    return {
      ar: `${scenarioPhysics.activeLabelAr} (غبار ${scenario.dustPct}% · سحب ${scenario.cloudOpacityPct}% · ${scenario.ambientTempC}°C · رياح ${scenario.windKmh} كم/س)`,
      en: `${scenarioPhysics.activeLabelEn} (dust ${scenario.dustPct}%, cloud ${scenario.cloudOpacityPct}%, ${scenario.ambientTempC}°C, wind ${scenario.windKmh} km/h)`,
    };
  }, [scenario, scenarioPhysics.activeLabelAr, scenarioPhysics.activeLabelEn]);

  const applyExtremeScenarioToGrid = useCallback(
    (forceTriggerAlert = false) => {
      if (!onAdjustSolarKw) return;
      onAdjustSolarKw(scenarioPhysics.projectedKw);
      if (forceTriggerAlert && (scenarioPhysics.projectedEfficiencyPct < 70 || scenarioPhysics.windStowActive || scenarioPhysics.thermalHazard)) {
        setManualTicketSent(true);
        setLastAlertAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        onTriggerMaintenanceAlert?.({
          efficiencyPct: scenarioPhysics.projectedEfficiencyPct,
          actualKw: scenarioPhysics.projectedKw,
          expectedAvgKw,
          weather,
          weatherLabel: lang === 'ar' ? weatherSpec.labelAr : weatherSpec.labelEn,
          scenarioSummaryAr: activeScenarioSummary?.ar,
          scenarioSummaryEn: activeScenarioSummary?.en,
        });
      }
    },
    [
      activeScenarioSummary,
      expectedAvgKw,
      lang,
      onAdjustSolarKw,
      onTriggerMaintenanceAlert,
      scenarioPhysics.projectedEfficiencyPct,
      scenarioPhysics.projectedKw,
      scenarioPhysics.thermalHazard,
      scenarioPhysics.windStowActive,
      weather,
      weatherSpec.labelAr,
      weatherSpec.labelEn,
    ]
  );

  // If Live Auto-Sync toggle is enabled, keep live solarKw matched to slider physics
  useEffect(() => {
    if (!liveSyncScenario || !onAdjustSolarKw) return;
    if (Math.abs(solarKw - scenarioPhysics.projectedKw) >= 0.4) {
      onAdjustSolarKw(scenarioPhysics.projectedKw);
    }
  }, [liveSyncScenario, onAdjustSolarKw, scenarioPhysics.projectedKw, solarKw]);

  // Trigger automatic maintenance alert on drop below 70% expected efficiency
  useEffect(() => {
    if (isBelow70 && !prevBelowRef.current) {
      prevBelowRef.current = true;
      setManualTicketSent(false);
      setLastAlertAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      onTriggerMaintenanceAlert?.({
        efficiencyPct: performancePct,
        actualKw: solarKw,
        expectedAvgKw,
        weather,
        weatherLabel: lang === 'ar' ? weatherSpec.labelAr : weatherSpec.labelEn,
        scenarioSummaryAr: activeScenarioSummary?.ar,
        scenarioSummaryEn: activeScenarioSummary?.en,
      });
    } else if (!isBelow70 && prevBelowRef.current) {
      prevBelowRef.current = false;
      setManualTicketSent(false);
    }
  }, [
    activeScenarioSummary,
    expectedAvgKw,
    isBelow70,
    lang,
    onTriggerMaintenanceAlert,
    performancePct,
    solarKw,
    weather,
    weatherSpec.labelAr,
    weatherSpec.labelEn,
  ]);

  const hourlyComparisonData = useMemo(() => {
    const hours = [
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ];
    const scenarioRatio = scenarioPhysics.projectedKw / Math.max(1, expectedAvgKw);
    return hours.map((hour, idx) => {
      const histKw = Number((expectedAvgKw * benchmark.hourlyShape[idx]).toFixed(1));
      const min70Kw = Number((histKw * 0.7).toFixed(1));
      const liveCurveFactor = idx === hours.length - 1 ? 1 : performancePct / 100;
      const realTimeKw =
        idx === hours.length - 1
          ? solarKw
          : Number(
              (
                histKw *
                Math.min(1.25, Math.max(0.15, liveCurveFactor + (idx % 2 === 0 ? 0.02 : -0.02)))
              ).toFixed(1)
            );
      const scenarioProjectedKw = Number(
        Math.max(4, histKw * scenarioRatio * (idx >= 5 && scenario.dustPct > 40 ? 0.92 : 1)).toFixed(1)
      );
      return {
        hour,
        historicalAvgKw: histKw,
        threshold70Kw: min70Kw,
        realTimeKw,
        scenarioProjectedKw,
      };
    });
  }, [
    benchmark.hourlyShape,
    expectedAvgKw,
    performancePct,
    scenario.dustPct,
    scenarioPhysics.projectedKw,
    solarKw,
  ]);

  const updateCustomParam = (patch: Partial<ExtremeWeatherParams>) => {
    setScenario((prev) => ({
      ...prev,
      ...patch,
      presetId: 'custom',
    }));
  };

  return (
    <div
      className={`rounded-xl border bg-[#0D1E2E] p-5 space-y-5 transition ${
        isBelow70 ? 'border-amber-400/70' : 'border-white/10'
      }`}
    >
      {/* Header & Weather Benchmark Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Gauge className={`h-5 w-5 ${isBelow70 ? 'text-amber-400' : 'text-amber-300'}`} />
            {t(
              lang,
              'مراقب الأداء الشمسي ومحاكي سيناريوهات الطقس المتطرفة',
              'Solar Performance Monitor & Extreme Weather Stress Tester'
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'مقارنة الإنتاج اللحظي للمظلات الشمسية بالمتوسط التاريخي وتخصيص سيناريوهات طقس قاسية لاختبار تنبيهات الصيانة التنبؤية (< 70%).',
              'Compares live solar yield against historical weather averages and simulates extreme weather stress scenarios for predictive maintenance alerts (< 70%).'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChangeWeather && (
            <div className="flex items-center rounded-lg border border-white/10 bg-[#08121D] p-1 gap-1">
              {(
                [
                  { id: 'sunny', icon: Sun, ar: 'مشمس', en: 'Sunny' },
                  { id: 'rainy', icon: CloudRain, ar: 'ممطر', en: 'Rainy' },
                  { id: 'stormy', icon: CloudLightning, ar: 'عاصف', en: 'Stormy' },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeWeather(item.id)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      weather === item.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {lang === 'ar' ? item.ar : item.en}
                  </button>
                );
              })}
            </div>
          )}

          {onAdjustSolarKw && (
            <button
              type="button"
              onClick={() => {
                if (isBelow70) {
                  setLiveSyncScenario(false);
                  setScenario(EXTREME_PRESETS.nominal);
                  onAdjustSolarKw(Math.min(250, Math.round(expectedAvgKw)));
                } else {
                  onAdjustSolarKw(Math.max(15, Math.round(expectedAvgKw * 0.52)));
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                isBelow70
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  : 'border-amber-400/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              {isBelow70 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t(lang, 'استعادة الكفاءة الطبيعية', 'Restore Expected Output')}
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t(lang, 'اختبار هبوط < 70%', 'Test <70% Drop Alert')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Maintenance Alert Banner when < 70% */}
      {isBelow70 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-xs text-red-100">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-200">
                {t(
                  lang,
                  `تنبيه صيانة تنبؤية نشط: كفاءة الألواح انخفضت إلى ${performancePct}% (أقل من 70% لطقس "${weatherSpec.labelAr}")`,
                  `Predictive Maintenance Alert: Solar efficiency dropped to ${performancePct}% (below 70% floor for ${weatherSpec.labelEn})`
                )}
              </div>
              <div className="mt-1 text-red-200/80 tabular-nums">
                {t(
                  lang,
                  `الإنتاج الحالي ${solarKw} kW مقابل المتوقع ${expectedAvgKw} kW (الحد الأدنى ${threshold70Kw} kW).${activeScenarioSummary ? ` · السبب: ${activeScenarioSummary.ar}` : ''}${lastAlertAt ? ` · رُصد ${lastAlertAt}` : ''}`,
                  `Actual ${solarKw} kW vs. historical ${expectedAvgKw} kW (70% floor: ${threshold70Kw} kW).${activeScenarioSummary ? ` · Factor: ${activeScenarioSummary.en}` : ''}${lastAlertAt ? ` · Logged ${lastAlertAt}` : ''}`
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={manualTicketSent}
            onClick={() => {
              setManualTicketSent(true);
              onTriggerMaintenanceAlert?.({
                efficiencyPct: performancePct,
                actualKw: solarKw,
                expectedAvgKw,
                weather,
                weatherLabel: lang === 'ar' ? weatherSpec.labelAr : weatherSpec.labelEn,
                scenarioSummaryAr: activeScenarioSummary?.ar,
                scenarioSummaryEn: activeScenarioSummary?.en,
              });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-400 disabled:opacity-60 whitespace-nowrap"
          >
            <Wrench className="h-3.5 w-3.5" />
            {manualTicketSent
              ? t(lang, 'تم إرسال أمر الصيانة ✓', 'Maintenance Ticket Dispatched ✓')
              : t(lang, 'إرسال بلاغ صيانة الألواح', 'Dispatch Panel Maintenance')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              {t(
                lang,
                `أداء الألواح ضمن النطاق الطبيعي (${performancePct}% من المعدل التاريخي لطقس "${weatherSpec.labelAr}" · الحد الأدنى للصيانة: ${threshold70Kw} kW).`,
                `Solar array operating nominally (${performancePct}% of historical ${weatherSpec.labelEn} average · Maintenance floor: ${threshold70Kw} kW).`
              )}
            </span>
          </div>
          <span className="font-mono text-emerald-300 font-bold tabular-nums">≥ 70% OK</span>
        </div>
      )}

      {/* Extreme Weather Scenario Customizer & Predictive Maintenance Stress Sandbox */}
      <div className="rounded-xl border border-cyan-400/25 bg-[#08121D] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              {t(
                lang,
                'مُخصِّص سيناريوهات الطقس المتطرفة (عواصف رملية / موجات حر / برد)',
                'Extreme Weather Scenario Designer (Sandstorms / Heatwaves / Hail)'
              )}
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t(
                lang,
                'اختر سيناريو جاهزاً أو عدّل شدة الغبار، الحرارة، السحب والرياح لاختبار هبوط الكفاءة وإطلاق تنبيهات الصيانة التنبؤية.',
                'Select an extreme preset or customize dust, temperature, irradiance blocking, and wind sliders to test panel derating and predictive maintenance.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={liveSyncScenario}
                onChange={(e) => setLiveSyncScenario(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>{t(lang, 'تطبيق لحظي مباشر على الشبكة', 'Live Auto-Sync Grid')}</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setLiveSyncScenario(false);
                setScenario(EXTREME_PRESETS.nominal);
                onAdjustSolarKw?.(Math.min(250, Math.round(expectedAvgKw)));
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0D1E2E] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              {t(lang, 'إعادة ضبط', 'Reset')}
            </button>
          </div>
        </div>

        {/* Preset Selector Buttons */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(
            [
              {
                id: 'nominal',
                icon: Sun,
                activeCls: 'border-emerald-400 bg-emerald-500/15 text-emerald-300',
              },
              {
                id: 'sandstorm',
                icon: Wind,
                activeCls: 'border-amber-400 bg-amber-500/20 text-amber-200',
              },
              {
                id: 'heatwave',
                icon: Flame,
                activeCls: 'border-red-400 bg-red-500/15 text-red-200',
              },
              {
                id: 'monsoon_hail',
                icon: CloudHail,
                activeCls: 'border-cyan-400 bg-cyan-500/15 text-cyan-200',
              },
            ] as const
          ).map((item) => {
            const preset = EXTREME_PRESETS[item.id];
            const Icon = item.icon;
            const isSelected = scenario.presetId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScenario(preset)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs font-bold transition ${
                  isSelected
                    ? item.activeCls
                    : 'border-white/10 bg-[#0D1E2E] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">{lang === 'ar' ? preset.labelAr : preset.labelEn}</div>
                  <div className="text-[10px] font-mono opacity-75 tabular-nums">
                    {preset.dustPct}% {t(lang, 'غبار', 'dust')} · {preset.ambientTempC}°C
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 4 Extreme Scenario Sliders */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-[#0D1E2E] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">
                {t(lang, 'تراكم الغبار والرمل', 'Dust & Sand Soiling')}
              </span>
              <span className="font-mono font-bold text-amber-300 tabular-nums">
                {scenario.dustPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={2}
              value={scenario.dustPct}
              onChange={(e) => updateCustomParam({ dustPct: Number(e.target.value) })}
              className="mt-2 w-full accent-amber-400"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0D1E2E] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">
                {t(lang, 'حجب الإشعاع والسحب', 'Irradiance Blocking')}
              </span>
              <span className="font-mono font-bold text-cyan-300 tabular-nums">
                {scenario.cloudOpacityPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={95}
              step={2}
              value={scenario.cloudOpacityPct}
              onChange={(e) => updateCustomParam({ cloudOpacityPct: Number(e.target.value) })}
              className="mt-2 w-full accent-cyan-400"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0D1E2E] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">
                {t(lang, 'درجة الحرارة المحيطة', 'Ambient Temperature')}
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  scenario.ambientTempC >= 45 ? 'text-red-400' : 'text-orange-300'
                }`}
              >
                {scenario.ambientTempC}°C
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={62}
              step={1}
              value={scenario.ambientTempC}
              onChange={(e) => updateCustomParam({ ambientTempC: Number(e.target.value) })}
              className="mt-2 w-full accent-orange-400"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0D1E2E] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">
                {t(lang, 'سرعة العاصفة الهوائية', 'Wind Gust Speed')}
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  scenario.windKmh >= 75 ? 'text-red-400' : 'text-emerald-300'
                }`}
              >
                {scenario.windKmh} km/h
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={115}
              step={2}
              value={scenario.windKmh}
              onChange={(e) => updateCustomParam({ windKmh: Number(e.target.value) })}
              className="mt-2 w-full accent-emerald-400"
            />
          </div>
        </div>

        {/* Predictive Impact Summary Bar & Apply CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] p-3.5">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <div className="text-[10px] text-slate-400">
                {t(lang, 'الإنتاج المحاكى بالسيناريو', 'Simulated Output')}
              </div>
              <div className="font-mono text-base font-extrabold text-amber-300 tabular-nums">
                {scenarioPhysics.projectedKw} kW
              </div>
            </div>

            <div className="h-7 w-px bg-white/10" />

            <div>
              <div className="text-[10px] text-slate-400">
                {t(lang, 'الكفاءة المتوقعة', 'Projected Efficiency')}
              </div>
              <div
                className={`font-mono text-base font-extrabold tabular-nums ${
                  scenarioPhysics.projectedEfficiencyPct < 70
                    ? 'text-red-400'
                    : 'text-emerald-400'
                }`}
              >
                {scenarioPhysics.projectedEfficiencyPct}%
              </div>
            </div>

            <div className="h-7 w-px bg-white/10" />

            <div>
              <div className="text-[10px] text-slate-400">
                {t(lang, 'المهلة التنبؤية قبل العطل', 'Predictive Fault Lead Time')}
              </div>
              <div className="font-mono text-base font-extrabold text-cyan-300 tabular-nums">
                {scenarioPhysics.predictiveFaultLeadHours}h
              </div>
            </div>

            <div className="hidden xl:block h-7 w-px bg-white/10" />

            <div className="max-w-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                <ShieldAlert
                  className={`h-3.5 w-3.5 ${
                    scenarioPhysics.projectedEfficiencyPct < 70
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                />
                <span>
                  {scenarioPhysics.windStowActive
                    ? t(lang, 'حماية المتتبعات (Stow) نشطة ≥ 75 كم/س', 'Wind Stow Active (≥ 75 km/h)')
                    : t(lang, 'توصية الصيانة التنبؤية:', 'Predictive Recommendation:')}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                {lang === 'ar' ? scenarioPhysics.actionAr : scenarioPhysics.actionEn}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => applyExtremeScenarioToGrid(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300 transition whitespace-nowrap"
          >
            <Wrench className="h-3.5 w-3.5" />
            {t(
              lang,
              'تطبيق السيناريو واختبار التنبيهات',
              'Apply Scenario & Trigger Predictive Check'
            )}
          </button>
        </div>
      </div>

      {/* 4 Benchmark Readouts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(lang, 'الإنتاج اللحظي الفعلي', 'Real-Time Output')}
          </div>
          <div className="mt-1 font-mono text-xl font-extrabold text-amber-400 tabular-nums">
            {solarKw} kW
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(
              lang,
              `المعدل التاريخي (${weatherSpec.labelAr})`,
              `Historical Avg (${weatherSpec.labelEn})`
            )}
          </div>
          <div className="mt-1 font-mono text-xl font-extrabold text-cyan-300 tabular-nums">
            {expectedAvgKw} kW
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(lang, 'الكفاءة مقارنة بالتاريخي', 'Efficiency vs. Historical')}
          </div>
          <div
            className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
              isBelow70 ? 'text-red-400' : performancePct >= 95 ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {performancePct}%
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="text-[11px] text-slate-400">
            {t(lang, 'الفارق عن المعدل المتوقع', 'Output Variance')}
          </div>
          <div
            className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
              varianceKw >= 0 ? 'text-emerald-400' : isBelow70 ? 'text-red-400' : 'text-amber-300'
            }`}
          >
            {varianceKw >= 0 ? '+' : ''}
            {varianceKw} kW
          </div>
        </div>
      </div>

      {/* Interactive Recharts Comparison: Real-Time vs Historical Avg, Extreme Scenario Curve & 70% Floor */}
      <div className="rounded-xl bg-[#08121D] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-200">
            {t(
              lang,
              `منحنى مقارنة الإنتاج اللحظي بالمتوسط التاريخي وتوقع "${scenarioPhysics.activeLabelAr}"`,
              `Live Output vs. Historical ${weatherSpec.labelEn} Curve & "${scenarioPhysics.activeLabelEn}"`
            )}
          </span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            {t(lang, `عتبة الإنذار (70%): ${threshold70Kw} kW`, `70% Maintenance Floor: ${threshold70Kw} kW`)}
          </span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyComparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="histSolarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B1927',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <ReferenceLine
                y={threshold70Kw}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{
                  value: t(lang, `70% (${threshold70Kw} kW)`, `70% Alert (${threshold70Kw} kW)`),
                  fill: '#FCA5A5',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Area
                type="monotone"
                dataKey="historicalAvgKw"
                name={t(lang, 'المتوسط التاريخي للطقس (kW)', 'Historical Weather Avg (kW)')}
                stroke="#06B6D4"
                strokeWidth={2}
                fill="url(#histSolarFill)"
              />
              <Line
                type="monotone"
                dataKey="threshold70Kw"
                name={t(lang, 'عتبة الصيانة 70% (kW)', '70% Efficiency Floor (kW)')}
                stroke="#EF4444"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="scenarioProjectedKw"
                name={t(lang, 'توقع سيناريو الطقس المتطرف (kW)', 'Extreme Scenario Forecast (kW)')}
                stroke="#C084FC"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="realTimeKw"
                name={t(lang, 'الإنتاج الفعلي اللحظي (kW)', 'Real-Time Output (kW)')}
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#F59E0B' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
