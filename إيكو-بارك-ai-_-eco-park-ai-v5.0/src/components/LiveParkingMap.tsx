import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  BatteryCharging,
  Car,
  Clock,
  Globe,
  LocateFixed,
  MapPin,
  Navigation,
  PlusCircle,
  Radio,
  Route as RouteIcon,
  Search,
  Siren,
  ThermometerSun,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { Language, ParkingSpot, VehicleType } from '../types/parking';
import { BRANCHES } from '../data/initialData';
import { t } from '../data/i18n';
import {
  computeLotThermalStats,
  playBessCriticalSiren,
  playHydraulicGateSound,
  playSensorHeartbeatTick,
  speakCopilotReply,
  stopAllAlarms,
  stopCopilotSpeech,
} from '../utils/ecoEngine';

interface LiveParkingMapProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  solarKw: number;
  smokeAlert: boolean;
  onToggleSpot: (spotId: string) => void;
  onParkVehicle: (spotId: string, vehicleType: VehicleType, plate: string) => void;
  onAddSpot: () => ParkingSpot;
  onReserveBay: (spotId: string) => void;
  onTriggerLowBessTest: () => void;
}

interface BranchAnchor {
  id: string;
  branch: string;
  shortAr: string;
  shortEn: string;
  labelAr: string;
  labelEn: string;
  countryAr: string;
  countryEn: string;
  center: google.maps.LatLngLiteral;
  totalBays: number;
  baseOccupied: number;
  evChargersTotal: number;
  evChargersFree: number;
  solarKw: number;
  bessPct: number;
}

const BRANCH_ANCHORS: BranchAnchor[] = [
  {
    id: 'branch-kfs',
    branch: BRANCHES[0],
    shortAr: 'كفر الشيخ',
    shortEn: 'Kafr El-Sheikh',
    labelAr: 'كفر الشيخ الذكي (الرئيسي)',
    labelEn: 'Kafr El-Sheikh Smart Hub',
    countryAr: 'مصر',
    countryEn: 'Egypt',
    center: { lat: 31.1088, lng: 30.9415 },
    totalBays: 12,
    baseOccupied: 3,
    evChargersTotal: 7,
    evChargersFree: 5,
    solarKw: 182,
    bessPct: 86,
  },
  {
    id: 'branch-cairo',
    branch: 'فرع القاهرة - العاصمة الذكية',
    shortAr: 'القاهرة الذكية',
    shortEn: 'New Cairo Hub',
    labelAr: 'القاهرة - العاصمة الإدارية الذكية',
    labelEn: 'Cairo New Capital Smart Hub',
    countryAr: 'مصر',
    countryEn: 'Egypt',
    center: { lat: 30.0131, lng: 31.737 },
    totalBays: 18,
    baseOccupied: 7,
    evChargersTotal: 10,
    evChargersFree: 6,
    solarKw: 245,
    bessPct: 81,
  },
  {
    id: 'branch-neom',
    branch: BRANCHES[3],
    shortAr: 'نيوم',
    shortEn: 'NEOM',
    labelAr: 'نيوم - ذا لاين للأعمال',
    labelEn: 'NEOM Business Hub',
    countryAr: 'السعودية',
    countryEn: 'KSA',
    center: { lat: 28.0067, lng: 35.1255 },
    totalBays: 16,
    baseOccupied: 4,
    evChargersTotal: 12,
    evChargersFree: 9,
    solarKw: 310,
    bessPct: 94,
  },
  {
    id: 'branch-jeddah',
    branch: BRANCHES[2],
    shortAr: 'جدة',
    shortEn: 'Jeddah',
    labelAr: 'جدة الساحلي المستدام',
    labelEn: 'Jeddah Waterfront Hub',
    countryAr: 'السعودية',
    countryEn: 'KSA',
    center: { lat: 21.5433, lng: 39.1728 },
    totalBays: 14,
    baseOccupied: 11,
    evChargersTotal: 8,
    evChargersFree: 2,
    solarKw: 224,
    bessPct: 72,
  },
  {
    id: 'branch-riyadh',
    branch: BRANCHES[1],
    shortAr: 'الرياض',
    shortEn: 'Riyadh',
    labelAr: 'الرياض الأخضر - العليا',
    labelEn: 'Riyadh Olaya Green Hub',
    countryAr: 'السعودية',
    countryEn: 'KSA',
    center: { lat: 24.6948, lng: 46.6849 },
    totalBays: 20,
    baseOccupied: 12,
    evChargersTotal: 12,
    evChargersFree: 5,
    solarKw: 278,
    bessPct: 79,
  },
  {
    id: 'branch-dubai',
    branch: 'فرع دبي - المدينة المستدامة',
    shortAr: 'دبي',
    shortEn: 'Dubai',
    labelAr: 'دبي - المدينة المستدامة',
    labelEn: 'Dubai Sustainable City Hub',
    countryAr: 'الإمارات',
    countryEn: 'UAE',
    center: { lat: 25.0289, lng: 55.2602 },
    totalBays: 16,
    baseOccupied: 5,
    evChargersTotal: 10,
    evChargersFree: 7,
    solarKw: 290,
    bessPct: 91,
  },
  {
    id: 'branch-palestine',
    branch: BRANCHES[4] || 'فرع القدس المستدام - فلسطين المحتلة',
    shortAr: 'القدس · فلسطين المحتلة',
    shortEn: 'Al-Quds · Occupied Palestine',
    labelAr: 'القدس الشريف - فلسطين المحتلة',
    labelEn: 'Al-Quds Smart Hub - Occupied Palestine',
    countryAr: 'فلسطين المحتلة',
    countryEn: 'Occupied Palestine',
    center: { lat: 31.7683, lng: 35.2137 },
    totalBays: 16,
    baseOccupied: 6,
    evChargersTotal: 10,
    evChargersFree: 6,
    solarKw: 264,
    bessPct: 89,
  },
];

function sanitizePalestineLabel(text: string, lang: Language): string {
  const replacement = lang === 'ar' ? 'فلسطين المحتلة' : 'Occupied Palestine';
  return text
    .replace(/دولة\s*[إا]سرائيل/gi, 'فلسطين المحتلة')
    .replace(/[إا]سرائيل/gi, 'فلسطين المحتلة')
    .replace(/State of Israel/gi, 'Occupied Palestine')
    .replace(/\bIsrael\b/gi, replacement);
}

const PALESTINE_CUSTOM_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0b1724' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#08121d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.country',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e3a5f' }, { weight: 1.2 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050d17' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#16283c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#1e3a56' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0d2622' }],
  },
];

interface MapHtmlOverlayProps {
  position: google.maps.LatLngLiteral;
  zIndex?: number;
  anchorCenter?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}

