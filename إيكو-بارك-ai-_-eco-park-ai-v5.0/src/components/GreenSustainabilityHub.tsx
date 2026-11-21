import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Droplets,
  Leaf,
  Sprout,
  ThermometerSnowflake,
  TreePine,
  Wind,
} from 'lucide-react';
import { Language, ParkingSpot, Reservation } from '../types/parking';
import { t } from '../data/i18n';

interface GreenSustainabilityHubProps {
  lang: Language;
  reservations: Reservation[];
  spots: ParkingSpot[];
  solarKw: number;
  totalCo2Kg: number;
  totalCarbonTaxSar: number;
  onLogGreenAction?: (actionAr: string, actionEn: string, bonusPoints?: number) => void;
  onNotify: (msg: string) => void;
}

type FloraType = 'palm' | 'sidr' | 'bioswale_shrub' | 'living_wall';

const FLORA_SPECS: Record<
  FloraType,
  {
    labelAr: string;
    labelEn: string;
    costSar: number;
    co2PerYearKg: number;
    coolingC: number;
    waterLitersDay: number;
  }
> = {
  palm: {
    labelAr: 'نخيل مستدام (Shade Date Palm)',
    labelEn: 'Sustainable Date Palm',
    costSar: 35,
    co2PerYearKg: 28,
    coolingC: 0.14,
    waterLitersDay: 6,
  },
  sidr: {
    labelAr: 'شجرة سدر وأكاسيا صحراوية',
    labelEn: 'Native Sidr & Acacia Tree',
    costSar: 25,
    co2PerYearKg: 24,
    coolingC: 0.12,
    waterLitersDay: 3.5,
  },
  bioswale_shrub: {
    labelAr: 'حزام شجيرات حيوية لامتصاص الكربون',
    labelEn: 'Biophilic CO2 Bioswale Strip',
    costSar: 20,
    co2PerYearKg: 19,
    coolingC: 0.1,
    waterLitersDay: 2.2,
  },
  living_wall: {
    labelAr: 'جدار أخضر عمودي لتبريد BESS',
    labelEn: 'Vertical Living Wall (BESS Cooling)',
    costSar: 50,
    co2PerYearKg: 42,
    coolingC: 0.24,
    waterLitersDay: 4.5,
  },
};

