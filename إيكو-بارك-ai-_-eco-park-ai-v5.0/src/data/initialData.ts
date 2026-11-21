import { ParkingSpot } from '../types/parking';

export const EMPTY_SPOTS: ParkingSpot[] = [
  {
    id: 'A-01',
    label: 'A-01',
    zone: 'EV-Fast',
    status: 'available',
    hasCharger: true,
    chargerKw: 150,
    distanceFromGateMeters: 18,
    x2d: 180,
    y2d: 110,
    x3d: -12,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'A-02',
    label: 'A-02',
    zone: 'EV-Fast',
    status: 'available',
    hasCharger: true,
    chargerKw: 150,
    distanceFromGateMeters: 24,
    x2d: 310,
    y2d: 110,
    x3d: -6,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'A-03',
    label: 'A-03',
    zone: 'EV-Fast',
    status: 'available',
    hasCharger: true,
    chargerKw: 120,
    distanceFromGateMeters: 30,
    x2d: 440,
    y2d: 110,
    x3d: 0,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'A-04',
    label: 'A-04',
    zone: 'Eco-Hybrid',
    status: 'available',
    hasCharger: true,
    chargerKw: 50,
    distanceFromGateMeters: 36,
    x2d: 570,
    y2d: 110,
    x3d: 6,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'A-05',
    label: 'A-05',
    zone: 'Eco-Hybrid',
    status: 'available',
    hasCharger: false,
    chargerKw: 0,
    distanceFromGateMeters: 42,
    x2d: 660,
    y2d: 110,
    x3d: 12,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'A-06',
    label: 'A-06',
    zone: 'EV-Fast',
    status: 'available',
    hasCharger: true,
    chargerKw: 150,
    distanceFromGateMeters: 48,
    x2d: 740,
    y2d: 110,
    x3d: 18,
    z3d: -7,
    row: 'top',
  },
  {
    id: 'B-01',
    label: 'B-01',
    zone: 'Eco-Hybrid',
    status: 'available',
    hasCharger: true,
    chargerKw: 50,
    distanceFromGateMeters: 20,
    x2d: 180,
    y2d: 330,
    x3d: -12,
    z3d: 7,
    row: 'bottom',
  },
  {
    id: 'B-02',
    label: 'B-02',
    zone: 'Standard',
    status: 'available',
    hasCharger: false,
    chargerKw: 0,
    distanceFromGateMeters: 26,
    x2d: 300,
    y2d: 330,
    x3d: -6,
    z3d: 7,
    row: 'bottom',
  },
  {
    id: 'B-03',
    label: 'B-03',
    zone: 'Standard',
    status: 'available',
    hasCharger: false,
    chargerKw: 0,
    distanceFromGateMeters: 32,
    x2d: 420,
    y2d: 330,
    x3d: 0,
    z3d: 7,
    row: 'bottom',
  },
  {
    id: 'B-04',
    label: 'B-04',
    zone: 'Standard',
    status: 'available',
    hasCharger: false,
    chargerKw: 0,
    distanceFromGateMeters: 38,
    x2d: 540,
    y2d: 330,
    x3d: 6,
    z3d: 7,
    row: 'bottom',
  },
  {
    id: 'B-05',
    label: 'B-05',
    zone: 'Standard',
    status: 'available',
    hasCharger: false,
    chargerKw: 0,
    distanceFromGateMeters: 44,
    x2d: 660,
    y2d: 330,
    x3d: 12,
    z3d: 7,
    row: 'bottom',
  },
  {
    id: 'B-06',
    label: 'B-06',
    zone: 'Eco-Hybrid',
    status: 'available',
    hasCharger: true,
    chargerKw: 50,
    distanceFromGateMeters: 50,
    x2d: 740,
    y2d: 330,
    x3d: 18,
    z3d: 7,
    row: 'bottom',
  },
];

export const BRANCHES = [
  'الفرع الرئيسي - كفر الشيخ الذكي',
  'فرع الرياض الأخضر - العليا',
  'فرع جدة الساحلي المستدام',
  'فرع نيوم - ذا لاين للأعمال',
  'فرع القدس المستدام - فلسطين المحتلة',
];

export function createAdditionalParkingSpot(
  existingSpots: ParkingSpot[],
  preferredZone?: ParkingSpot['zone']
): ParkingSpot {
  const topCount = existingSpots.filter((s) => s.row === 'top').length;
  const bottomCount = existingSpots.filter((s) => s.row === 'bottom').length;
  const row: 'top' | 'bottom' = topCount <= bottomCount ? 'top' : 'bottom';
  const indexInRow = row === 'top' ? topCount + 1 : bottomCount + 1;
  const prefix = row === 'top' ? 'A' : 'B';
  const numStr = String(indexInRow).padStart(2, '0');
  const id = `${prefix}-${numStr}`;

  const zone: ParkingSpot['zone'] =
    preferredZone || (row === 'top' ? 'EV-Fast' : 'Eco-Hybrid');
  const hasCharger = zone === 'EV-Fast' || row === 'top';
  const chargerKw = zone === 'EV-Fast' ? 150 : hasCharger ? 50 : 0;

  // Dynamic x positioning computed cleanly relative to row count
  const colIdx = indexInRow - 1;
  const x3d = -12 + colIdx * 6;
  const z3d = row === 'top' ? -7 : 7;
  const x2d = Math.min(760, 180 + colIdx * 110);
  const y2d = row === 'top' ? 110 : 330;

  return {
    id,
    label: id,
    zone,
    status: 'available',
    hasCharger,
    chargerKw,
    distanceFromGateMeters: 18 + colIdx * 6,
    x2d,
    y2d,
    x3d,
    z3d,
    row,
  };
}