const MapHtmlOverlay: React.FC<MapHtmlOverlayProps> = ({
  position,
  zIndex = 20,
  anchorCenter = false,
  interactive = true,
  onClick,
  title,
  children,
}) => {
  const map = useMap();
  const posRef = useRef(position);
  const zIndexRef = useRef(zIndex);
  const centerRef = useRef(anchorCenter);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  posRef.current = position;
  zIndexRef.current = zIndex;
  centerRef.current = anchorCenter;

  const containerEl = useMemo(() => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    return el;
  }, []);

  useEffect(() => {
    if (!interactive) {
      containerEl.style.pointerEvents = 'none';
    } else {
      containerEl.style.pointerEvents = 'auto';
    }
    if (title) {
      containerEl.title = title;
    }
  }, [containerEl, interactive, title]);

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    class CustomHtmlOverlay extends google.maps.OverlayView {
      onAdd() {
        const panes = this.getPanes();
        const pane = interactive ? panes?.overlayMouseTarget : panes?.overlayLayer;
        if (pane) {
          pane.appendChild(containerEl);
        }
      }
      draw() {
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(posRef.current));
        if (!point) return;
        containerEl.style.left = `${point.x}px`;
        containerEl.style.top = `${point.y}px`;
        containerEl.style.transform = centerRef.current
          ? 'translate(-50%, -50%)'
          : 'translate(-50%, -100%)';
        containerEl.style.zIndex = String(zIndexRef.current);
      }
      onRemove() {
        if (containerEl.parentNode) {
          containerEl.parentNode.removeChild(containerEl);
        }
      }
    }

    const overlay = new CustomHtmlOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [containerEl, interactive, map]);

  useEffect(() => {
    overlayRef.current?.draw();
  }, [position.lat, position.lng, zIndex, anchorCenter]);

  return createPortal(
    <div
      onClick={(e) => {
        if (interactive && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={interactive && onClick ? 'cursor-pointer select-none' : 'select-none'}
    >
      {children}
    </div>,
    containerEl
  );
};

const OCCUPIED_PALESTINE_COORDS: google.maps.LatLngLiteral[] = [
  { lat: 33.092, lng: 35.105 }, // Ras Al-Naqoura
  { lat: 33.285, lng: 35.575 }, // North Galilee
  { lat: 32.725, lng: 35.635 }, // Lake Tiberias
  { lat: 32.105, lng: 35.545 }, // Jordan Valley
  { lat: 31.505, lng: 35.425 }, // Dead Sea West
  { lat: 30.895, lng: 35.345 }, // Southern Wadi Araba
  { lat: 29.495, lng: 34.915 }, // Umm Al-Rashrash
  { lat: 31.225, lng: 34.265 }, // Rafah Border
  { lat: 31.525, lng: 34.455 }, // Gaza Coast
  { lat: 32.085, lng: 34.765 }, // Yafa Coast
  { lat: 32.815, lng: 34.985 }, // Haifa Coast
];

const REGIONAL_COUNTRY_LABELS: {
  id: string;
  position: google.maps.LatLngLiteral;
  ar: string;
  en: string;
  highlight?: boolean;
}[] = [
  {
    id: 'palestine-main',
    position: { lat: 31.25, lng: 34.86 },
    ar: 'فلسطين المحتلة',
    en: 'Occupied Palestine',
    highlight: true,
  },
  {
    id: 'palestine-gaza',
    position: { lat: 31.42, lng: 34.36 },
    ar: 'غزة · فلسطين',
    en: 'Gaza · Palestine',
  },
  {
    id: 'egypt-label',
    position: { lat: 27.2, lng: 30.2 },
    ar: 'مصر',
    en: 'Egypt',
  },
  {
    id: 'ksa-label',
    position: { lat: 24.2, lng: 43.8 },
    ar: 'المملكة العربية السعودية',
    en: 'Saudi Arabia',
  },
  {
    id: 'jordan-label',
    position: { lat: 31.05, lng: 36.85 },
    ar: 'الأردن',
    en: 'Jordan',
  },
  {
    id: 'uae-label',
    position: { lat: 24.0, lng: 54.0 },
    ar: 'الإمارات',
    en: 'UAE',
  },
];

const OccupiedPalestineMapLayer: React.FC<{ lang: Language }> = ({ lang }) => {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState<number>(5);

  useEffect(() => {
    if (!map) return;

    const poly = new google.maps.Polygon({
      paths: OCCUPIED_PALESTINE_COORDS,
      strokeColor: '#10b981',
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillColor: '#10b981',
      fillOpacity: 0.16,
      clickable: false,
      zIndex: 5,
      map,
    });

    const handleZoom = () => {
      const z = map.getZoom();
      if (typeof z === 'number') setZoomLevel(z);
    };
    handleZoom();
    const listener = map.addListener('zoom_changed', handleZoom);

    return () => {
      poly.setMap(null);
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  // Show the geopolitical territory & regional country labels at continental/regional zoom (<= 11)
  if (zoomLevel > 11) return null;

  return (
    <>
      {REGIONAL_COUNTRY_LABELS.map((item) =>
        item.highlight ? (
          <MapHtmlOverlay
            key={item.id}
            position={item.position}
            zIndex={110}
            anchorCenter
            interactive={false}
          >
            <div className="rounded-lg border-2 border-emerald-400/90 bg-[#081521]/95 px-3 py-1 text-center shadow-2xl">
              <div className="text-[11px] font-extrabold text-emerald-300 tracking-wide whitespace-nowrap">
                {lang === 'ar' ? item.ar : item.en}
              </div>
              <div className="text-[9px] font-semibold text-slate-300 whitespace-nowrap">
                {lang === 'ar' ? item.en : item.ar}
              </div>
            </div>
          </MapHtmlOverlay>
        ) : (
          <MapHtmlOverlay
            key={item.id}
            position={item.position}
            zIndex={90}
            anchorCenter
            interactive={false}
          >
            <div className="rounded border border-white/15 bg-[#081521]/85 px-2 py-0.5 text-[10px] font-bold text-slate-200 shadow whitespace-nowrap">
              {lang === 'ar' ? item.ar : item.en}
            </div>
          </MapHtmlOverlay>
        )
      )}
    </>
  );
};

interface BranchLiveStatus extends BranchAnchor {
  isActiveBranch: boolean;
  availableBays: number;
  occupiedBays: number;
  occupancyPct: number;
  statusTone: 'emerald' | 'amber' | 'red';
  straightKm: number;
  roadDistanceKm: number;
  driveMinutes: number;
  chargingStops: number;
  chargingStopMinutes: number;
  totalEtaMinutes: number;
  reachableDirectly: boolean;
  arrivalSocPct: number;
}

interface StreamEventItem {
  id: string;
  time: string;
  textAr: string;
  textEn: string;
  tone: 'emerald' | 'amber' | 'red' | 'cyan';
}

type MapViewMode = 'local' | 'global';
type EvDriveProfile = 'eco' | 'standard' | 'sport';

function haversineKm(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDuration(totalMinutes: number, lang: Language): string {
  if (totalMinutes <= 0) return lang === 'ar' ? '0 د' : '0m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return lang === 'ar' ? `${mins} د` : `${mins}m`;
  if (mins === 0) return lang === 'ar' ? `${hrs} س` : `${hrs}h`;
  return lang === 'ar' ? `${hrs} س ${mins} د` : `${hrs}h ${mins}m`;
}

function spotToLatLng(spot: ParkingSpot, anchor: google.maps.LatLngLiteral): google.maps.LatLngLiteral {
  const latStep = 0.00018;
  const lngStep = 0.00019;
  const rowOffsetLat = spot.row === 'top' ? latStep : -latStep;
  const colIndex = spot.x3d / 6;
  return {
    lat: Number((anchor.lat + rowOffsetLat).toFixed(6)),
    lng: Number((anchor.lng + colIndex * lngStep).toFixed(6)),
  };
}

interface BayMarkerProps {
  spot: ParkingSpot;
  position: google.maps.LatLngLiteral;
  tempC: number;
  selected: boolean;
  lang: Language;
  onSelect: (spotId: string) => void;
  onToggleSpot: (spotId: string) => void;
  onParkVehicle: (spotId: string, vehicleType: VehicleType, plate: string) => void;
  onReserveBay: (spotId: string) => void;
}

const BayMarkerWithInfo: React.FC<BayMarkerProps> = ({
  spot,
  position,
  tempC,
  selected,
  lang,
  onSelect,
  onToggleSpot,
  onParkVehicle,
  onReserveBay,
}) => {
  const colors =
    spot.status === 'available'
      ? { bg: '#10b981', border: '#047857', text: '#022c22', badge: 'AVAIL' }
      : spot.status === 'reserved'
        ? { bg: '#f59e0b', border: '#b45309', text: '#451a03', badge: 'RESV' }
        : { bg: '#ef4444', border: '#991b1b', text: '#ffffff', badge: 'OCC' };

  return (
    <>
      <MapHtmlOverlay
        position={position}
        onClick={() => onSelect(spot.id)}
        title={`${spot.label} (${spot.status}) · ${tempC}°C`}
        zIndex={selected ? 50 : spot.status === 'available' ? 20 : 10}
      >
        <div
          className={`flex flex-col items-center rounded-lg border-2 px-2 py-1 shadow-lg transition-transform ${
            selected
              ? 'scale-110 ring-2 ring-white'
              : spot.status === 'available' && spot.hasCharger
                ? 'eco-flash-glow hover:scale-105'
                : 'hover:scale-105'
          }`}
          style={{
            backgroundColor: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        >
          <div className="flex items-center gap-1 font-mono text-[11px] font-extrabold leading-none">
            <span>{spot.label}</span>
            {spot.hasCharger && <span>⚡</span>}
          </div>
          <div className="mt-0.5 font-mono text-[9px] font-bold leading-none opacity-90">
            {tempC}°C
          </div>
        </div>
      </MapHtmlOverlay>

      {selected && (
        <InfoWindow
          position={position}
          pixelOffset={[0, -42]}
          onCloseClick={() => onSelect('')}
          maxWidth={260}
        >
          <div className="min-w-[215px] p-1 text-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-mono text-sm font-extrabold text-slate-950">
                {spot.label} · {spot.zone}
              </span>
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                style={{ backgroundColor: colors.border }}
              >
                {spot.status.toUpperCase()}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">{t(lang, 'الحرارة اللحظية:', 'Thermal Sensor:')}</span>
                <span className="font-mono font-bold text-slate-900">{tempC}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t(lang, 'الشاحن الذكي:', 'EV Charger:')}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {spot.hasCharger ? `${spot.chargerKw} kW` : t(lang, 'قياسي', 'Standard')}
                </span>
              </div>
              {spot.vehiclePlate && (
                <div className="flex justify-between">
                  <span className="text-slate-600">{t(lang, 'اللوحة:', 'Plate:')}</span>
                  <span className="font-mono font-bold text-slate-950">{spot.vehiclePlate}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onToggleSpot(spot.id)}
                className="flex-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
              >
                {spot.status === 'available'
                  ? t(lang, 'إشغال الموقف', 'Mark Occupied')
                  : t(lang, 'تحرير الموقف', 'Free Bay')}
              </button>
              {spot.status === 'available' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onParkVehicle(
                        spot.id,
                        spot.hasCharger ? 'ELECTRIC' : 'HYBRID',
                        `LIVE-${Math.floor(100 + Math.random() * 899)}`
                      );
                      playHydraulicGateSound();
                    }}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                  >
                    {t(lang, 'إدخال EV', 'Park EV')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReserveBay(spot.id)}
                    className="w-full rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
                  >
                    {t(lang, 'حجز وإصدار تذكرة QR', 'Reserve & Issue QR')}
                  </button>
                </>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface BranchMarkerProps {
  branch: BranchLiveStatus;
  selected: boolean;
  isRouteTarget: boolean;
  lang: Language;
  onSelectBranchPin: (branchId: string) => void;
  onRouteToBranch: (branchId: string) => void;
  onSwitchToLocalBranch: (branchId: string) => void;
}

const BranchNetworkMarkerWithInfo: React.FC<BranchMarkerProps> = ({
  branch,
  selected,
  isRouteTarget,
  lang,
  onSelectBranchPin,
  onRouteToBranch,
  onSwitchToLocalBranch,
}) => {
  const toneStyle =
    branch.statusTone === 'emerald'
      ? { bg: '#059669', border: '#34d399', pill: '#064e3b' }
      : branch.statusTone === 'amber'
        ? { bg: '#d97706', border: '#fbbf24', pill: '#451a03' }
        : { bg: '#dc2626', border: '#f87171', pill: '#450a0a' };

  return (
    <>
      <MapHtmlOverlay
        position={branch.center}
        onClick={() => onSelectBranchPin(branch.id)}
        title={`${lang === 'ar' ? branch.labelAr : branch.labelEn} (${branch.availableBays}/${branch.totalBays})`}
        zIndex={selected || isRouteTarget ? 80 : branch.isActiveBranch ? 70 : 40}
      >
        <div
          className={`flex flex-col items-center rounded-xl border-2 px-2.5 py-1.5 shadow-xl transition-transform ${
            selected || isRouteTarget
              ? 'scale-110 ring-2 ring-cyan-300'
              : 'hover:scale-105'
          }`}
          style={{
            backgroundColor: '#08121D',
            borderColor: isRouteTarget ? '#22d3ee' : toneStyle.border,
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-white whitespace-nowrap">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: toneStyle.border }}
            />
            <span>{lang === 'ar' ? branch.shortAr : branch.shortEn}</span>
            {branch.isActiveBranch && (
              <span className="rounded bg-cyan-500/25 px-1 text-[9px] text-cyan-300">
                {t(lang, 'الحالي', 'HERE')}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-bold">
            <span style={{ color: toneStyle.border }}>
              {branch.availableBays}/{branch.totalBays} {t(lang, 'متاح', 'open')}
            </span>
            {!branch.isActiveBranch && (
              <span className="text-slate-300">
                · {branch.roadDistanceKm}km · {formatDuration(branch.totalEtaMinutes, lang)}
              </span>
            )}
          </div>
        </div>
      </MapHtmlOverlay>

      {selected && (
        <InfoWindow
          position={branch.center}
          pixelOffset={[0, -48]}
          onCloseClick={() => onSelectBranchPin('')}
          maxWidth={300}
        >
          <div className="min-w-[245px] p-1 text-slate-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <div>
                <div className="text-xs font-extrabold text-slate-950">
                  {lang === 'ar' ? branch.labelAr : branch.labelEn}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">
                  {lang === 'ar' ? branch.countryAr : branch.countryEn}
                </div>
              </div>
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                style={{ backgroundColor: toneStyle.bg }}
              >
                {branch.availableBays}/{branch.totalBays}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">{t(lang, 'حالة المواقف:', 'Bay Status:')}</span>
                <span className="font-bold" style={{ color: toneStyle.bg }}>
                  {branch.availableBays === 0
                    ? t(lang, 'ممتلئ بالكامل', 'Full')
                    : branch.statusTone === 'amber'
                      ? t(lang, 'ازدحام مرتفع', 'Busy')
                      : t(lang, 'متاح بكثافة', 'Available')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t(lang, 'شواحن EV الشاغرة:', 'Free EV Chargers:')}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {branch.evChargersFree}/{branch.evChargersTotal} ⚡
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t(lang, 'الطاقة الشمسية / BESS:', 'Solar / BESS:')}</span>
                <span className="font-mono font-bold text-slate-900">
                  {branch.solarKw} kW · {branch.bessPct}%
                </span>
              </div>
              {!branch.isActiveBranch && (
                <>
                  <div className="my-1 border-t border-slate-200" />
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t(lang, 'المسافة المقدرة (EV):', 'Est. EV Distance:')}</span>
                    <span className="font-mono font-bold text-cyan-700">
                      {branch.roadDistanceKm.toLocaleString()} km
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t(lang, 'زمن الوصول المتوقع:', 'Est. EV Travel Time:')}</span>
                    <span className="font-mono font-bold text-slate-950">
                      {formatDuration(branch.totalEtaMinutes, lang)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t(lang, 'تقدير البطارية عند الوصول:', 'Battery Plan:')}</span>
                    <span
                      className={`font-bold ${
                        branch.reachableDirectly ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {branch.reachableDirectly
                        ? t(lang, `وصول مباشر (~${branch.arrivalSocPct}%)`, `Direct (~${branch.arrivalSocPct}%)`)
                        : t(
                            lang,
                            `${branch.chargingStops} توقف شحن (+${branch.chargingStopMinutes}د)`,
                            `${branch.chargingStops} DC stop (+${branch.chargingStopMinutes}m)`
                          )}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {!branch.isActiveBranch && (
                <button
                  type="button"
                  onClick={() => onRouteToBranch(branch.id)}
                  className="flex-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-cyan-500"
                >
                  {t(lang, 'عرض المسار والوقت', 'Plot EV Route')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onSwitchToLocalBranch(branch.id)}
                className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
              >
                {t(lang, 'فتح مواقف الفرع', 'Inspect Bays')}
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface EvRouteOverlayProps {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral | null;
  visible: boolean;
  onRealRouteResolved?: (distanceKm: number, durationMinutes: number) => void;
}

const EvRouteOverlay: React.FC<EvRouteOverlayProps> = ({
  origin,
  destination,
  visible,
  onRealRouteResolved,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (!map || !destination || !visible) return;

    // Draw instant geodesic EV corridor line first so global cross-country views respond immediately
    const geodesicLine = new google.maps.Polyline({
      path: [origin, destination],
      geodesic: true,
      strokeColor: '#10b981',
      strokeOpacity: 0.9,
      strokeWeight: 3.5,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: '#38bdf8',
          },
          offset: '50%',
        },
      ],
      map,
    });
    polylineRef.current = geodesicLine;

    // If within reasonable driving range on same landmass and Routes library loaded, try modern Routes API v2
    const airKm = haversineKm(origin, destination);
    let cancelled = false;
    if (routesLib && airKm > 1 && airKm < 1400) {
      const request: google.maps.routes.ComputeRoutesRequest = {
        origin,
        destination,
        travelMode: routesLib.TravelMode.DRIVING,
        fields: ['durationMillis', 'distanceMeters', 'path'],
      };
      routesLib.Route.computeRoutes(request)
        .then((res) => {
          if (cancelled || !res.routes || res.routes.length === 0) return;
          const first = res.routes[0];
          if (first.path && first.path.length > 1) {
            if (polylineRef.current) {
              polylineRef.current.setMap(null);
            }
            polylineRef.current = new google.maps.Polyline({
              path: first.path.map((pt) => ({ lat: pt.lat, lng: pt.lng })),
              geodesic: true,
              strokeColor: '#22d3ee',
              strokeOpacity: 0.95,
              strokeWeight: 4,
              map,
            });
          }
          const distMeters = Number(first.distanceMeters || 0);
          const durMillis = Number(first.durationMillis || 0);
          if (distMeters > 0 && durMillis > 0) {
            onRealRouteResolved?.(
              Math.round(distMeters / 1000),
              Math.max(1, Math.round(durMillis / 60000))
            );
          }
        })
        .catch(() => {
          // Keep clean geodesic line when disconnected by sea or Routes API not enabled
        });
    }

    return () => {
      cancelled = true;
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [destination, map, onRealRouteResolved, origin, routesLib, visible]);

  return null;
};

interface PlaceSearchProps {
  lang: Language;
  onSelectLocation: (loc: google.maps.LatLngLiteral, label: string) => void;
}

const PlacesSearchBox: React.FC<PlaceSearchProps> = ({ lang, onSelectLocation }) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib || !query.trim()) {
      setSuggestions([]);
      return;
    }
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: sessionTokenRef.current || undefined,
      })
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.suggestions || []);
          }
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, query]);

  const handleChoose = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['location', 'displayName', 'formattedAddress'],
      });
      if (place.location) {
        const coords = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        const rawLabel =
          place.displayName || place.formattedAddress || suggestion.placePrediction.text.text;
        onSelectLocation(coords, sanitizePalestineLabel(rawLabel, lang));
      }
      setQuery('');
      setSuggestions([]);
      sessionTokenRef.current = null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  return (
    <div className="relative flex-1 min-w-[220px]">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#08121D] px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-emerald-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            lang,
            'ابحث عن حي أو مدينة لنشر بث المواقف...',
            'Search any city or district to stream live bays...'
          )}
          className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
        />
      </div>
      {suggestions.length > 0 && (
        <ul className="absolute start-0 end-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-[#0A1724] p-1 shadow-2xl">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => handleChoose(s)}
                className="w-full rounded-lg px-3 py-2 text-start text-xs text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300"
              >
                {sanitizePalestineLabel(s.placePrediction?.text.text || '', lang)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface MapViewportControllerProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  mapTypeId: 'roadmap' | 'satellite';
  viewMode: MapViewMode;
  globalPoints: google.maps.LatLngLiteral[];
}

const MapViewportController: React.FC<MapViewportControllerProps> = ({
  center,
  zoom,
  mapTypeId,
  viewMode,
  globalPoints,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (viewMode === 'global' && globalPoints.length > 1 && typeof google !== 'undefined') {
      const bounds = new google.maps.LatLngBounds();
      globalPoints.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, 56);
      return;
    }
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center, zoom, viewMode, globalPoints]);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapTypeId);
  }, [map, mapTypeId]);

  return null;
};

const MapStatusBanner: React.FC<{ lang: Language }> = ({ lang }) => {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">
        {t(
          lang,
          'تعذر تحميل خرائط Google Maps. يرجى التحقق من الشبكة أو صلاحية المفتاح.',
          'Unable to load Google Maps. Please check network or API quota.'
        )}
      </div>
    );
  }
  if (status === APILoadingStatus.LOADING) {
    return (
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300">
        {t(lang, 'جاري تحميل خرائط Google Maps والبث الحي...', 'Loading Google Maps & live stream...')}
      </div>
    );
  }
  return null;
};

export const LiveParkingMap: React.FC<LiveParkingMapProps> = ({
  lang,
  spots,
  bessCharge,
  solarKw,
  smokeAlert,
  onToggleSpot,
  onParkVehicle,
  onAddSpot,
  onReserveBay,
  onTriggerLowBessTest,
}) => {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';
  const [mapsApiKey, setMapsApiKey] = useState<string>(envKey);
  const [keyLoading, setKeyLoading] = useState<boolean>(!envKey);

  const [activeAnchorIdx, setActiveAnchorIdx] = useState<number>(0);
  const [customAnchor, setCustomAnchor] = useState<{
    coords: google.maps.LatLngLiteral;
    label: string;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite'>('roadmap');
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('global');
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [selectedBranchPinId, setSelectedBranchPinId] = useState<string>('');
  const [selectedRouteBranchId, setSelectedRouteBranchId] = useState<string>('branch-riyadh');
  const [liveRouteOverride, setLiveRouteOverride] = useState<
    Record<string, { distanceKm: number; driveMinutes: number }>
  >({});

  // EV Battery Configuration for Distance & Travel Time Estimator
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState<number>(75);
  const [evSocPct, setEvSocPct] = useState<number>(68);
  const [evDriveProfile, setEvDriveProfile] = useState<EvDriveProfile>('standard');

  const [liveStreamEnabled, setLiveStreamEnabled] = useState<boolean>(true);
  const [streamAudioTicks, setStreamAudioTicks] = useState<boolean>(false);
  const [speakingBriefing, setSpeakingBriefing] = useState<boolean>(false);
  const [evProgress, setEvProgress] = useState<number>(0);
  const [branchPulseStep, setBranchPulseStep] = useState<number>(0);
  const [streamEvents, setStreamEvents] = useState<StreamEventItem[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      textAr: 'تم ربط شبكة الفروع العالمية وبث حساسات المواقف على خرائط Google Maps.',
      textEn: 'Global multi-branch network & live parking stream initialized on Google Maps.',
      tone: 'emerald',
    },
  ]);

  useEffect(() => {
    if (envKey) {
      setMapsApiKey(envKey);
      setKeyLoading(false);
      return;
    }
    let mounted = true;
    fetch('/api/maps/config')
      .then((r) => r.json())
      .then((d: { apiKey?: string }) => {
        if (mounted) {
          setMapsApiKey((d.apiKey || '').trim());
          setKeyLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setKeyLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [envKey]);

  const activeAnchor = useMemo(() => {
    if (customAnchor) return customAnchor.coords;
    return BRANCH_ANCHORS[activeAnchorIdx]?.center || BRANCH_ANCHORS[0].center;
  }, [activeAnchorIdx, customAnchor]);

  const activeAnchorItem = useMemo(
    () => BRANCH_ANCHORS[activeAnchorIdx] || BRANCH_ANCHORS[0],
    [activeAnchorIdx]
  );

  const activeAnchorName = useMemo(() => {
    if (customAnchor) return customAnchor.label;
    return lang === 'ar' ? activeAnchorItem.labelAr : activeAnchorItem.labelEn;
  }, [activeAnchorItem, customAnchor, lang]);

  const originCoords = useMemo(
    () => userLocation || activeAnchor,
    [activeAnchor, userLocation]
  );

  const thermal = useMemo(
    () => computeLotThermalStats(spots, true, smokeAlert),
    [spots, smokeAlert]
  );

  const availableCount = useMemo(
    () => spots.filter((s) => s.status === 'available').length,
    [spots]
  );

  const efficiencyKmPerKwh = useMemo(() => {
    if (evDriveProfile === 'eco') return 6.2;
    if (evDriveProfile === 'sport') return 4.5;
    return 5.4;
  }, [evDriveProfile]);

  const cruiseSpeedKmh = useMemo(() => {
    if (evDriveProfile === 'eco') return 86;
    if (evDriveProfile === 'sport') return 108;
    return 95;
  }, [evDriveProfile]);

  const usableEvRangeKm = useMemo(() => {
    const remainingKwh = batteryCapacityKwh * (evSocPct / 100);
    return Math.max(15, Math.round(remainingKwh * efficiencyKmPerKwh * 0.92));
  }, [batteryCapacityKwh, efficiencyKmPerKwh, evSocPct]);

  const pushStreamEvent = useCallback(
    (textAr: string, textEn: string, tone: StreamEventItem['tone'] = 'cyan') => {
      const entry: StreamEventItem = {
        id: `ev-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        textAr,
        textEn,
        tone,
      };
      setStreamEvents((prev) => [entry, ...prev].slice(0, 8));
    },
    []
  );

  useEffect(() => {
    if (!liveStreamEnabled) return;
    let tick = 0;
    const timer = window.setInterval(() => {
      setEvProgress((prev) => (prev + 0.14) % 1);
      tick += 1;
      if (tick % 6 === 0) {
        setBranchPulseStep((s) => s + 1);
      }
    }, 900);
    return () => clearInterval(timer);
  }, [liveStreamEnabled]);

  const branchNetworkStatuses = useMemo<BranchLiveStatus[]>(() => {
    const activeTotal = spots.length;
    const activeOcc = Math.max(0, spots.length - availableCount);
    const activeEvTotal = Math.max(1, spots.filter((s) => s.hasCharger).length);
    const activeEvFree = spots.filter((s) => s.hasCharger && s.status === 'available').length;

    return BRANCH_ANCHORS.map((anchor, idx) => {
      const isActive = !customAnchor && idx === activeAnchorIdx;

      // Sync active branch directly with live lot telemetry; vary sibling hubs realistically
      const drift = isActive
        ? 0
        : ((branchPulseStep + idx) % 3) - 1; // -1, 0, +1
      const totalBays = isActive ? activeTotal : anchor.totalBays;
      const occupiedBays = isActive
        ? activeOcc
        : Math.max(1, Math.min(totalBays, anchor.baseOccupied + drift));
      const availableBays = Math.max(0, totalBays - occupiedBays);
      const occupancyPct = Math.round((occupiedBays / Math.max(1, totalBays)) * 100);
      const statusTone: BranchLiveStatus['statusTone'] =
        availableBays === 0 ? 'red' : occupancyPct >= 75 ? 'amber' : 'emerald';

      const evChargersTotal = isActive ? activeEvTotal : anchor.evChargersTotal;
      const evChargersFree = isActive
        ? activeEvFree
        : Math.max(0, Math.min(evChargersTotal, Math.min(availableBays, anchor.evChargersFree - drift)));

      const straightKm = Math.round(haversineKm(originCoords, anchor.center));
      const override = liveRouteOverride[anchor.id];
      const roadDistanceKm =
        straightKm < 1
          ? 0
          : override?.distanceKm ?? Math.round(straightKm * 1.18);
      const driveMinutes =
        roadDistanceKm === 0
          ? 0
          : override?.driveMinutes ?? Math.max(4, Math.round((roadDistanceKm / cruiseSpeedKmh) * 60));

      const reachableDirectly = roadDistanceKm <= usableEvRangeKm;
      const legRechargeKm = Math.max(80, Math.round(batteryCapacityKwh * 0.65 * efficiencyKmPerKwh));
      const chargingStops = reachableDirectly
        ? 0
        : Math.max(1, Math.ceil((roadDistanceKm - usableEvRangeKm) / legRechargeKm));
      const chargingStopMinutes = chargingStops * 26;
      const totalEtaMinutes = driveMinutes + chargingStopMinutes;

      const totalRangeFullKm = Math.max(100, batteryCapacityKwh * efficiencyKmPerKwh);
      const arrivalSocPct =
        roadDistanceKm === 0
          ? evSocPct
          : reachableDirectly
            ? Math.max(6, Math.round(evSocPct - (roadDistanceKm / totalRangeFullKm) * 100))
            : Math.max(24, 78 - Math.round(((roadDistanceKm % legRechargeKm) / totalRangeFullKm) * 100));

      return {
        ...anchor,
        solarKw: isActive ? solarKw : anchor.solarKw,
        bessPct: isActive ? bessCharge : anchor.bessPct,
        isActiveBranch: isActive,
        totalBays,
        availableBays,
        occupiedBays,
        occupancyPct,
        statusTone,
        straightKm,
        roadDistanceKm,
        driveMinutes,
        chargingStops,
        chargingStopMinutes,
        totalEtaMinutes,
        reachableDirectly,
        arrivalSocPct,
      };
    });
  }, [
    activeAnchorIdx,
    availableCount,
    batteryCapacityKwh,
    bessCharge,
    branchPulseStep,
    cruiseSpeedKmh,
    customAnchor,
    efficiencyKmPerKwh,
    evSocPct,
    liveRouteOverride,
    originCoords,
    solarKw,
    spots,
    usableEvRangeKm,
  ]);

  const selectedRouteTarget = useMemo(
    () =>
      branchNetworkStatuses.find((b) => b.id === selectedRouteBranchId) ||
      branchNetworkStatuses.find((b) => !b.isActiveBranch) ||
      branchNetworkStatuses[0],
    [branchNetworkStatuses, selectedRouteBranchId]
  );

  const globalMapPoints = useMemo(() => {
    const pts = BRANCH_ANCHORS.map((b) => b.center);
    if (userLocation) pts.push(userLocation);
    if (customAnchor) pts.push(customAnchor.coords);
    return pts;
  }, [customAnchor, userLocation]);

  const triggerLiveDispatchPulse = useCallback(() => {
    const avail = spots.find((s) => s.status === 'available');
    if (!avail) {
      const created = onAddSpot();
      pushStreamEvent(
        `بث مباشر: تم رصد امتلاء كامل وإضافة الموقف ${created.label} على الخريطة.`,
        `Live Stream: Full lot detected — expanded bay ${created.label} on map.`,
        'amber'
      );
      if (streamAudioTicks) playSensorHeartbeatTick();
      return;
    }
    const types: VehicleType[] = ['ELECTRIC', 'HYBRID', 'ELECTRIC', 'GASOLINE'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    const plate = `KSA-${Math.floor(1000 + Math.random() * 8999)}`;
    onParkVehicle(avail.id, chosenType, plate);
    if (streamAudioTicks) playSensorHeartbeatTick();
    pushStreamEvent(
      `بث مباشر: دخول ${chosenType} (${plate}) إلى الموقف ${avail.label}.`,
      `Live Stream: ${chosenType} (${plate}) parked at bay ${avail.label}.`,
      'emerald'
    );
  }, [onAddSpot, onParkVehicle, pushStreamEvent, spots, streamAudioTicks]);

  const approachingVehiclePos = useMemo<google.maps.LatLngLiteral>(() => {
    const target = spots.find((s) => s.status === 'available') || spots[0];
    const targetPos = spotToLatLng(target, activeAnchor);
    const gateStart: google.maps.LatLngLiteral = {
      lat: activeAnchor.lat - 0.00055,
      lng: activeAnchor.lng - 0.00075,
    };
    return {
      lat: gateStart.lat + (targetPos.lat - gateStart.lat) * evProgress,
      lng: gateStart.lng + (targetPos.lng - gateStart.lng) * evProgress,
    };
  }, [activeAnchor, evProgress, spots]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        pushStreamEvent(
          'تم تحديد موقعك GPS وحساب المسافات وأوقات الوصول بالبطارية لجميع الفروع.',
          'GPS detected and EV distances/ETAs recalculated across all branches.',
          'cyan'
        );
      },
      () => {
        pushStreamEvent(
          'تعذر الوصول لإحداثيات GPS؛ يتم الحساب انطلاقاً من الفرع النشط.',
          'Geolocation declined; calculating EV routes from active branch.',
          'amber'
        );
      }
    );
  };

  const handleVoiceBriefing = () => {
    const summary =
      lang === 'ar'
        ? `تقرير شبكة إيكو بارك العالمية: الفرع الحالي ${activeAnchorName} يتوفر به ${availableCount} موقف من أصل ${spots.length}. مدى سيارتك الكهربائية الحالي يبلغ ${usableEvRangeKm} كيلومتراً بسعة بطارية ${batteryCapacityKwh} كيلوواط ساعة وشحن ${evSocPct} بالمئة.`
        : `Eco-Park Global Network briefing: ${activeAnchorName} has ${availableCount} of ${spots.length} bays open. Current EV range is ${usableEvRangeKm} km based on ${batteryCapacityKwh} kWh battery at ${evSocPct} percent SoC.`;

    speakCopilotReply(summary, lang, 'Kore', setSpeakingBriefing);
  };

  const handleSelectBranchFromPanel = (branch: BranchLiveStatus, switchLocal: boolean) => {
    setSelectedRouteBranchId(branch.id);
    setSelectedBranchPinId(branch.id);
    if (switchLocal) {
      setCustomAnchor(null);
      const foundIdx = BRANCH_ANCHORS.findIndex((b) => b.id === branch.id);
      if (foundIdx >= 0) setActiveAnchorIdx(foundIdx);
      setMapViewMode('local');
      pushStreamEvent(
        `تم الانتقال إلى بث المواقف التفصيلي لفرع ${branch.shortAr}.`,
        `Switched map to detailed bays view for ${branch.shortEn}.`,
        'emerald'
      );
    } else {
      setMapViewMode('global');
      pushStreamEvent(
        `تم تحديد مسار المركبة الكهربائية إلى ${branch.shortAr}: ${branch.roadDistanceKm} كم (${formatDuration(branch.totalEtaMinutes, 'ar')}).`,
        `Plotted EV route to ${branch.shortEn}: ${branch.roadDistanceKm} km (${formatDuration(branch.totalEtaMinutes, 'en')}).`,
        'cyan'
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0D1E2E] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Global vs Local View Switcher */}
          <div className="flex rounded-lg border border-white/10 bg-[#08121D] p-1">
            <button
              type="button"
              onClick={() => setMapViewMode('global')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition ${
                mapViewMode === 'global'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              {t(lang, 'خريطة الفروع العالمية', 'Global Branches')}
            </button>
            <button
              type="button"
              onClick={() => setMapViewMode('local')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition ${
                mapViewMode === 'local'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {t(lang, 'بث مواقف الفرع', 'Local Bays')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLiveStreamEnabled((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              liveStreamEnabled
                ? 'eco-flash-glow border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                : 'border-white/10 bg-[#08121D] text-slate-400'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {liveStreamEnabled
              ? t(lang, 'بث مباشر نشط', 'Live Stream ON')
              : t(lang, 'البث متوقف', 'Stream Paused')}
          </button>

          <button
            type="button"
            onClick={() => setStreamAudioTicks((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              streamAudioTicks
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                : 'border-white/10 bg-[#08121D] text-slate-400'
            }`}
          >
            {streamAudioTicks ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {t(lang, 'نبضة حساسات', 'Sensor Audio')}
          </button>

          <select
            value={customAnchor ? 'custom' : String(activeAnchorIdx)}
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                setCustomAnchor(null);
                setActiveAnchorIdx(Number(e.target.value));
              }
            }}
            className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
          >
            {BRANCH_ANCHORS.map((b, i) => (
              <option key={b.id} value={String(i)}>
                {lang === 'ar' ? b.labelAr : b.labelEn}
              </option>
            ))}
            {customAnchor && <option value="custom">{customAnchor.label}</option>}
          </select>

          <button
            type="button"
            onClick={() => setMapTypeId((m) => (m === 'satellite' ? 'roadmap' : 'satellite'))}
            className="rounded-lg border border-white/10 bg-[#08121D] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/50"
          >
            {mapTypeId === 'satellite'
              ? t(lang, 'عرض قمر صناعي', 'Satellite View')
              : t(lang, 'عرض خريطة الطرق', 'Roadmap View')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {t(lang, 'موقعي GPS', 'My GPS')}
          </button>

          <button
            type="button"
            onClick={triggerLiveDispatchPulse}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
          >
            <Car className="h-3.5 w-3.5" />
            {availableCount === 0
              ? t(lang, '+ توسيع وبث موقف', '+ Expand & Stream Bay')
              : t(lang, 'بث دخول مركبة حية', 'Stream Live Arrival')}
          </button>

          <button
            type="button"
            onClick={handleVoiceBriefing}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              speakingBriefing
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                : 'border-white/10 bg-[#08121D] text-slate-200 hover:border-emerald-400/50'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
            {t(lang, 'بث ملخص صوتي', 'Voice Briefing')}
          </button>

          <button
            type="button"
            onClick={() => {
              onTriggerLowBessTest();
              playBessCriticalSiren();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25"
          >
            <Siren className="h-3.5 w-3.5" />
            {t(lang, 'اختبار إنذار BESS', 'Test BESS Siren')}
          </button>

          <button
            type="button"
            onClick={() => {
              stopAllAlarms();
              stopCopilotSpeech();
              setSpeakingBriefing(false);
            }}
            className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            {t(lang, 'كتم', 'Mute')}
          </button>
        </div>
      </div>

      {/* EV Battery Capacity & Global Range Calculator Bar */}
      <div className="rounded-xl border border-cyan-400/25 bg-[#0D1E2E] p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <BatteryCharging className="h-4 w-4 text-emerald-400" />
                {t(lang, 'سعة بطارية المركبة الكهربائية (kWh)', 'EV Battery Capacity (kWh)')}
              </span>
              <span className="font-mono font-extrabold text-emerald-400">{batteryCapacityKwh} kWh</span>
            </div>
            <input
              type="range"
              min={30}
              max={120}
              step={5}
              value={batteryCapacityKwh}
              onChange={(e) => setBatteryCapacityKwh(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <div className="flex flex-wrap gap-1.5">
              {[50, 65, 75, 100].map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setBatteryCapacityKwh(cap)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold transition ${
                    batteryCapacityKwh === cap
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/10 bg-[#08121D] text-slate-400 hover:text-white'
                  }`}
                >
                  {cap} kWh
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Zap className="h-4 w-4 text-cyan-400" />
                {t(lang, 'مستوى الشحن الحالي للبطارية (SoC %)', 'Current EV Battery SoC (%)')}
              </span>
              <span
                className={`font-mono font-extrabold ${
                  evSocPct < 25 ? 'text-red-400' : evSocPct < 50 ? 'text-amber-300' : 'text-cyan-300'
                }`}
              >
                {evSocPct}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={2}
              value={evSocPct}
              onChange={(e) => setEvSocPct(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setEvSocPct(pct)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold transition ${
                    evSocPct === pct
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-white/10 bg-[#08121D] text-slate-400 hover:text-white'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#08121D] p-3">
            <div>
              <div className="text-[11px] text-slate-400">
                {t(lang, 'المدى التشغيلي الحالي بالشحنة', 'Current Usable EV Range')}
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-emerald-400">
                {usableEvRangeKm} km
              </div>
              <div className="text-[10px] text-slate-400">
                {userLocation
                  ? t(lang, 'نقطة الانطلاق: موقعك GPS', 'Origin: Your Live GPS')
                  : t(lang, `الانطلاق: ${activeAnchorItem.shortAr}`, `Origin: ${activeAnchorItem.shortEn}`)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400">
                {t(lang, 'نمط القيادة:', 'Drive Profile:')}
              </div>
              <div className="flex rounded-lg border border-white/10 bg-[#0D1E2E] p-0.5">
                {(
                  [
                    { id: 'eco', ar: 'اقتصادي', en: 'Eco' },
                    { id: 'standard', ar: 'قياسي', en: 'Std' },
                    { id: 'sport', ar: 'سريع', en: 'Fast' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEvDriveProfile(p.id)}
                    className={`rounded px-2 py-1 text-[10px] font-bold transition ${
                      evDriveProfile === p.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'ar' ? p.ar : p.en}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map + Multi-Branch & Telemetry Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#0D1E2E] p-3 space-y-3">
          {keyLoading ? (
            <div className="flex h-[520px] items-center justify-center rounded-xl bg-[#08121D] text-xs text-cyan-300">
              {t(lang, 'جاري تهيئة خرائط جوجل...', 'Initializing Google Maps...')}
            </div>
          ) : !mapsApiKey ? (
            <div className="flex h-[520px] flex-col items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-[#08121D] p-6 text-center text-xs text-amber-200">
              <p className="font-bold text-sm text-amber-300">
                {t(lang, 'مفتاح Google Maps API غير متاح حالياً', 'Google Maps API Key is not available')}
              </p>
              <p className="text-slate-400">
                {t(
                  lang,
                  'يرجى تفعيل مفتاح Google Maps من الإعدادات أو إعادة المحاولة.',
                  'Please ensure Google Maps is enabled in Settings > Secrets.'
                )}
              </p>
            </div>
          ) : (
            <APIProvider
              apiKey={mapsApiKey}
              language={lang}
              region="PS"
              libraries={['places', 'routes']}
            >
              <div className="flex flex-wrap items-center gap-2">
                <PlacesSearchBox
                  lang={lang}
                  onSelectLocation={(coords, label) => {
                    setCustomAnchor({ coords, label });
                    setMapViewMode('local');
                    pushStreamEvent(
                      `تم نقل البث الحي للمواقف إلى: ${label}`,
                      `Live parking bay stream relocated to: ${label}`,
                      'cyan'
                    );
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const created = onAddSpot();
                    setMapViewMode('local');
                    pushStreamEvent(
                      `إضافة موقف ذكي جديد (${created.label}) على الخريطة.`,
                      `Added new smart bay (${created.label}) to Google Map.`,
                      'amber'
                    );
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  {t(lang, 'إضافة موقف على الخريطة', '+ Add Bay Pin')}
                </button>
              </div>

              <MapStatusBanner lang={lang} />

              {/* Explicit height container (CF2) */}
              <div
                className={`relative h-[500px] w-full overflow-hidden rounded-xl border transition ${
                  smokeAlert || bessCharge < 20
                    ? 'eco-siren-strobe border-red-500/75'
                    : 'border-white/10'
                }`}
              >
                <Map
                  defaultCenter={activeAnchor}
                  defaultZoom={mapViewMode === 'global' ? 5 : 19}
                  gestureHandling="greedy"
                  mapTypeId={mapTypeId}
                  styles={PALESTINE_CUSTOM_MAP_STYLES}
                  internalUsageAttributionIds={[
                    'gmp_mcp_codeassist_v1_aistudio',
                    'gmp_git_agentskills_v1',
                  ]}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapViewportController
                    center={activeAnchor}
                    zoom={19}
                    mapTypeId={mapTypeId}
                    viewMode={mapViewMode}
                    globalPoints={globalMapPoints}
                  />
                  <OccupiedPalestineMapLayer lang={lang} />

                  {/* EV Route Polyline between origin and target branch in Global View */}
                  <EvRouteOverlay
                    origin={originCoords}
                    destination={
                      selectedRouteTarget && !selectedRouteTarget.isActiveBranch
                        ? selectedRouteTarget.center
                        : null
                    }
                    visible={mapViewMode === 'global'}
                    onRealRouteResolved={(distanceKm, driveMinutes) => {
                      if (!selectedRouteTarget) return;
                      setLiveRouteOverride((prev) => ({
                        ...prev,
                        [selectedRouteTarget.id]: { distanceKm, driveMinutes },
                      }));
                    }}
                  />

                  {/* Global Multi-Branch Pins */}
                  {mapViewMode === 'global' &&
                    branchNetworkStatuses.map((br) => (
                      <BranchNetworkMarkerWithInfo
                        key={br.id}
                        branch={br}
                        selected={selectedBranchPinId === br.id}
                        isRouteTarget={selectedRouteBranchId === br.id}
                        lang={lang}
                        onSelectBranchPin={setSelectedBranchPinId}
                        onRouteToBranch={(branchId) => {
                          setSelectedRouteBranchId(branchId);
                        }}
                        onSwitchToLocalBranch={(branchId) => {
                          handleSelectBranchFromPanel(br, true);
                          if (branchId) setSelectedBranchPinId('');
                        }}
                      />
                    ))}

                  {/* Local Live Parking Bay Markers */}
                  {mapViewMode === 'local' &&
                    spots.map((spot) => {
                      const pos = spotToLatLng(spot, activeAnchor);
                      const tempC = thermal.bayTemps[spot.id]?.tempC ?? 28.0;
                      return (
                        <BayMarkerWithInfo
                          key={spot.id}
                          spot={spot}
                          position={pos}
                          tempC={tempC}
                          selected={selectedSpotId === spot.id}
                          lang={lang}
                          onSelect={setSelectedSpotId}
                          onToggleSpot={onToggleSpot}
                          onParkVehicle={onParkVehicle}
                          onReserveBay={onReserveBay}
                        />
                      );
                    })}

                  {/* Moving EV Approaching Vehicle Marker (Local Bay View) */}
                  {mapViewMode === 'local' && liveStreamEnabled && (
                    <MapHtmlOverlay
                      position={approachingVehiclePos}
                      title={t(lang, 'مركبة EV قادمة نحو الموقف', 'Approaching EV Vehicle')}
                      zIndex={40}
                      interactive={false}
                      anchorCenter
                    >
                      <div className="flex items-center gap-1 rounded-full border-2 border-cyan-300 bg-slate-950 px-2 py-1 text-[10px] font-bold text-cyan-300 shadow-lg">
                        <Navigation className="h-3 w-3" />
                        <span>EV-LIVE</span>
                      </div>
                    </MapHtmlOverlay>
                  )}

                  {/* User Current GPS Marker (if located) */}
                  {userLocation && (
                    <MapHtmlOverlay
                      position={userLocation}
                      title={t(lang, 'موقعك الحالي', 'Your Location')}
                      zIndex={90}
                      anchorCenter
                    >
                      <div className="flex items-center gap-1 rounded-full border-2 border-white bg-cyan-500 px-2.5 py-1 text-[10px] font-extrabold text-slate-950 shadow-xl">
                        <LocateFixed className="h-3 w-3" />
                        <span>{t(lang, 'موقعي', 'GPS')}</span>
                      </div>
                    </MapHtmlOverlay>
                  )}
                </Map>

                {/* Active Route Summary Overlay in Global Mode */}
                {mapViewMode === 'global' && selectedRouteTarget && !selectedRouteTarget.isActiveBranch && (
                  <div className="pointer-events-auto absolute bottom-3 start-3 end-3 sm:end-auto sm:max-w-md rounded-xl border border-cyan-400/40 bg-[#08121D]/95 p-3 backdrop-blur-md shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="h-4 w-4 text-cyan-400" />
                        <span className="text-xs font-extrabold text-white">
                          {lang === 'ar'
                            ? `مسار EV → ${selectedRouteTarget.labelAr}`
                            : `EV Route → ${selectedRouteTarget.labelEn}`}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-extrabold text-emerald-400">
                        {selectedRouteTarget.roadDistanceKm.toLocaleString()} km
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 text-cyan-300" />
                        {t(lang, 'زمن الوصول:', 'ETA:')}{' '}
                        <strong className="text-white">
                          {formatDuration(selectedRouteTarget.totalEtaMinutes, lang)}
                        </strong>
                      </span>
                      <span
                        className={`font-semibold ${
                          selectedRouteTarget.reachableDirectly
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {selectedRouteTarget.reachableDirectly
                          ? t(
                              lang,
                              `يكفي الشحن الحالي (الوصول بـ ${selectedRouteTarget.arrivalSocPct}%)`,
                              `Reachable on charge (~${selectedRouteTarget.arrivalSocPct}% left)`
                            )
                          : t(
                              lang,
                              `${selectedRouteTarget.chargingStops} توقف شحن سريع (+${selectedRouteTarget.chargingStopMinutes}د)`,
                              `${selectedRouteTarget.chargingStops} fast-charge stop(s) (+${selectedRouteTarget.chargingStopMinutes}m)`
                            )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </APIProvider>
          )}
        </div>

        {/* Right Side: Global Multi-Branch Status & Live Telemetry */}
        <div className="space-y-4">
          {/* Global Branches EV Estimator List */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  {t(lang, 'حالة المواقف بالفروع ومسار EV', 'Global Branches & EV ETA')}
                </h3>
              </div>
              <span className="font-mono text-[10px] font-bold text-cyan-400">
                {branchNetworkStatuses.length} {t(lang, 'فروع', 'Hubs')}
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pe-1">
              {branchNetworkStatuses.map((br) => {
                const isSelectedRoute = selectedRouteBranchId === br.id;
                const badgeColor =
                  br.statusTone === 'emerald'
                    ? 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10'
                    : br.statusTone === 'amber'
                      ? 'text-amber-300 border-amber-400/30 bg-amber-500/10'
                      : 'text-red-300 border-red-400/30 bg-red-500/10';

                return (
                  <div
                    key={br.id}
                    className={`rounded-xl border p-3 transition ${
                      isSelectedRoute
                        ? 'border-cyan-400/60 bg-cyan-500/10'
                        : br.isActiveBranch
                          ? 'border-emerald-400/40 bg-[#08121D]'
                          : 'border-white/10 bg-[#08121D] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <span>{lang === 'ar' ? br.labelAr : br.labelEn}</span>
                          {br.isActiveBranch && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                              {t(lang, 'الفرع النشط', 'Active')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{lang === 'ar' ? br.countryAr : br.countryEn}</span>
                          <span>·</span>
                          <span className="font-mono text-cyan-300">
                            {br.evChargersFree}/{br.evChargersTotal} ⚡ {t(lang, 'شواحن حرة', 'EV free')}
                          </span>
                        </div>
                      </div>

                      <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${badgeColor}`}>
                        {br.availableBays}/{br.totalBays}
                      </span>
                    </div>

                    {/* Occupancy progress bar */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all ${
                          br.statusTone === 'emerald'
                            ? 'bg-emerald-400'
                            : br.statusTone === 'amber'
                              ? 'bg-amber-400'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${br.occupancyPct}%` }}
                      />
                    </div>

                    {/* EV Distance & Travel Time based on current battery capacity */}
                    {!br.isActiveBranch && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-[11px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-mono text-slate-200">
                            <span>{br.roadDistanceKm.toLocaleString()} km</span>
                            <span className="text-slate-500">·</span>
                            <span className="font-bold text-cyan-300">
                              {formatDuration(br.totalEtaMinutes, lang)}
                            </span>
                          </div>
                          <div
                            className={`text-[10px] font-semibold ${
                              br.reachableDirectly ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {br.reachableDirectly
                              ? t(
                                  lang,
                                  `وصول مباشر بالبطارية (متبقي ~${br.arrivalSocPct}%)`,
                                  `Direct EV trip (~${br.arrivalSocPct}% arrival SoC)`
                                )
                              : t(
                                  lang,
                                  `يتطلب ${br.chargingStops} توقف شحن (+${br.chargingStopMinutes} د)`,
                                  `Needs ${br.chargingStops} DC charge stop(s) (+${br.chargingStopMinutes}m)`
                                )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectBranchFromPanel(br, false)}
                            className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/25"
                          >
                            {t(lang, 'المسار', 'Route')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectBranchFromPanel(br, true)}
                            className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            {t(lang, 'دخول', 'Bays')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local Lot Summary */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white">
                {t(lang, 'مؤشرات الفرع النشط', 'Active Hub Telemetry')}
              </h3>
              <span className="font-mono text-[11px] font-bold text-emerald-400">
                {availableCount}/{spots.length} {t(lang, 'متاح', 'Avail')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-[#08121D] p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <ThermometerSun className="h-3 w-3 text-amber-400" />
                  <span>{t(lang, 'الحرارة', 'Temp')}</span>
                </div>
                <div className="mt-1 font-mono text-sm font-extrabold text-amber-300">
                  {thermal.avgTempC}°C
                </div>
              </div>

              <div className="rounded-lg bg-[#08121D] p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <BatteryCharging className="h-3 w-3 text-emerald-400" />
                  <span>BESS</span>
                </div>
                <div
                  className={`mt-1 font-mono text-sm font-extrabold ${
                    bessCharge < 20 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {bessCharge}%
                </div>
              </div>

              <div className="rounded-lg bg-[#08121D] p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  <span>{t(lang, 'شمسي', 'Solar')}</span>
                </div>
                <div className="mt-1 font-mono text-sm font-extrabold text-cyan-300">
                  {solarKw}kW
                </div>
              </div>
            </div>
          </div>

          {/* Live Stream Event Feed */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white">
                {t(lang, 'سجل البث الحي للأحداث', 'Live Bay Stream Feed')}
              </h3>
              <span className="font-mono text-[10px] text-cyan-400">IoT · Live</span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {streamEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-white/5 bg-[#08121D] px-3 py-1.5 text-[11px]"
                >
                  <span
                    className={`font-semibold ${
                      ev.tone === 'emerald'
                        ? 'text-emerald-300'
                        : ev.tone === 'amber'
                          ? 'text-amber-300'
                          : ev.tone === 'red'
                            ? 'text-red-300'
                            : 'text-cyan-300'
                    }`}
                  >
                    {lang === 'ar' ? ev.textAr : ev.textEn}
                  </span>
                  <div className="mt-0.5 font-mono text-[9px] text-slate-500">{ev.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
