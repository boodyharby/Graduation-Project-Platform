import React, { useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  Layers,
  Lock,
  Monitor,
  Moon,
  PlusCircle,
  RotateCcw,
  Settings,
  Sliders,
  Sparkles,
  ThermometerSun,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import { Language, NavTab, ProjectSettings } from '../types/parking';
import { t } from '../data/i18n';
import { isSmartNightWindowActive } from '../utils/ecoEngine';

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  projectNameAr: 'إيكو-بارك AI | Eco-Park AI v5.0 Master Edition',
  projectNameEn: 'Eco-Park AI v5.0 Master Edition',
  teamNameAr: 'فريق Team 19 – تيم 19 (مشروع رقم 108)',
  teamNameEn: 'Team 19 (Project #108)',
  instituteNameAr: 'المعهد العالي للإدارة وتكنولوجيا المعلومات بكفر الشيخ',
  instituteNameEn: 'Higher Institute of Management & Information Technology — Kafr El-Sheikh',
  projectCode: 'PRJ-108 · TEAM-19',
  supervisorName: 'إشراف القسم الأكاديمي لنظم المعلومات الذكية',
  autoExpandWhenFull: true,
  strictSingleCarPerBay: true,
  accentTheme: 'emerald',
  autoLoadBalance: true,
  gateKioskMode: false,
  carbonMultiplier: 1,
  thermalGuardLimitC: 46,
  smartNightModeEnabled: true,
  smartNightForceActive: false,
  nightStartHour: 22,
  nightEndHour: 5,
  nightPowerReductionPct: 40,
};

interface SystemSettingsPanelProps {
  lang: Language;
  settings: ProjectSettings;
  totalBays: number;
  flashFxEnabled: boolean;
  onUpdateSettings: (next: ProjectSettings) => void;
  onToggleFlashFx: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onAddManualBay: () => void;
  onNotify: (msg: string) => void;
}

