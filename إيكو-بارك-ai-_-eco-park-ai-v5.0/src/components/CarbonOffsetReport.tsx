import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Leaf, Trees } from 'lucide-react';
import { Language, Reservation, VehicleType } from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS } from '../utils/ecoEngine';

interface CarbonOffsetReportProps {
  lang: Language;
  reservations: Reservation[];
}

interface MonthlyCarbonPoint {
  monthKey: string;
  monthLabel: string;
  co2Kg: number;
  cumulativeCo2Kg: number;
  bookingsCount: number;
  pointsEarned: number;
}

function resolveMonthKey(res: Reservation): string {
  const raw = res.entryTime || res.createdAt || '';
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string, lang: Language): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export const CarbonOffsetReport: React.FC<CarbonOffsetReportProps> = ({ lang, reservations }) => {
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | VehicleType>('ALL');
  const [chartView, setChartView] = useState<'monthly' | 'byVehicle'>('monthly');

  const filteredReservations = useMemo(() => {
    if (vehicleFilter === 'ALL') return reservations;
    return reservations.filter((r) => r.vehicleType === vehicleFilter);
  }, [reservations, vehicleFilter]);

  const monthlyData = useMemo<MonthlyCarbonPoint[]>(() => {
    const buckets: Record<
      string,
      { co2Kg: number; bookingsCount: number; pointsEarned: number }
    > = {};

    filteredReservations.forEach((res) => {
      const key = resolveMonthKey(res);
      if (!buckets[key]) {
        buckets[key] = { co2Kg: 0, bookingsCount: 0, pointsEarned: 0 };
      }
      buckets[key].co2Kg += Number(res.co2SavedKg || 0);
      buckets[key].bookingsCount += 1;
      buckets[key].pointsEarned += Number(res.pointsEarned || 0);
    });

    const sortedKeys = Object.keys(buckets).sort();
    let runningTotal = 0;

    return sortedKeys.map((monthKey) => {
      const item = buckets[monthKey];
      const roundedCo2 = Number(item.co2Kg.toFixed(2));
      runningTotal = Number((runningTotal + roundedCo2).toFixed(2));
      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey, lang),
        co2Kg: roundedCo2,
        cumulativeCo2Kg: runningTotal,
        bookingsCount: item.bookingsCount,
        pointsEarned: item.pointsEarned,
      };
    });
  }, [filteredReservations, lang]);

  const vehicleBreakdownData = useMemo(() => {
    const types: VehicleType[] = ['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'];
    return types.map((vt) => {
      const subset = reservations.filter((r) => r.vehicleType === vt);
      const co2Kg = Number(
        subset.reduce((acc, r) => acc + Number(r.co2SavedKg || 0), 0).toFixed(2)
      );
      return {
        category: lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn,
        co2Kg,
        bookingsCount: subset.length,
      };
    });
  }, [lang, reservations]);

  const totals = useMemo(() => {
    const totalCo2Kg = Number(
      filteredReservations.reduce((acc, r) => acc + Number(r.co2SavedKg || 0), 0).toFixed(2)
    );
    const count = filteredReservations.length;
    const avgPerBooking = count > 0 ? Number((totalCo2Kg / count).toFixed(2)) : 0;
    const treesEquivalent = Number((totalCo2Kg / 21.77).toFixed(1));
    return { totalCo2Kg, count, avgPerBooking, treesEquivalent };
  }, [filteredReservations]);

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-[#0D1E2E] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-400" />
            {t(
              lang,
              'تقرير تعويض الكربون الشهري (CarbonOffsetReport · Firestore)',
              'Monthly Carbon Offset Report (CarbonOffsetReport · Firestore)'
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t(
              lang,
              'إجمالي انبعاثات ثاني أكسيد الكربون التي تم تجنبها شهرياً بناءً على الحجوزات الفعلية المسجلة في Firestore.',
              'Interactive monthly CO2 emissions avoided computed directly from Firestore reservation records.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value as 'ALL' | VehicleType)}
            className="rounded-lg border border-white/10 bg-[#08121D] px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
          >
            <option value="ALL">{t(lang, 'كل فئات المركبات', 'All Vehicle Types')}</option>
            <option value="ELECTRIC">{VEHICLE_SPECS.ELECTRIC[lang === 'ar' ? 'labelAr' : 'labelEn']}</option>
            <option value="HYBRID">{VEHICLE_SPECS.HYBRID[lang === 'ar' ? 'labelAr' : 'labelEn']}</option>
            <option value="GASOLINE">{VEHICLE_SPECS.GASOLINE[lang === 'ar' ? 'labelAr' : 'labelEn']}</option>
            <option value="DIESEL">{VEHICLE_SPECS.DIESEL[lang === 'ar' ? 'labelAr' : 'labelEn']}</option>
          </select>

          <button
            type="button"
            onClick={() => setChartView('monthly')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              chartView === 'monthly'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {t(lang, 'التقرير الشهري', 'Monthly Trend')}
          </button>
          <button
            type="button"
            onClick={() => setChartView('byVehicle')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              chartView === 'byVehicle'
                ? 'bg-cyan-400 text-slate-950'
                : 'border border-white/10 bg-[#08121D] text-slate-300 hover:text-white'
            }`}
          >
            {t(lang, 'حسب المركبة', 'By Vehicle')}
          </button>
        </div>
      </div>

      {/* Live Firestore Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="text-slate-400">{t(lang, 'إجمالي CO2 المتجنب', 'Total CO2 Avoided')}</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
            {totals.totalCo2Kg} kg
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="text-slate-400">{t(lang, 'حجوزات Firestore', 'Firestore Bookings')}</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-cyan-300 tabular-nums">
            {totals.count}
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="text-slate-400">{t(lang, 'متوسط الوفر / حجز', 'Avg Saved / Booking')}</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-amber-300 tabular-nums">
            {totals.avgPerBooking} kg
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-[#08121D] p-3">
          <div className="flex items-center gap-1 text-slate-400">
            <Trees className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t(lang, 'مكافئ الأشجار', 'Trees Equivalent')}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-emerald-300 tabular-nums">
            {totals.treesEquivalent}
          </div>
        </div>
      </div>

      {/* Interactive Recharts Chart or Empty State */}
      {filteredReservations.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#08121D] p-6 text-center text-xs text-slate-400">
          <Leaf className="mb-2 h-8 w-8 text-emerald-500/60" />
          <p className="font-semibold text-slate-300">
            {t(
              lang,
              'لا توجد حجوزات مسجلة حالياً في Firestore لعرض الانبعاثات المتجنبة.',
              'No Firestore reservations recorded yet to calculate monthly carbon offsets.'
            )}
          </p>
          <p className="mt-1">
            {t(
              lang,
              'أضف حجزاً من تبويب «الحجوزات وتذكرة QR» ليتم رسم التقرير الشهري تلقائياً.',
              'Create a booking in Reservations & QR Pass to populate the monthly CO2 chart.'
            )}
          </p>
        </div>
      ) : (
        <div className="h-72 w-full rounded-xl border border-white/5 bg-[#08121D] p-3">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'monthly' ? (
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="monthLabel" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  yAxisId="co2"
                  stroke="#10b981"
                  tick={{ fontSize: 11, fill: '#34d399' }}
                  label={{ value: 'kg CO2', angle: -90, position: 'insideLeft', fill: '#34d399', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  allowDecimals={false}
                  stroke="#06b6d4"
                  tick={{ fontSize: 11, fill: '#22d3ee' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1724',
                    borderColor: 'rgba(16,185,129,0.4)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar
                  yAxisId="co2"
                  dataKey="co2Kg"
                  name={t(lang, 'CO2 متجنب شهرياً (كجم)', 'Monthly CO2 Avoided (kg)')}
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />
                <Line
                  yAxisId="co2"
                  type="monotone"
                  dataKey="cumulativeCo2Kg"
                  name={t(lang, 'الإجمالي التراكمي (كجم)', 'Cumulative CO2 (kg)')}
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#fbbf24' }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="bookingsCount"
                  name={t(lang, 'عدد الحجوزات', 'Bookings Count')}
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={vehicleBreakdownData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#10b981" tick={{ fontSize: 11, fill: '#34d399' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1724',
                    borderColor: 'rgba(16,185,129,0.4)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar
                  dataKey="co2Kg"
                  name={t(lang, 'إجمالي CO2 المتجنب (كجم)', 'CO2 Avoided (kg)')}
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={36}
                />
                <Bar
                  dataKey="bookingsCount"
                  name={t(lang, 'عدد الحجوزات', 'Bookings')}
                  fill="#06b6d4"
                  radius={[6, 6, 0, 0]}
                  barSize={22}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