export const GreenSustainabilityHub: React.FC<GreenSustainabilityHubProps> = ({
  lang,
  reservations,
  spots,
  solarKw,
  totalCo2Kg,
  totalCarbonTaxSar,
  onLogGreenAction,
  onNotify,
}) => {
  const [selectedFlora, setSelectedFlora] = useState<FloraType>('sidr');
  const [plantedCounts, setPlantedCounts] = useState<Record<FloraType, number>>(() => {
    try {
      const saved = window.localStorage.getItem('ecopark_green_assets');
      if (saved) return JSON.parse(saved) as Record<FloraType, number>;
      if (window.localStorage.getItem('ecopark_zero_mock_mode') === 'true') {
        return { palm: 0, sidr: 0, bioswale_shrub: 0, living_wall: 0 };
      }
    } catch {
      // ignore invalid JSON
    }
    return {
      palm: 10,
      sidr: 14,
      bioswale_shrub: 18,
      living_wall: 4,
    };
  });
  const [dripRecycledWaterEnabled, setDripRecycledWaterEnabled] = useState<boolean>(true);
  const [lastPlantedAt, setLastPlantedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('ecopark_green_assets', JSON.stringify(plantedCounts));
    } catch {
      // ignore quota
    }
  }, [plantedCounts]);

  useEffect(() => {
    const syncAssets = () => {
      try {
        const saved = window.localStorage.getItem('ecopark_green_assets');
        if (saved) {
          const parsed = JSON.parse(saved) as Record<FloraType, number>;
          setPlantedCounts(parsed);
        }
      } catch {
        // ignore invalid JSON
      }
    };
    const handleWipe = () => {
      try {
        const saved = window.localStorage.getItem('ecopark_green_assets');
        if (saved) {
          setPlantedCounts(JSON.parse(saved) as Record<FloraType, number>);
        } else {
          setPlantedCounts({ palm: 0, sidr: 0, bioswale_shrub: 0, living_wall: 0 });
        }
      } catch {
        setPlantedCounts({ palm: 0, sidr: 0, bioswale_shrub: 0, living_wall: 0 });
      }
      setLastPlantedAt(null);
    };
    window.addEventListener('ecopark-green-assets-updated', syncAssets);
    window.addEventListener('ecopark-data-wiped', handleWipe);
    return () => {
      window.removeEventListener('ecopark-green-assets-updated', syncAssets);
      window.removeEventListener('ecopark-data-wiped', handleWipe);
    };
  }, []);

  const greenMetrics = useMemo(() => {
    const autoTaxFundedTrees = Math.floor(totalCarbonTaxSar / 20);
    const evCount = spots.filter((s) => s.hasCharger).length;
    const manualTotal =
      plantedCounts.palm +
      plantedCounts.sidr +
      plantedCounts.bioswale_shrub +
      plantedCounts.living_wall;
    const totalGreenUnits = manualTotal + autoTaxFundedTrees;

    const annualCo2SeqKg = Math.round(
      plantedCounts.palm * FLORA_SPECS.palm.co2PerYearKg +
        plantedCounts.sidr * FLORA_SPECS.sidr.co2PerYearKg +
        plantedCounts.bioswale_shrub * FLORA_SPECS.bioswale_shrub.co2PerYearKg +
        plantedCounts.living_wall * FLORA_SPECS.living_wall.co2PerYearKg +
        autoTaxFundedTrees * 22
    );

    const microclimateCoolingC = Number(
      Math.min(
        4.8,
        1.2 +
          plantedCounts.palm * 0.04 +
          plantedCounts.sidr * 0.03 +
          plantedCounts.living_wall * 0.16 +
          (dripRecycledWaterEnabled ? 0.35 : 0)
      ).toFixed(1)
    );

    // Solar atmospheric humidity condensation + AC greywater reuse covers drip needs cleanly
    const condensateWaterYieldLitersDay = Math.round(65 + solarKw * 0.35 + evCount * 4);
    const totalIrrigationNeed = Math.round(
      plantedCounts.palm * FLORA_SPECS.palm.waterLitersDay +
        plantedCounts.sidr * FLORA_SPECS.sidr.waterLitersDay +
        plantedCounts.bioswale_shrub * FLORA_SPECS.bioswale_shrub.waterLitersDay +
        plantedCounts.living_wall * FLORA_SPECS.living_wall.waterLitersDay
    );
    const selfSustainedWaterPct = Math.min(
      100,
      Math.round((condensateWaterYieldLitersDay / Math.max(1, totalIrrigationNeed)) * 100)
    );

    const aqiImprovementPct = Math.min(48, Math.round(14 + totalGreenUnits * 0.45));

    const chartData = (Object.keys(FLORA_SPECS) as FloraType[]).map((key) => ({
      name:
        lang === 'ar'
          ? key === 'palm'
            ? 'نخيل'
            : key === 'sidr'
              ? 'سدر'
              : key === 'bioswale_shrub'
                ? 'أحزمة حيوية'
                : 'جدران خضراء'
          : key === 'palm'
            ? 'Palms'
            : key === 'sidr'
              ? 'Sidr'
              : key === 'bioswale_shrub'
                ? 'Bioswales'
                : 'Living Walls',
      co2KgYear: plantedCounts[key] * FLORA_SPECS[key].co2PerYearKg,
      count: plantedCounts[key],
      key,
    }));

    return {
      autoTaxFundedTrees,
      totalGreenUnits,
      annualCo2SeqKg,
      microclimateCoolingC,
      condensateWaterYieldLitersDay,
      selfSustainedWaterPct,
      aqiImprovementPct,
      chartData,
    };
  }, [dripRecycledWaterEnabled, lang, plantedCounts, solarKw, spots, totalCarbonTaxSar]);

  const handlePlantFlora = () => {
    const spec = FLORA_SPECS[selectedFlora];
    setPlantedCounts((prev) => ({
      ...prev,
      [selectedFlora]: prev[selectedFlora] + 1,
    }));
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastPlantedAt(timeStr);
    onLogGreenAction?.(
      `زراعة ${spec.labelAr} ضمن الحزام الأخضر المستدام (+${spec.co2PerYearKg} kg CO2/سنة)`,
      `Planted ${spec.labelEn} in Eco-Park Green Belt (+${spec.co2PerYearKg} kg CO2/yr)`,
      20
    );
    onNotify(
      t(
        lang,
        `تمت زراعة ${spec.labelAr} وإضافتها للبيئة المستدامة الخضراء (+20 نقطة كربون)!`,
        `Planted ${spec.labelEn} into Green Environment Belt (+20 carbon points)!`
      )
    );
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-[#0D1E2E] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TreePine className="h-5 w-5 text-emerald-400" />
            {t(
              lang,
              'منظومة البيئة المستدامة الخضراء والتشجير البيوفيلي (Green Sustainability Ecosystem)',
              'Green Sustainable Environment, Biophilic Cooling & Afforestation Hub'
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'تحول حصيلة ضريبة الكربون والطاقة الشمسية إلى أحزمة تشجير وجدران خضراء حية تُخفض الحرارة الموضعية وتنقي الهواء دون هدر للمياه.',
              'Converts carbon tax reserves and solar condensate water into living green walls and native drought-resilient flora to cool the parking microclimate.'
            )}
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-emerald-200 cursor-pointer">
          <input
            type="checkbox"
            checked={dripRecycledWaterEnabled}
            onChange={(e) => setDripRecycledWaterEnabled(e.target.checked)}
            className="accent-emerald-400"
          />
          <Droplets className="h-3.5 w-3.5 text-cyan-400" />
          <span>{t(lang, 'الري الذكي بالمياه المعاد تدويرها', 'Smart Recycled Drip Irrigation')}</span>
        </label>
      </div>

      {/* 4 Sustainability Impact Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'إجمالي الوحدات والأشجار الخضراء', 'Active Green Flora')}</span>
            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
            {greenMetrics.totalGreenUnits}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {t(
              lang,
              `تشمل ${greenMetrics.autoTaxFundedTrees} ممولة من ضريبة الكربون`,
              `Includes ${greenMetrics.autoTaxFundedTrees} carbon-tax funded`
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'امتصاص الكربون السنوي للأشجار', 'Bio-CO2 Sequestered / Yr')}</span>
            <Leaf className="h-3.5 w-3.5 text-teal-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-teal-300 tabular-nums">
            {greenMetrics.annualCo2SeqKg.toLocaleString()} kg
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {t(
              lang,
              `إجمالي وفر الحجوزات: ${totalCo2Kg.toFixed(1)} kg CO2`,
              `Trip savings: ${totalCo2Kg.toFixed(1)} kg CO2 (${reservations.length} stays)`
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'تبريد الجزيرة الحرارية (Bio-Cool)', 'Urban Heat-Island Cooling')}</span>
            <ThermometerSnowflake className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-300 tabular-nums">
            -{greenMetrics.microclimateCoolingC}°C
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {t(
              lang,
              `تحسن جودة الهواء AQI: +${greenMetrics.aqiImprovementPct}%`,
              `Ambient AQI improvement: +${greenMetrics.aqiImprovementPct}%`
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#08121D] p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t(lang, 'الاكتفاء الذاتي لمياه الري', 'Self-Sustained Irrigation')}</span>
            <Wind className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-sky-300 tabular-nums">
            {greenMetrics.selfSustainedWaterPct}%
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
            {greenMetrics.condensateWaterYieldLitersDay} L/{t(lang, 'يوم تقطير شمسي', 'day condensate')}
          </div>
        </div>
      </div>

      {/* Interactive Green Planting Action + Bio-Sequestration Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6 rounded-xl bg-[#08121D] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">
              {t(lang, 'توسيع الغطاء الأخضر وتمويل التشجير الفوري', 'Expand Sustainable Green Belt & Native Flora')}
            </h3>
            {lastPlantedAt && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {lastPlantedAt}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(FLORA_SPECS) as FloraType[]).map((key) => {
              const item = FLORA_SPECS[key];
              const active = selectedFlora === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedFlora(key)}
                  className={`rounded-lg border p-2.5 text-start text-xs transition ${
                    active
                      ? 'border-emerald-400 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-[#0D1E2E] text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="font-bold truncate">
                    {lang === 'ar' ? item.labelAr : item.labelEn}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>+{item.co2PerYearKg} kg CO2/y</span>
                    <span className="text-emerald-400 font-bold">×{plantedCounts[key]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handlePlantFlora}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition"
          >
            <Sprout className="h-4 w-4" />
            {t(
              lang,
              `زراعة وتمويل وحدة جديدة (+${FLORA_SPECS[selectedFlora].co2PerYearKg} kg CO2/سنة · +20 نقطة)`,
              `Plant & Fund New Unit (+${FLORA_SPECS[selectedFlora].co2PerYearKg} kg CO2/yr · +20 pts)`
            )}
          </button>
        </div>

        <div className="lg:col-span-6 rounded-xl bg-[#08121D] p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              {t(lang, 'توزيع امتصاص الكربون السنوي حسب الغطاء النباتي (kg CO2/yr)', 'Annual CO2 Absorption by Green Flora Zone (kg/yr)')}
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={greenMetrics.chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} unit=" kg" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1927',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="co2KgYear" radius={[6, 6, 0, 0]} name={t(lang, 'امتصاص CO2 (كجم/سنة)', 'CO2 Sequestered (kg/yr)')}>
                  {greenMetrics.chartData.map((entry, idx) => (
                    <Cell
                      key={entry.key}
                      fill={
                        idx === 0
                          ? '#10B981'
                          : idx === 1
                            ? '#34D399'
                            : idx === 2
                              ? '#14B8A6'
                              : '#06B6D4'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