export const SystemSettingsPanel: React.FC<SystemSettingsPanelProps> = ({
  lang,
  settings,
  totalBays,
  flashFxEnabled,
  onUpdateSettings,
  onToggleFlashFx,
  onNavigateTab,
  onAddManualBay,
  onNotify,
}) => {
  const [draft, setDraft] = useState<ProjectSettings>(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draft);
    onNotify(
      t(
        lang,
        'تم حفظ إعدادات المشروع والفريق والمعهد وسياسات التشغيل بنجاح!',
        'Project, Team, Institute & operational policy settings saved!'
      )
    );
  };

  const handleCopyIdentityCard = async () => {
    const summary = [
      `${lang === 'ar' ? draft.projectNameAr : draft.projectNameEn}`,
      `${t(lang, 'الفريق:', 'Team:')} ${lang === 'ar' ? draft.teamNameAr : draft.teamNameEn}`,
      `${t(lang, 'المعهد:', 'Institute:')} ${lang === 'ar' ? draft.instituteNameAr : draft.instituteNameEn}`,
      `${t(lang, 'الرمز:', 'Code:')} ${draft.projectCode}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      onNotify(t(lang, 'تم نسخ بطاقة التعريف الرسمية للمشروع.', 'Copied project identity card.'));
    } catch {
      onNotify(summary);
    }
  };

  const handleExportSettingsJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecopark-settings-profile.json';
    a.click();
    URL.revokeObjectURL(url);
    onNotify(t(lang, 'تم تصدير ملف إعدادات المنظومة JSON.', 'Exported system settings JSON.'));
  };

  return (
    <div className="space-y-6">
      {/* Institutional Crest Showcase Card */}
      <div className="eco-flash-glow rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-[#0E2235] via-[#0B1927] to-[#08121D] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-400">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-300">
                <Award className="h-3.5 w-3.5" />
                <span>{draft.projectCode}</span>
              </div>
              <h2 className="mt-1.5 text-xl font-extrabold text-white">
                {lang === 'ar' ? draft.projectNameAr : draft.projectNameEn}
              </h2>
              <p className="mt-1 text-sm font-semibold text-cyan-300">
                {lang === 'ar' ? draft.teamNameAr : draft.teamNameEn}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                <Building2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>{lang === 'ar' ? draft.instituteNameAr : draft.instituteNameEn}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const next = { ...draft, gateKioskMode: true };
                setDraft(next);
                onUpdateSettings(next);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              <Monitor className="h-3.5 w-3.5" />
              {t(lang, 'تشغيل شاشة البوابة Kiosk', 'Launch Gate Kiosk')}
            </button>
            <button
              type="button"
              onClick={handleCopyIdentityCard}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#08121D] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400/50"
            >
              <Copy className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'نسخ البطاقة التعريفية', 'Copy Identity')}
            </button>
            <button
              type="button"
              onClick={handleExportSettingsJson}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              <Download className="h-3.5 w-3.5" />
              {t(lang, 'تصدير JSON', 'Export JSON')}
            </button>
          </div>
        </div>

        {/* Team & Capacity Highlights */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-white/10 pt-4 text-xs">
          <div className="rounded-xl border border-white/10 bg-[#08121D] p-3">
            <div className="text-slate-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              {t(lang, 'الفريق المنفذ', 'Development Team')}
            </div>
            <div className="mt-1 font-bold text-white">
              {lang === 'ar' ? draft.teamNameAr : draft.teamNameEn}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#08121D] p-3">
            <div className="text-slate-400 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
              {t(lang, 'المؤسسة الأكاديمية', 'Academic Institute')}
            </div>
            <div className="mt-1 font-bold text-white truncate">
              {lang === 'ar' ? draft.instituteNameAr : draft.instituteNameEn}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#08121D] p-3">
            <div className="text-slate-400 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              {t(lang, 'سعة المواقف الحالية', 'Active Lot Capacity')}
            </div>
            <div className="mt-1 font-mono font-bold text-emerald-400 tabular-nums">
              {totalBays} {t(lang, 'موقف ذكي (توسع تلقائي)', 'Smart Bays (Auto-Scale)')}
            </div>
          </div>
        </div>
      </div>

      {/* Editable Identity Form + Smart Parking & Energy Rules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4"
        >
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4 text-emerald-400" />
            {t(lang, 'تعديل بيانات المشروع والفريق والمعهد', 'Edit Project, Team & Institute Profile')}
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-300">
                {t(lang, 'اسم المشروع (عربي)', 'Project Name (Arabic)')}
              </label>
              <input
                type="text"
                value={draft.projectNameAr}
                onChange={(e) => setDraft({ ...draft, projectNameAr: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-slate-300">
                {t(lang, 'اسم الفريق (Team)', 'Team Name')}
              </label>
              <input
                type="text"
                value={draft.teamNameAr}
                onChange={(e) => setDraft({ ...draft, teamNameAr: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-slate-300">
                {t(lang, 'اسم المعهد / الجهة', 'Institute Name')}
              </label>
              <input
                type="text"
                value={draft.instituteNameAr}
                onChange={(e) => setDraft({ ...draft, instituteNameAr: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t(lang, 'كود المشروع', 'Project Code')}
                </label>
                <input
                  type="text"
                  value={draft.projectCode}
                  onChange={(e) => setDraft({ ...draft, projectCode: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 font-mono text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t(lang, 'الإشراف الأكاديمي', 'Academic Supervision')}
                </label>
                <input
                  type="text"
                  value={draft.supervisorName}
                  onChange={(e) => setDraft({ ...draft, supervisorName: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t(lang, 'حفظ الإعدادات', 'Save Settings')}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(DEFAULT_PROJECT_SETTINGS);
                onUpdateSettings(DEFAULT_PROJECT_SETTINGS);
                onNotify(t(lang, 'تمت استعادة الإعدادات الافتراضية.', 'Restored default settings.'));
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#08121D] px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t(lang, 'استعادة الافتراضي', 'Reset Defaults')}
            </button>
          </div>
        </form>

        {/* Smart Lot Rules, Load Balancing & Eco-Campaign Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-3.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-400" />
              {t(lang, 'قواعد المواقف الذكية وموازنة الطاقة', 'Smart Lot Rules & Load Balancing')}
            </h3>

            {/* Locked 1-Car-Per-Bay rule */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-[#08121D] p-3.5">
              <div>
                <div className="text-xs font-bold text-emerald-300">
                  {t(lang, 'حماية الموقف المفرد (مركبة واحدة فقط)', 'Single-Vehicle Bay Lock (1 Bay = 1 Car)')}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t(
                    lang,
                    'يمنع النظام تماماً وضع أو حجز مركبة ثانية في موقف مشغول أو محجوز بالفعل.',
                    'Strictly prevents assigning or parking a second vehicle inside an occupied or reserved bay.'
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-300">
                ENFORCED
              </span>
            </div>

            {/* Auto-Expand when 100% full */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#08121D] p-3.5">
              <div>
                <div className="text-xs font-bold text-white">
                  {t(lang, 'إضافة مواقف تلقائياً عند حجز الكل 100%', 'Auto-Add New Bay When 100% Reserved')}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t(
                    lang,
                    'عند امتلاء أو حجز كل المواقف الحالية، يُنشئ النظام موقفاً ذكياً إضافياً فوراً.',
                    'Automatically expands the lot with a fresh bay whenever zero available bays remain.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = { ...draft, autoExpandWhenFull: !draft.autoExpandWhenFull };
                  setDraft(next);
                  onUpdateSettings(next);
                }}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  draft.autoExpandWhenFull
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-white/15 bg-[#0D1E2E] text-slate-400'
                }`}
              >
                {draft.autoExpandWhenFull ? t(lang, 'مفعّل', 'ON') : t(lang, 'متوقف', 'OFF')}
              </button>
            </div>

            {/* Dynamic Charger Load Balancing */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#08121D] p-3.5">
              <div>
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  {t(lang, 'موازنة الأحمال الذكية للشواحن (Load Balancing)', 'Dynamic EV Charger Load Balancing')}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t(
                    lang,
                    'تخفيض قدرة الشواحن تلقائياً عند ارتفاع الحرارة أو انخفاض BESS لإطالة عمر المعدات.',
                    'Automatically throttles EV charger kW when coil temp spikes or BESS drops to protect hardware.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = { ...draft, autoLoadBalance: !draft.autoLoadBalance };
                  setDraft(next);
                  onUpdateSettings(next);
                  onNotify(
                    next.autoLoadBalance
                      ? t(lang, 'تم تفعيل موازنة الأحمال الذكية للشواحن.', 'Dynamic Charger Load Balancing enabled.')
                      : t(lang, 'تم إيقاف موازنة الأحمال التلقائية.', 'Dynamic Charger Load Balancing paused.')
                  );
                }}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  draft.autoLoadBalance
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-white/15 bg-[#0D1E2E] text-slate-400'
                }`}
              >
                {draft.autoLoadBalance ? t(lang, 'نشط', 'ACTIVE') : t(lang, 'متوقف', 'OFF')}
              </button>
            </div>

            {/* Thermal Guard Limit Slider */}
            <div className="rounded-xl border border-white/10 bg-[#08121D] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <ThermometerSun className="h-3.5 w-3.5 text-amber-400" />
                  {t(lang, 'حد الحماية الحرارية للشواحن (°C)', 'Charger Thermal Guard Limit (°C)')}
                </span>
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {draft.thermalGuardLimitC}°C
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={55}
                step={1}
                value={draft.thermalGuardLimitC}
                onChange={(e) => {
                  const next = { ...draft, thermalGuardLimitC: Number(e.target.value) };
                  setDraft(next);
                  onUpdateSettings(next);
                }}
                className="w-full accent-amber-400"
              />
            </div>

            {/* Smart Night Mode: Late-Hours Power Reduction & Eye-Comfort 3D UI */}
            <div className="rounded-xl border border-indigo-400/30 bg-[#0B1120] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-amber-300" />
                    {t(lang, 'الوضع الليلي الذكي (توفير الطاقة وراحة العين 3D)', 'Smart Night Mode (Late-Hours Save & Eye-Comfort 3D)')}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {t(
                      lang,
                      'يخفض استهلاك إضاءة ومرافق المواقف تلقائياً في الساعات المتأخرة، ويحوّل ألوان المحاكي 3D إلى ألوان ليلية هادئة ومريحة للعين.',
                      'Automatically reduces bay power draw during late hours and shifts 3D Simulator colors to a low-glare eye-comfort palette.'
                    )}
                  </p>
                </div>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    isSmartNightWindowActive(
                      draft.smartNightModeEnabled,
                      draft.smartNightForceActive,
                      draft.nightStartHour,
                      draft.nightEndHour
                    )
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {isSmartNightWindowActive(
                    draft.smartNightModeEnabled,
                    draft.smartNightForceActive,
                    draft.nightStartHour,
                    draft.nightEndHour
                  )
                    ? t(lang, `نشط الآن (-${draft.nightPowerReductionPct}% طاقة)`, `ACTIVE (-${draft.nightPowerReductionPct}%)`)
                    : t(lang, 'بانتظار الساعات المتأخرة', 'Standby')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...draft, smartNightModeEnabled: !draft.smartNightModeEnabled };
                    setDraft(next);
                    onUpdateSettings(next);
                  }}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    draft.smartNightModeEnabled
                      ? 'bg-indigo-500 text-white'
                      : 'border border-white/15 bg-[#08121D] text-slate-400'
                  }`}
                >
                  {draft.smartNightModeEnabled
                    ? t(lang, 'الجدولة الليلية التلقائية: مفعّلة', 'Auto Schedule: ON')
                    : t(lang, 'تفعيل الجدولة الليلية', 'Enable Auto Schedule')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = { ...draft, smartNightForceActive: !draft.smartNightForceActive };
                    setDraft(next);
                    onUpdateSettings(next);
                    onNotify(
                      next.smartNightForceActive
                        ? t(
                            lang,
                            `تم تفعيل الوضع الليلي الذكي فوراً: خفض الطاقة ${next.nightPowerReductionPct}% وتعديل ألوان 3D لراحة العين.`,
                            `Smart Night Mode activated now: -${next.nightPowerReductionPct}% load & Eye-Comfort 3D colors.`
                          )
                        : t(
                            lang,
                            'تم إيقاف التشغيل القسري والعودة لجدول الساعات المتأخرة.',
                            'Manual night override disabled; reverted to late-hour schedule.'
                          )
                    );
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    draft.smartNightForceActive
                      ? 'border-amber-400/60 bg-amber-400 text-slate-950'
                      : 'border-white/15 bg-[#08121D] text-slate-200 hover:border-amber-300/50'
                  }`}
                >
                  {draft.smartNightForceActive
                    ? t(lang, 'التفعيل الفوري: نشط الآن', 'Force Active: ON')
                    : t(lang, 'تفعيل فوري الآن (معاينة)', 'Force Active Now')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-300">
                    {t(lang, 'بداية الساعات المتأخرة', 'Late-Hours Start')}
                  </label>
                  <select
                    value={draft.nightStartHour}
                    onChange={(e) => {
                      const next = { ...draft, nightStartHour: Number(e.target.value) };
                      setDraft(next);
                      onUpdateSettings(next);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-[#08121D] px-2.5 py-1.5 font-mono text-xs text-white outline-none"
                  >
                    {[18, 19, 20, 21, 22, 23].map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-300">
                    {t(lang, 'نهاية الساعات المتأخرة', 'Late-Hours End')}
                  </label>
                  <select
                    value={draft.nightEndHour}
                    onChange={(e) => {
                      const next = { ...draft, nightEndHour: Number(e.target.value) };
                      setDraft(next);
                      onUpdateSettings(next);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-[#08121D] px-2.5 py-1.5 font-mono text-xs text-white outline-none"
                  >
                    {[4, 5, 6, 7, 8].map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {t(lang, 'نسبة خفض الطاقة التلقائي ليلاً', 'Automatic Night Power Reduction')}
                  </span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    -{draft.nightPowerReductionPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={60}
                  step={5}
                  value={draft.nightPowerReductionPct}
                  onChange={(e) => {
                    const next = { ...draft, nightPowerReductionPct: Number(e.target.value) };
                    setDraft(next);
                    onUpdateSettings(next);
                  }}
                  className="mt-1.5 w-full accent-indigo-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onAddManualBay}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25"
            >
              <PlusCircle className="h-4 w-4" />
              {t(lang, 'إضافة موقف ذكي جديد يدوياً الآن (2D & 3D)', 'Add Extra Smart Bay Manually Now (2D & 3D)')}
            </button>
          </div>

          {/* Eco-Campaign Multiplier, Visual Theme & Quick Shortcuts */}
          <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              {t(lang, 'مضاعف نقاط الكربون والمظهر والاختصارات', 'Carbon Multiplier, Theme & Quick Actions')}
            </h3>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-300">
                {t(lang, 'حملة مضاعفة نقاط الكربون للسائقين', 'Green Campaign Carbon Points Multiplier')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([1, 1.5, 2] as const).map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => {
                      const next = { ...draft, carbonMultiplier: mult };
                      setDraft(next);
                      onUpdateSettings(next);
                      onNotify(
                        t(
                          lang,
                          `تم ضبط مضاعف نقاط الكربون على ${mult}x!`,
                          `Carbon points multiplier set to ${mult}x!`
                        )
                      );
                    }}
                    className={`rounded-xl border px-3 py-2 font-mono text-xs font-bold transition ${
                      draft.carbonMultiplier === mult
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/10 bg-[#08121D] text-slate-400 hover:text-white'
                    }`}
                  >
                    {mult}x {mult === 1 ? t(lang, 'قياسي', 'Std') : mult === 1.5 ? t(lang, 'أخضر', 'Eco') : t(lang, 'أسبوع البيئة', 'Peak')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                {t(lang, 'لون هوية الشعار الرئيسي', 'Brand Accent Theme')}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'emerald', ar: 'زمردي إيكو', en: 'Eco Emerald' },
                    { id: 'cyan', ar: 'سماوي تقني', en: 'Cyber Cyan' },
                    { id: 'amber', ar: 'ذهبي VIP', en: 'Executive Gold' },
                  ] as const
                ).map((themeOpt) => (
                  <button
                    key={themeOpt.id}
                    type="button"
                    onClick={() => {
                      const next = { ...draft, accentTheme: themeOpt.id };
                      setDraft(next);
                      onUpdateSettings(next);
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      draft.accentTheme === themeOpt.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-white'
                        : 'border-white/10 bg-[#08121D] text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'ar' ? themeOpt.ar : themeOpt.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleFlashFx}
                className="rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/50"
              >
                {flashFxEnabled
                  ? t(lang, 'وميض CSS: نشط', 'CSS Flash FX: ON')
                  : t(lang, 'وميض CSS: هادئ', 'CSS Flash FX: OFF')}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('audio')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/50"
              >
                <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                {t(lang, 'تخصيص التنبيهات الصوتية', 'Audio Studio')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('data_hygiene')}
              className="w-full flex items-center justify-between rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/25 transition"
            >
              <span>
                {t(
                  lang,
                  'فتح قسم مسح كل البيانات الوهمية والنسخ الاحتياطي',
                  'Open Zero-Mock Wipe & Data Hygiene Studio'
                )}
              </span>
              <span className="font-mono text-[11px] text-rose-300">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
