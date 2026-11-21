import React, { useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Leaf,
  Loader2,
  Sparkles,
  Trees,
  Zap,
} from 'lucide-react';
import {
  CarbonTransaction,
  Language,
  ParkingSpot,
  ProjectSettings,
  Reservation,
  V2GSession,
  VehicleType,
} from '../types/parking';
import { t } from '../data/i18n';

interface AnnualSustainabilityReportProps {
  lang: Language;
  spots: ParkingSpot[];
  reservations: Reservation[];
  transactions: CarbonTransaction[];
  v2gSessions: V2GSession[];
  solarKw: number;
  bessCharge: number;
  ecoConservation: boolean;
  smartNightActive: boolean;
  projectSettings: ProjectSettings;
  onNotify?: (msgAr: string, msgEn: string) => void;
}

type ReportYear = 2026 | 2025;
type FleetScopeFilter = 'all' | 'ev_hybrid' | 'ice_transition';

interface MonthlySustainabilityPoint {
  monthKey: string;
  monthAr: string;
  monthEn: string;
  gridKwh: number;
  solarBessKwh: number;
  v2gKwh: number;
  cleanSharePct: number;
  baselineCo2Kg: number;
  actualCo2Kg: number;
  avoidedCo2Kg: number;
  nightEcoSavedKwh: number;
}

interface FleetSegmentBreakdown {
  type: VehicleType;
  labelAr: string;
  labelEn: string;
  activeVehicles: number;
  annualTrips: number;
  annualEnergyKwh: number;
  baselineCo2Kg: number;
  actualCo2Kg: number;
  avoidedCo2Kg: number;
  reductionPct: number;
}

const MONTHS = [
  { key: '01', ar: 'يناير', en: 'Jan', solarFactor: 0.72, trafficFactor: 0.86 },
  { key: '02', ar: 'فبراير', en: 'Feb', solarFactor: 0.78, trafficFactor: 0.89 },
  { key: '03', ar: 'مارس', en: 'Mar', solarFactor: 0.88, trafficFactor: 0.94 },
  { key: '04', ar: 'أبريل', en: 'Apr', solarFactor: 0.96, trafficFactor: 0.98 },
  { key: '05', ar: 'مايو', en: 'May', solarFactor: 1.06, trafficFactor: 1.02 },
  { key: '06', ar: 'يونيو', en: 'Jun', solarFactor: 1.14, trafficFactor: 1.08 },
  { key: '07', ar: 'يوليو', en: 'Jul', solarFactor: 1.18, trafficFactor: 1.12 },
  { key: '08', ar: 'أغسطس', en: 'Aug', solarFactor: 1.15, trafficFactor: 1.1 },
  { key: '09', ar: 'سبتمبر', en: 'Sep', solarFactor: 1.04, trafficFactor: 1.04 },
  { key: '10', ar: 'أكتوبر', en: 'Oct', solarFactor: 0.94, trafficFactor: 1.01 },
  { key: '11', ar: 'نوفمبر', en: 'Nov', solarFactor: 0.84, trafficFactor: 0.96 },
  { key: '12', ar: 'ديسمبر', en: 'Dec', solarFactor: 0.76, trafficFactor: 0.93 },
];

