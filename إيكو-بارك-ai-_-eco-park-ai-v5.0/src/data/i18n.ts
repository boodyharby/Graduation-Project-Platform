import { Language, NavTab, UserRole } from '../types/parking';

export const NAV_LABELS: Record<NavTab, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  livemap: { ar: 'بث المواقف على الخريطة', en: 'Live Parking Map' },
  parking: { ar: 'المواقف و ANPR', en: 'Parking & ANPR' },
  reservations: { ar: 'الحجوزات ومسار الرحلات (101)', en: 'Reservations & Routes (101)' },
  robots: { ar: 'روبوتات الشحن والإخلاء', en: 'Charge & Evac Robots' },
  billing: { ar: 'التسعير والفوترة الذكية', en: 'Dynamic Billing' },
  forecast: { ar: 'التوقعات والفعاليات (107)', en: 'Forecast & Events (107)' },
  operations: { ar: 'الأساطيل والصيانة والطوارئ', en: 'Fleets, Work Orders & Drills' },
  energy: { ar: 'الطاقة و BESS', en: 'Energy & BESS' },
  wallet: { ar: 'محفظة الكربون', en: 'Carbon Wallet' },
  sim2d: { ar: 'المحاكي 2D', en: '2D Simulator' },
  sim3d: { ar: 'المحاكي 3D', en: '3D Simulator' },
  reports: { ar: 'التقارير ESG', en: 'ESG Reports' },
  search: { ar: 'البحث', en: 'Search' },
  maintenance: { ar: 'الصيانة والحساسات', en: 'Maintenance & Health' },
  audio: { ar: 'التنبيهات الصوتية', en: 'Audio & Alerts' },
  settings: { ar: 'الإعدادات والهوية', en: 'Settings & About' },
  data_hygiene: { ar: 'مسح البيانات الوهمية', en: 'Zero-Mock & Data Studio' },
  users: { ar: 'المستخدمون والأدوار', en: 'Users & Roles' },
  help: { ar: 'المساعدة والشرح', en: 'Help & Guide' },
  language: { ar: 'اللغة', en: 'Language' },
};

export const ALL_ROLES: UserRole[] = [
  'Super Admin',
  'Parking Manager',
  'Operator',
  'Driver',
  'Security',
  'Maintenance & Energy',
  'Finance',
  'Sustainability',
  'Guest',
];

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  'Super Admin': 'مدير النظام الأعلى (Super Admin)',
  'Parking Manager': 'مدير المواقف (Parking Manager)',
  Operator: 'المشغّل (Operator)',
  Driver: 'السائق (Driver)',
  Security: 'الأمن والسلامة (Security)',
  'Maintenance & Energy': 'الصيانة والطاقة (Maintenance & Energy)',
  Finance: 'المالية والتعرفة (Finance)',
  Sustainability: 'الاستدامة والكربون (Sustainability)',
  Guest: 'ضيف (Guest)',
};

export function t(lang: Language, ar: string, en: string): string {
  return lang === 'ar' ? ar : en;
}