async function svgElementToPngDataUrl(
  container: HTMLElement | null,
  titleText: string,
  subtitleText: string,
  isRtl: boolean
): Promise<string | null> {
  if (!container) return null;
  const svg = container.querySelector('svg.recharts-surface') as SVGSVGElement | null;
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const svgWidth = Math.max(640, Math.round(rect.width || 720));
  const svgHeight = Math.max(260, Math.round(rect.height || 290));

  const cloned = svg.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('width', String(svgWidth));
  cloned.setAttribute('height', String(svgHeight));
  cloned.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  // Ensure crisp readable text on white PDF paper
  cloned.querySelectorAll('text, tspan').forEach((node) => {
    const fill = node.getAttribute('fill');
    if (!fill || fill === '#94a3b8' || fill === '#cbd5e1' || fill === '#e2e8f0' || fill === '#ffffff') {
      node.setAttribute('fill', '#334155');
    }
    node.setAttribute('font-family', 'Cairo, Arial, sans-serif');
  });

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(cloned);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = svgUrl;
    });

    const scale = 2;
    const headerH = 68;
    const pad = 22;
    const canvas = document.createElement('canvas');
    canvas.width = (svgWidth + pad * 2) * scale;
    canvas.height = (svgHeight + headerH + pad) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, svgWidth + pad * 2, svgHeight + headerH + pad);

    // Subtle card border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, svgWidth + pad * 2 - 2, svgHeight + headerH + pad - 2);

    // Header band
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(2, 2, svgWidth + pad * 2 - 4, 54);

    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    const textX = isRtl ? svgWidth + pad : pad;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Cairo, Arial, sans-serif';
    ctx.fillText(titleText, textX, 26);

    ctx.fillStyle = '#475569';
    ctx.font = '12px Cairo, Arial, sans-serif';
    ctx.fillText(subtitleText, textX, 46);

    ctx.drawImage(img, pad, headerH, svgWidth, svgHeight);
    return canvas.toDataURL('image/png', 1.0);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export const AnnualSustainabilityReport: React.FC<AnnualSustainabilityReportProps> = ({
  lang,
  spots,
  reservations,
  transactions,
  v2gSessions,
  solarKw,
  bessCharge,
  ecoConservation,
  smartNightActive,
  projectSettings,
  onNotify,
}) => {
  const [selectedYear, setSelectedYear] = useState<ReportYear>(2026);
  const [fleetScope, setFleetScope] = useState<FleetScopeFilter>('all');
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [lastExportName, setLastExportName] = useState<string>('');

  const energyChartRef = useRef<HTMLDivElement | null>(null);
  const carbonChartRef = useRef<HTMLDivElement | null>(null);

  const telemetrySnapshot = useMemo(() => {
    const evParked = spots.filter((s) => s.vehicleType === 'ELECTRIC').length;
    const hybridParked = spots.filter((s) => s.vehicleType === 'HYBRID').length;
    const gasParked = spots.filter((s) => s.vehicleType === 'GASOLINE').length;
    const dieselParked = spots.filter((s) => s.vehicleType === 'DIESEL').length;

    const totalTxCo2 = transactions.reduce((acc, item) => acc + Math.max(0, item.co2Kg), 0);
    const activeV2gKwh = v2gSessions.reduce((acc, s) => acc + Math.max(0, s.energyKwh), 0);

    const resByType: Record<VehicleType, number> = {
      ELECTRIC: reservations.filter((r) => r.vehicleType === 'ELECTRIC').length,
      HYBRID: reservations.filter((r) => r.vehicleType === 'HYBRID').length,
      GASOLINE: reservations.filter((r) => r.vehicleType === 'GASOLINE').length,
      DIESEL: reservations.filter((r) => r.vehicleType === 'DIESEL').length,
    };

    const nightReductionFactor = projectSettings.smartNightModeEnabled
      ? (projectSettings.nightPowerReductionPct || 35) / 100
      : 0.12;
    const ecoBoost = ecoConservation ? 1.12 : 1.0;

    return {
      evParked,
      hybridParked,
      gasParked,
      dieselParked,
      totalTxCo2,
      activeV2gKwh,
      resByType,
      nightReductionFactor,
      ecoBoost,
    };
  }, [ecoConservation, projectSettings, reservations, spots, transactions, v2gSessions]);

  const monthlyData = useMemo<MonthlySustainabilityPoint[]>(() => {
    const yearScale = selectedYear === 2026 ? 1.0 : 0.84;
    const scopeGridMult =
      fleetScope === 'ev_hybrid' ? 0.62 : fleetScope === 'ice_transition' ? 1.18 : 1.0;
    const scopeCo2Mult =
      fleetScope === 'ev_hybrid' ? 0.86 : fleetScope === 'ice_transition' ? 0.54 : 1.0;

    const baseSolarOutput = Math.max(120, solarKw * 4.6 + bessCharge * 2.1);
    const txBoost = Math.max(1, 1 + telemetrySnapshot.totalTxCo2 / 420);

    return MONTHS.map((m, idx) => {
      // Progressive electrification shift across the 12 months
      const shiftProgression =
        selectedYear === 2026 ? 0.56 + idx * 0.032 : 0.41 + idx * 0.025;
      const totalDemandKwh = Math.round(
        (2480 * m.trafficFactor * scopeGridMult * yearScale) / telemetrySnapshot.ecoBoost
      );
      const solarBessKwh = Math.min(
        totalDemandKwh,
        Math.round(
          (baseSolarOutput * 5.2 * m.solarFactor * shiftProgression +
            telemetrySnapshot.activeV2gKwh * 4.5) *
            yearScale
        )
      );
      const v2gKwh = Math.round(
        (190 + telemetrySnapshot.activeV2gKwh * 6 + idx * 14) * m.trafficFactor * yearScale
      );
      const cleanKwh = Math.min(totalDemandKwh + 120, solarBessKwh + Math.round(v2gKwh * 0.55));
      const gridKwh = Math.max(180, totalDemandKwh - cleanKwh);
      const cleanSharePct = Math.min(
        96,
        Math.round((cleanKwh / Math.max(1, gridKwh + cleanKwh)) * 100)
      );

      const nightEcoSavedKwh = Math.round(
        totalDemandKwh *
          telemetrySnapshot.nightReductionFactor *
          0.32 *
          (smartNightActive ? 1.08 : 1.0)
      );

      const baselineCo2Kg = Math.round(
        1860 * m.trafficFactor * scopeGridMult * yearScale * txBoost * 0.35
      );
      const avoidedCo2Kg = Math.round(
        baselineCo2Kg * Math.min(0.88, (cleanSharePct / 100) * 0.86 * scopeCo2Mult + 0.14)
      );
      const actualCo2Kg = Math.max(95, baselineCo2Kg - avoidedCo2Kg);

      return {
        monthKey: m.key,
        monthAr: m.ar,
        monthEn: m.en,
        gridKwh,
        solarBessKwh,
        v2gKwh,
        cleanSharePct,
        baselineCo2Kg,
        actualCo2Kg,
        avoidedCo2Kg,
        nightEcoSavedKwh,
      };
    });
  }, [bessCharge, fleetScope, selectedYear, smartNightActive, solarKw, telemetrySnapshot]);

  const fleetBreakdown = useMemo<FleetSegmentBreakdown[]>(() => {
    const yearScale = selectedYear === 2026 ? 1.0 : 0.86;
    const allSegments: FleetSegmentBreakdown[] = [
      {
        type: 'ELECTRIC',
        labelAr: 'المركبات الكهربائية (BEV)',
        labelEn: 'Battery Electric (EV)',
        activeVehicles: Math.max(4, telemetrySnapshot.evParked + telemetrySnapshot.resByType.ELECTRIC + 14),
        annualTrips: Math.round((420 + telemetrySnapshot.resByType.ELECTRIC * 18) * yearScale),
        annualEnergyKwh: Math.round(14250 * yearScale),
        baselineCo2Kg: Math.round(6420 * yearScale),
        actualCo2Kg: Math.round(810 * yearScale),
        avoidedCo2Kg: Math.round(5610 * yearScale),
        reductionPct: 87,
      },
      {
        type: 'HYBRID',
        labelAr: 'المركبات الهجينة (HEV / PHEV)',
        labelEn: 'Hybrid Fleet (HEV/PHEV)',
        activeVehicles: Math.max(3, telemetrySnapshot.hybridParked + telemetrySnapshot.resByType.HYBRID + 9),
        annualTrips: Math.round((310 + telemetrySnapshot.resByType.HYBRID * 14) * yearScale),
        annualEnergyKwh: Math.round(6820 * yearScale),
        baselineCo2Kg: Math.round(4840 * yearScale),
        actualCo2Kg: Math.round(1920 * yearScale),
        avoidedCo2Kg: Math.round(2920 * yearScale),
        reductionPct: 60,
      },
      {
        type: 'GASOLINE',
        labelAr: 'مركبات البنزين (بإدارة ضرائب الكربون)',
        labelEn: 'Gasoline (Eco-Guided)',
        activeVehicles: Math.max(2, telemetrySnapshot.gasParked + telemetrySnapshot.resByType.GASOLINE + 5),
        annualTrips: Math.round((195 + telemetrySnapshot.resByType.GASOLINE * 10) * yearScale),
        annualEnergyKwh: Math.round(2180 * yearScale),
        baselineCo2Kg: Math.round(3510 * yearScale),
        actualCo2Kg: Math.round(2560 * yearScale),
        avoidedCo2Kg: Math.round(950 * yearScale),
        reductionPct: 27,
      },
      {
        type: 'DIESEL',
        labelAr: 'المركبات الثقيلة / الديزل (تحت التحول)',
        labelEn: 'Heavy Diesel (Transitioning)',
        activeVehicles: Math.max(1, telemetrySnapshot.dieselParked + telemetrySnapshot.resByType.DIESEL + 2),
        annualTrips: Math.round((88 + telemetrySnapshot.resByType.DIESEL * 8) * yearScale),
        annualEnergyKwh: Math.round(1140 * yearScale),
        baselineCo2Kg: Math.round(2290 * yearScale),
        actualCo2Kg: Math.round(1810 * yearScale),
        avoidedCo2Kg: Math.round(480 * yearScale),
        reductionPct: 21,
      },
    ];

    if (fleetScope === 'ev_hybrid') {
      return allSegments.filter((s) => s.type === 'ELECTRIC' || s.type === 'HYBRID');
    }
    if (fleetScope === 'ice_transition') {
      return allSegments.filter((s) => s.type === 'GASOLINE' || s.type === 'DIESEL');
    }
    return allSegments;
  }, [fleetScope, selectedYear, telemetrySnapshot]);

  const annualSummary = useMemo(() => {
    const totalGridKwh = monthlyData.reduce((s, d) => s + d.gridKwh, 0);
    const totalSolarBessKwh = monthlyData.reduce((s, d) => s + d.solarBessKwh, 0);
    const totalNightEcoKwh = monthlyData.reduce((s, d) => s + d.nightEcoSavedKwh, 0);
    const totalBaselineCo2 = monthlyData.reduce((s, d) => s + d.baselineCo2Kg, 0);
    const totalActualCo2 = monthlyData.reduce((s, d) => s + d.actualCo2Kg, 0);
    const totalAvoidedCo2 = monthlyData.reduce((s, d) => s + d.avoidedCo2Kg, 0);

    const avgCleanSharePct = Math.round(
      (totalSolarBessKwh / Math.max(1, totalGridKwh + totalSolarBessKwh)) * 100
    );
    const carbonReductionPct = Math.round(
      (totalAvoidedCo2 / Math.max(1, totalBaselineCo2)) * 100
    );
    const equivalentTreesYear = Math.round(totalAvoidedCo2 / 21.77);

    return {
      totalGridKwh,
      totalSolarBessKwh,
      totalNightEcoKwh,
      totalBaselineCo2,
      totalActualCo2,
      totalAvoidedCo2,
      avgCleanSharePct,
      carbonReductionPct,
      equivalentTreesYear,
    };
  }, [monthlyData]);

  const renderPageOneHeaderCanvas = (): string => {
    const isRtl = lang === 'ar';
    const canvas = document.createElement('canvas');
    const w = 1400;
    const h = 500;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Top dark-emerald editorial banner
    const grad = ctx.createLinearGradient(0, 0, w, 150);
    grad.addColorStop(0, '#042f2e');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 156);

    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    const xMain = isRtl ? w - 44 : 44;
    const xOpp = isRtl ? 44 : w - 44;

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 20px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `${projectSettings.projectNameAr} · ${projectSettings.instituteNameAr}`
        : `${projectSettings.projectNameEn} · ${projectSettings.instituteNameEn}`,
      xMain,
      46
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `تقرير الاستدامة السنوي للتحول الطاقي وخفض الكربون (${selectedYear})`
        : `Annual Sustainability & Fleet Carbon Reduction Report (${selectedYear})`,
      xMain,
      96
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px Cairo, Arial, sans-serif';
    const scopeLabel =
      fleetScope === 'ev_hybrid'
        ? isRtl
          ? 'الأسطول الكهربائي والهجين'
          : 'EV & Hybrid Fleet'
        : fleetScope === 'ice_transition'
          ? isRtl
            ? 'المركبات التقليدية تحت التحول'
            : 'ICE Transition Segment'
          : isRtl
            ? 'الأسطول بالكامل (Scope 1/2/3)'
            : 'Entire Fleet (Scope 1/2/3)';
    ctx.fillText(
      isRtl
        ? `نطاق التقرير: ${scopeLabel} | المشرف: ${projectSettings.supervisorName} | كود المشروع: ${projectSettings.projectCode}`
        : `Scope: ${scopeLabel} | Supervisor: ${projectSettings.supervisorName} | Code: ${projectSettings.projectCode}`,
      xMain,
      134
    );

    // Date on opposite corner
    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 17px Cairo, Arial, sans-serif';
    ctx.fillText(`ISO-14064 ESG`, xOpp, 54);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px Cairo, Arial, sans-serif';
    ctx.fillText(new Date().toISOString().slice(0, 10), xOpp, 84);

    // 4 KPI Cards Row
    const cards = [
      {
        title: isRtl ? 'إجمالي CO2 الموفر سنوياً' : 'Annual CO2 Avoided',
        value: `${(annualSummary.totalAvoidedCo2 / 1000).toFixed(2)} tCO2`,
        sub: isRtl
          ? `انخفاض ${annualSummary.carbonReductionPct}% عن المرجع`
          : `${annualSummary.carbonReductionPct}% below ICE baseline`,
        accent: '#059669',
        bg: '#ecfdf5',
      },
      {
        title: isRtl ? 'نسبة التحول للطاقة النظيفة' : 'Clean Energy Shift Ratio',
        value: `${annualSummary.avgCleanSharePct}%`,
        sub: isRtl
          ? `${annualSummary.totalSolarBessKwh.toLocaleString()} kWh شمسية وBESS`
          : `${annualSummary.totalSolarBessKwh.toLocaleString()} kWh Solar & BESS`,
        accent: '#0284c7',
        bg: '#f0f9ff',
      },
      {
        title: isRtl ? 'وفر الترشيد والوضع الليلي' : 'Night & Eco Energy Saved',
        value: `${annualSummary.totalNightEcoKwh.toLocaleString()} kWh`,
        sub: isRtl
          ? `سحب الشبكة: ${annualSummary.totalGridKwh.toLocaleString()} kWh`
          : `Grid draw: ${annualSummary.totalGridKwh.toLocaleString()} kWh`,
        accent: '#d97706',
        bg: '#fffbeb',
      },
      {
        title: isRtl ? 'مكافئ امتصاص الأشجار السنوي' : 'Annual Tree Equivalents',
        value: `${annualSummary.equivalentTreesYear.toLocaleString()}`,
        sub: isRtl ? 'شجرة ناضجة / سنة' : 'mature trees / year',
        accent: '#0d9488',
        bg: '#f0fdfa',
      },
    ];

    const gap = 22;
    const cardW = (w - 88 - gap * 3) / 4;
    const cardY = 186;
    const cardH = 160;

    cards.forEach((c, idx) => {
      const cardX = isRtl ? w - 44 - cardW - idx * (cardW + gap) : 44 + idx * (cardW + gap);
      ctx.fillStyle = c.bg;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      ctx.direction = isRtl ? 'rtl' : 'ltr';
      ctx.textAlign = isRtl ? 'right' : 'left';
      const innerX = isRtl ? cardX + cardW - 18 : cardX + 18;

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 17px Cairo, Arial, sans-serif';
      ctx.fillText(c.title, innerX, cardY + 38);

      ctx.fillStyle = c.accent;
      ctx.font = 'bold 34px Cairo, Arial, sans-serif';
      ctx.fillText(c.value, innerX, cardY + 96);

      ctx.fillStyle = '#475569';
      ctx.font = '15px Cairo, Arial, sans-serif';
      ctx.fillText(c.sub, innerX, cardY + 134);
    });

    // Narrative Executive Note
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(44, 372, w - 88, 108);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(44, 372, w - 88, 108);

    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl ? 'الملخص التنفيذي للتحول الطاقي والبصمة الكربونية:' : 'Executive Energy & Carbon Transition Summary:',
      xMain,
      408
    );

    ctx.fillStyle = '#334155';
    ctx.font = '16px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `حقق الأسطول خفضاً صافياً بمقدار ${(annualSummary.totalAvoidedCo2 / 1000).toFixed(2)} طن CO2 عبر تكامل المظلات الشمسية وتخزين BESS وشحن V2G.`
        : `The fleet achieved ${(annualSummary.totalAvoidedCo2 / 1000).toFixed(2)} tCO2 net reduction through solar canopies, BESS & V2G.`,
      xMain,
      442
    );
    ctx.fillText(
      isRtl
        ? `فريق التطوير: ${projectSettings.teamNameAr} — يوضح الرسمان البيانيان أدناه مسار التحول الشهري للطاقة النظيفة والبصمة الكربونية.`
        : `Team: ${projectSettings.teamNameEn} — Interactive energy transition & fleet carbon charts follow below.`,
      xMain,
      468
    );

    return canvas.toDataURL('image/png', 1.0);
  };

  const renderPageTwoTablesCanvas = (): string => {
    const isRtl = lang === 'ar';
    const canvas = document.createElement('canvas');
    const w = 1400;
    const h = 1520;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    const xMain = isRtl ? w - 44 : 44;

    // Header
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `تفصيل البصمة الكربونية للأسطول والسجل الشهري للطاقة (${selectedYear})`
        : `Fleet Segment Carbon Breakdown & Monthly Energy Ledger (${selectedYear})`,
      xMain,
      58
    );

    // Table 1: Fleet Breakdown
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 21px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl ? '1. تحليل البصمة الكربونية حسب نوع مركبات الأسطول' : '1. Fleet Carbon Breakdown by Vehicle Segment',
      xMain,
      110
    );

    const cols1 = isRtl
      ? [
          { label: 'فئة الأسطول', x: w - 58, align: 'right' as CanvasTextAlign },
          { label: 'المركبات', x: 930, align: 'center' as CanvasTextAlign },
          { label: 'الرحلات السنوية', x: 760, align: 'center' as CanvasTextAlign },
          { label: 'الطاقة (kWh)', x: 590, align: 'center' as CanvasTextAlign },
          { label: 'المرجع CO2 (kg)', x: 410, align: 'center' as CanvasTextAlign },
          { label: 'الفعلي CO2 (kg)', x: 245, align: 'center' as CanvasTextAlign },
          { label: 'نسبة الخفض', x: 105, align: 'center' as CanvasTextAlign },
        ]
      : [
          { label: 'Fleet Segment', x: 58, align: 'left' as CanvasTextAlign },
          { label: 'Vehicles', x: 470, align: 'center' as CanvasTextAlign },
          { label: 'Annual Trips', x: 620, align: 'center' as CanvasTextAlign },
          { label: 'Energy (kWh)', x: 785, align: 'center' as CanvasTextAlign },
          { label: 'Baseline CO2', x: 960, align: 'center' as CanvasTextAlign },
          { label: 'Actual CO2', x: 1135, align: 'center' as CanvasTextAlign },
          { label: 'Reduction', x: 1295, align: 'center' as CanvasTextAlign },
        ];

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(44, 130, w - 88, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Cairo, Arial, sans-serif';
    cols1.forEach((col) => {
      ctx.textAlign = col.align;
      ctx.fillText(col.label, col.x, 163);
    });

    fleetBreakdown.forEach((row, idx) => {
      const y = 182 + idx * 56;
      ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(44, y, w - 88, 56);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(44, y, w - 88, 56);

      const vals = [
        isRtl ? row.labelAr : row.labelEn,
        String(row.activeVehicles),
        row.annualTrips.toLocaleString(),
        row.annualEnergyKwh.toLocaleString(),
        row.baselineCo2Kg.toLocaleString(),
        row.actualCo2Kg.toLocaleString(),
        `-${row.reductionPct}%`,
      ];

      ctx.font = 'bold 17px Cairo, Arial, sans-serif';
      cols1.forEach((col, cIdx) => {
        ctx.textAlign = col.align;
        ctx.fillStyle = cIdx === 6 ? '#059669' : '#1e293b';
        ctx.fillText(vals[cIdx], col.x, y + 35);
      });
    });

    // Table 2: 12-Month Breakdown
    const table2Top = 182 + fleetBreakdown.length * 56 + 64;
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 21px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl ? '2. السجل الشهري للتحول الطاقي وتقليص الانبعاثات (12 شهراً)' : '2. 12-Month Energy Shift & Emissions Ledger',
      xMain,
      table2Top
    );

    const cols2 = isRtl
      ? [
          { label: 'الشهر', x: w - 58, align: 'right' as CanvasTextAlign },
          { label: 'طاقة الشبكة (kWh)', x: 1090, align: 'center' as CanvasTextAlign },
          { label: 'شمسية + BESS (kWh)', x: 870, align: 'center' as CanvasTextAlign },
          { label: 'التحول النظيف %', x: 660, align: 'center' as CanvasTextAlign },
          { label: 'مرجعي CO2 (kg)', x: 470, align: 'center' as CanvasTextAlign },
          { label: 'فعلي CO2 (kg)', x: 295, align: 'center' as CanvasTextAlign },
          { label: 'CO2 الموفر (kg)', x: 120, align: 'center' as CanvasTextAlign },
        ]
      : [
          { label: 'Month', x: 58, align: 'left' as CanvasTextAlign },
          { label: 'Grid (kWh)', x: 290, align: 'center' as CanvasTextAlign },
          { label: 'Solar+BESS (kWh)', x: 500, align: 'center' as CanvasTextAlign },
          { label: 'Clean Share %', x: 710, align: 'center' as CanvasTextAlign },
          { label: 'Baseline CO2', x: 910, align: 'center' as CanvasTextAlign },
          { label: 'Actual CO2', x: 1105, align: 'center' as CanvasTextAlign },
          { label: 'Avoided CO2', x: 1285, align: 'center' as CanvasTextAlign },
        ];

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(44, table2Top + 20, w - 88, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Cairo, Arial, sans-serif';
    cols2.forEach((col) => {
      ctx.textAlign = col.align;
      ctx.fillText(col.label, col.x, table2Top + 51);
    });

    monthlyData.forEach((m, idx) => {
      const y = table2Top + 70 + idx * 48;
      ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(44, y, w - 88, 48);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(44, y, w - 88, 48);

      const vals = [
        isRtl ? m.monthAr : m.monthEn,
        m.gridKwh.toLocaleString(),
        m.solarBessKwh.toLocaleString(),
        `${m.cleanSharePct}%`,
        m.baselineCo2Kg.toLocaleString(),
        m.actualCo2Kg.toLocaleString(),
        `+${m.avoidedCo2Kg.toLocaleString()} kg`,
      ];

      ctx.font = 'bold 16px Cairo, Arial, sans-serif';
      cols2.forEach((col, cIdx) => {
        ctx.textAlign = col.align;
        ctx.fillStyle = cIdx === 6 ? '#059669' : cIdx === 3 ? '#0284c7' : '#1e293b';
        ctx.fillText(vals[cIdx], col.x, y + 31);
      });
    });

    // Sign-off footer
    const footY = table2Top + 70 + monthlyData.length * 48 + 42;
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(44, footY, w - 88, 92);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(44, footY, w - 88, 92);

    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 18px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `اعتماد نظام ${projectSettings.projectNameAr} — الامتثال البيئي ISO-14064 Scope 3`
        : `${projectSettings.projectNameEn} Verified — ISO-14064 Scope 3 Environmental Sign-off`,
      xMain,
      footY + 36
    );
    ctx.fillStyle = '#334155';
    ctx.font = '15px Cairo, Arial, sans-serif';
    ctx.fillText(
      isRtl
        ? `الجهة: ${projectSettings.instituteNameAr} | الفريق: ${projectSettings.teamNameAr} | المشرف: ${projectSettings.supervisorName}`
        : `Institute: ${projectSettings.instituteNameEn} | Team: ${projectSettings.teamNameEn} | Supervisor: ${projectSettings.supervisorName}`,
      xMain,
      footY + 68
    );

    return canvas.toDataURL('image/png', 1.0);
  };

  const handleGeneratePdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const isRtl = lang === 'ar';
      const headerImg = renderPageOneHeaderCanvas();
      const energyChartImg = await svgElementToPngDataUrl(
        energyChartRef.current,
        isRtl
          ? '1. التحول السنوي في استهلاك الطاقة النظيفة مقابل الشبكة (kWh)'
          : '1. Annual Clean Energy Shift vs Grid Consumption (kWh)',
        isRtl
          ? 'مقارنة شهرية لإنتاج المظلات الشمسية وبطاريات BESS مقابل الاستهلاك التقليدي'
          : 'Monthly Solar Canopy & BESS clean energy contribution vs grid consumption',
        isRtl
      );
      const carbonChartImg = await svgElementToPngDataUrl(
        carbonChartRef.current,
        isRtl
          ? '2. تقليل البصمة الكربونية للأسطول بأكمله (kg CO2)'
          : '2. Entire Fleet Carbon Footprint Reduction (kg CO2)',
        isRtl
          ? 'الانبعاثات المرجعية للوقود الأحفوري مقابل الانبعاثات الفعلية وصافي CO2 الموفر'
          : 'ICE baseline emissions vs actual fleet footprint and net CO2 avoided',
        isRtl
      );
      const pageTwoImg = renderPageTwoTablesCanvas();

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth(); // 210mm
      const margin = 10;
      const contentW = pageW - margin * 2; // 190mm

      // Page 1: Executive header + both Recharts graphs
      if (headerImg) {
        pdf.addImage(headerImg, 'PNG', margin, 8, contentW, 68, undefined, 'FAST');
      }
      if (energyChartImg) {
        pdf.addImage(energyChartImg, 'PNG', margin, 82, contentW, 96, undefined, 'FAST');
      }
      if (carbonChartImg) {
        pdf.addImage(carbonChartImg, 'PNG', margin, 184, contentW, 96, undefined, 'FAST');
      }

      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Eco-Park AI Annual Sustainability Report (${selectedYear}) - Page 1 / 2`,
        margin,
        290
      );

      // Page 2: Fleet breakdown + 12-month energy/carbon table
      pdf.addPage();
      if (pageTwoImg) {
        pdf.addImage(pageTwoImg, 'PNG', margin, 10, contentW, 206, undefined, 'FAST');
      }
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Eco-Park AI Annual Sustainability Report (${selectedYear}) - Page 2 / 2`,
        margin,
        290
      );

      const fileName = `EcoPark-Annual-Sustainability-Report-${selectedYear}.pdf`;
      pdf.save(fileName);
      setLastExportName(fileName);
      onNotify?.(
        `تم توليد وتنزيل تقرير الاستدامة السنوي (${fileName}) بنجاح.`,
        `Generated and downloaded ${fileName} successfully.`
      );
    } catch (err) {
      console.error('PDF generation failed:', err);
      onNotify?.(
        'تعذر توليد ملف PDF؛ يرجى المحاولة مرة أخرى.',
        'Unable to export PDF report; please try again.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-400/25 bg-[#0D1E2E] p-6 space-y-6">
      {/* Header + Controls + PDF CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {t(
                lang,
                'تقرير الاستدامة السنوي والتحول الطاقي للأسطول (PDF)',
                'Annual Fleet Sustainability & Energy Transition Report (PDF)'
              )}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'رسوم بيانية تفاعلية توضح التحول السنوي في استهلاك الطاقة النظيفة وتقليص البصمة الكربونية للأسطول بالكامل مع التصدير الفوري بصيغة PDF.',
              'Interactive Recharts analytics tracking annual clean energy transition and entire-fleet carbon footprint reduction with instant PDF generation.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Toggle */}
          <div className="flex rounded-lg border border-white/10 bg-[#08121D] p-1">
            {([2026, 2025] as ReportYear[]).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`rounded-md px-3 py-1 font-mono text-xs font-bold transition ${
                  selectedYear === yr
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Fleet Scope Selector */}
          <select
            value={fleetScope}
            onChange={(e) => setFleetScope(e.target.value as FleetScopeFilter)}
            className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-emerald-400"
          >
            <option value="all">{t(lang, 'الأسطول بالكامل', 'Entire Fleet')}</option>
            <option value="ev_hybrid">{t(lang, 'الكهربائية والهجينة فقط', 'EV & Hybrid Only')}</option>
            <option value="ice_transition">{t(lang, 'الوقود التقليدي تحت التحول', 'ICE Transitioning')}</option>
          </select>

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportingPdf
              ? t(lang, 'جاري توليد التقرير PDF...', 'Generating PDF...')
              : t(lang, 'توليد وتنزيل التقرير السنوي PDF', 'Generate Annual PDF Report')}
          </button>
        </div>
      </div>

      {lastExportName && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              {t(lang, 'تم تصدير أحدث نسخة بنجاح:', 'Latest report exported successfully:')}{' '}
              <span className="font-mono font-bold text-white">{lastExportName}</span>
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300">A4 · 2 Pages · Recharts</span>
        </div>
      )}

      {/* 4 Annual KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'خفض الكربون السنوي', 'Annual CO2 Avoided')}</span>
            <Leaf className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-emerald-400">
            {(annualSummary.totalAvoidedCo2 / 1000).toFixed(2)} tCO2
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(
              lang,
              `تراجع بنسبة ${annualSummary.carbonReductionPct}% مقابل الانبعاثات المرجعية`,
              `${annualSummary.carbonReductionPct}% drop vs ICE baseline`
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'التحول للطاقة النظيفة', 'Clean Energy Shift')}</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-cyan-300">
            {annualSummary.avgCleanSharePct}%
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            {annualSummary.totalSolarBessKwh.toLocaleString()} kWh Solar+BESS
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'وفر الوضع الليلي والترشيد', 'Night & Eco Savings')}</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-amber-300">
            {annualSummary.totalNightEcoKwh.toLocaleString()} kWh
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            {t(lang, 'سحب الشبكة:', 'Grid Draw:')} {annualSummary.totalGridKwh.toLocaleString()} kWh
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#08121D] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t(lang, 'مكافئ الأشجار السنوي', 'Annual Tree Equivalent')}</span>
            <Trees className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-white">
            {annualSummary.equivalentTreesYear.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {t(lang, 'شجرة ناضجة ممتصة لثاني أكسيد الكربون', 'mature trees absorbed/yr')}
          </div>
        </div>
      </div>

      {/* Interactive Recharts Row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Chart 1: Energy Consumption Shift */}
        <div
          ref={energyChartRef}
          className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(
                  lang,
                  `التحول في استهلاك الطاقة (${selectedYear})`,
                  `Energy Consumption Shift (${selectedYear})`
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(
                  lang,
                  'مقارنة الطاقة الشمسية وتخزين BESS مقابل سحب الشبكة التقليدية ونسبة التحول %',
                  'Solar & BESS clean generation vs conventional grid draw and clean share %'
                )}
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold text-cyan-400">kWh / %</span>
          </div>

          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="cleanEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey={lang === 'ar' ? 'monthAr' : 'monthEn'}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#38bdf8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1724',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="gridKwh"
                  name={t(lang, 'سحب الشبكة (kWh)', 'Grid Draw (kWh)')}
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="solarBessKwh"
                  name={t(lang, 'طاقة شمسية + BESS (kWh)', 'Solar + BESS (kWh)')}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#cleanEnergyGrad)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cleanSharePct"
                  name={t(lang, 'نسبة التحول النظيف %', 'Clean Shift %')}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Fleet Carbon Footprint Reduction */}
        <div
          ref={carbonChartRef}
          className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(
                  lang,
                  `تقليل البصمة الكربونية للأسطول بأكمله (${selectedYear})`,
                  `Entire Fleet Carbon Reduction (${selectedYear})`
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(
                  lang,
                  'الانبعاثات المرجعية قبل التحول مقابل الانبعاثات الفعلية وصافي CO2 الموفر شهرياً',
                  'ICE baseline CO2 vs actual Eco-Park footprint and net monthly CO2 avoided'
                )}
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-400">kg CO2</span>
          </div>

          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey={lang === 'ar' ? 'monthAr' : 'monthEn'}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1724',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="baselineCo2Kg"
                  name={t(lang, 'المرجع التقليدي (kg CO2)', 'Baseline ICE (kg)')}
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actualCo2Kg"
                  name={t(lang, 'البصمة الفعلية (kg CO2)', 'Actual Footprint (kg)')}
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="avoidedCo2Kg"
                  name={t(lang, 'CO2 الموفر (kg)', 'CO2 Avoided (kg)')}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fleet Segment Carbon Footprint Table */}
      <div className="rounded-xl border border-white/10 bg-[#08121D] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {t(
                lang,
                'ملخص البصمة الكربونية لكل فئة من فئات الأسطول',
                'Carbon Footprint Breakdown Across Fleet Segments'
              )}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            {t(lang, 'مشمول تلقائياً في تقرير PDF', 'Included in exported PDF')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="py-2.5 text-start font-semibold">{t(lang, 'فئة المركبات', 'Fleet Segment')}</th>
                <th className="py-2.5 text-center font-semibold">{t(lang, 'المركبات النشطة', 'Active Fleet')}</th>
                <th className="py-2.5 text-center font-semibold">{t(lang, 'الرحلات السنوية', 'Annual Trips')}</th>
                <th className="py-2.5 text-center font-semibold">{t(lang, 'الطاقة النظيفة (kWh)', 'Energy (kWh)')}</th>
                <th className="py-2.5 text-center font-semibold">{t(lang, 'المرجع CO2 (kg)', 'Baseline CO2')}</th>
                <th className="py-2.5 text-center font-semibold">{t(lang, 'الفعلي CO2 (kg)', 'Actual CO2')}</th>
                <th className="py-2.5 text-end font-semibold">{t(lang, 'خفض البصمة', 'Reduction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleetBreakdown.map((seg) => (
                <tr key={seg.type} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-semibold text-white">
                    {lang === 'ar' ? seg.labelAr : seg.labelEn}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-slate-200">
                    {seg.activeVehicles}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-slate-200">
                    {seg.annualTrips.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-cyan-300">
                    {seg.annualEnergyKwh.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-amber-300">
                    {seg.baselineCo2Kg.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-slate-200">
                    {seg.actualCo2Kg.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-end font-mono font-bold tabular-nums text-emerald-400">
                    -{seg.reductionPct}% ({seg.avoidedCo2Kg.toLocaleString()} kg)
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
