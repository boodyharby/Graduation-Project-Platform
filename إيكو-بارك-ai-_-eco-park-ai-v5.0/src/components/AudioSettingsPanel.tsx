import React, { useState } from 'react';
import {
  BatteryWarning,
  Bell,
  CheckCircle2,
  Flame,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AudioPreferences,
  BessToneId,
  CompletionToneId,
  FcmToneId,
  FireToneId,
  Language,
} from '../types/parking';
import { t } from '../data/i18n';
import {
  DEFAULT_AUDIO_PREFERENCES,
  playBessCriticalSiren,
  playFcmNotificationSound,
  playFireAlarmSiren,
  playReservationCompleteSound,
  stopAllAlarms,
  stopCopilotSpeech,
} from '../utils/ecoEngine';

interface AudioSettingsPanelProps {
  lang: Language;
  prefs: AudioPreferences;
  onUpdatePrefs: (next: AudioPreferences) => void;
  onNotify?: (msg: string) => void;
}

const FIRE_TONES: Array<{ id: FireToneId; ar: string; en: string; descAr: string; descEn: string }> = [
  {
    id: 'nfpa_bell',
    ar: 'بوق NFPA-72 وجرس إخلاء معدني',
    en: 'NFPA-72 Temporal-3 Horn & Bell',
    descAr: 'نغمة إخلاء قياسية ثلاثية النبضات مع رنين جرس معدني واقعي',
    descEn: 'Standard 3-pulse evacuation horn paired with metallic bell strike',
  },
  {
    id: 'europa_hi_lo',
    ar: 'سارينة طوارئ ثنائية النغمة (Hi-Lo)',
    en: 'European Hi-Lo Dual-Tone Siren',
    descAr: 'تبديل هوائي متناوب بين تردد 880Hz و 660Hz بصدى الموقف الخرساني',
    descEn: 'Alternating pneumatic 880Hz / 660Hz emergency sweep',
  },
  {
    id: 'rapid_piezo',
    ar: 'إنذار بيزو نبضي عالي السرعة',
    en: 'Rapid High-Frequency Piezo Chirp',
    descAr: 'نبضات تحذير مركزة وسريعة للفت الانتباه الفوري في غرف التحكم',
    descEn: 'Sharp high-urgency piezo bursts for control-room attention',
  },
];

const BESS_TONES: Array<{ id: BessToneId; ar: string; en: string; descAr: string; descEn: string }> = [
  {
    id: 'industrial_klaxon',
    ar: 'كلاكسون توربيني صناعي ثقيل',
    en: 'Industrial Turbine Klaxon Siren',
    descAr: 'محرك كلاكسون متصاعد ومتراجع مخصص لمحطات البطاريات',
    descEn: 'Heavy motor-driven klaxon sweep designed for substation batteries',
  },
  {
    id: 'substation_pulse',
    ar: 'نبضة محطة SCADA المزدوجة',
    en: 'SCADA Substation Dual-Tone Pulse',
    descAr: 'رنين تحكم كهربائي مزدوج التردد 960Hz / 720Hz لتنبيه انخفاض الطاقة',
    descEn: 'Crisp dual-frequency 960Hz / 720Hz control-room power alert',
  },
  {
    id: 'sonar_ping',
    ar: 'موجة سونار الشبكة الكهربائية',
    en: 'Power-Grid Sonar Sweep',
    descAr: 'نغمة مسح عميقة ومنخفضة الإجهاد للتحذير المستمر من هبوط الشحن',
    descEn: 'Deep resonant grid warning sweep for sustained battery monitoring',
  },
];

const COMPLETION_TONES: Array<{
  id: CompletionToneId;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}> = [
  {
    id: 'eco_chime',
    ar: 'توافق إيكو الأخضر المتصاعد',
    en: 'Green Eco-Pass Harmonic Chime',
    descAr: 'سلم موسيقي متصاعد دافئ عند إنهاء الحجز وتوثيق وفر CO2',
    descEn: 'Warm ascending major-9th arpeggio upon checkout and CO2 logging',
  },
  {
    id: 'crystal_bell',
    ar: 'جرس الضيافة الكريستالي المزدوج',
    en: 'Soft Crystal Double Bell',
    descAr: 'نغمة هادئة ونقية مناسبة لاستقبال ومغادرة السائقين',
    descEn: 'Clear hospitality chime tailored for driver checkout confirmation',
  },
  {
    id: 'futuristic_trill',
    ar: 'تغريدة المركبات الكهربائية الذكية',
    en: 'EV Telemetry Digital Trill',
    descAr: 'سلسلة نغمات رقمية سريعة تؤكد تحرير الموقف وإرسال إشعار FCM',
    descEn: 'Crisp five-note EV cadence confirming bay release & FCM push',
  },
];

const FCM_TONES: Array<{
  id: FcmToneId;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}> = [
  {
    id: 'egyptian_hospitality',
    ar: 'نغمة الضيافة المصرية الودودة',
    en: 'Friendly Egyptian Welcome Chime',
    descAr: 'تدرج موسيقي دافئ ومبهج يصاحب تفعيل واستلام إشعارات FCM باللهجة المصرية',
    descEn: 'Warm, cheerful ascending chime paired with friendly Egyptian voice notices',
  },
  {
    id: 'vip_bell',
    ar: 'جرس الإشعار الفوري المتناغم',
    en: 'Harmonic Priority Notification Bell',
    descAr: 'نغمة واضحة وسريعة لتنبيهات الوصول والحجوزات وإشعارات المشرفين',
    descEn: 'Crisp harmonic bell ideal for arrival, VIP, and supervisor push alerts',
  },
  {
    id: 'scada_ping',
    ar: 'نبضة إشعارات الشبكة SCADA',
    en: 'SCADA Telemetry Radar Ping',
    descAr: 'رنين رقمي قصير وأنيق لإشعارات الطاقة الشمسية والبطاريات في غرفة التحكم',
    descEn: 'Short crisp telemetry ping for solar & BESS background FCM messages',
  },
];

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  lang,
  prefs,
  onUpdatePrefs,
  onNotify,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);

  const toggleMuteAll = () => {
    const nextMuted = !prefs.muted;
    onUpdatePrefs({ ...prefs, muted: nextMuted });
    onNotify?.(
      nextMuted
        ? t(lang, 'تم كتم جميع الأصوات والتنبيهات الصوتية تماماً.', 'All system alarms & audio alerts muted.')
        : t(lang, 'تم تفعيل الصوت والتنبيهات المخصصة.', 'System audio alerts unmuted.')
    );
  };

  return (
    <div className="space-y-6">
      {/* Master Mute & Volume Control Card */}
      <div
        className={`rounded-xl border p-6 transition ${
          prefs.muted
            ? 'border-red-500/45 bg-red-950/20'
            : 'eco-flash-glow border-emerald-500/35 bg-[#0D1E2E]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                prefs.muted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {prefs.muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {t(lang, 'مركز تخصيص التنبيهات الصوتية', 'Audio & Alert Customization Center')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {t(
                  lang,
                  'اختر نغمات مخصصة لإنذار الحريق، تحذير بطاريات BESS، واكتمال الحجز مع التحكم الكامل بمستوى الصوت والكتم الفوري.',
                  'Assign distinct synthesized alerts for fire alarms, BESS warnings, and reservation checkout, or mute all system audio.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopAllAlarms();
                stopCopilotSpeech();
                setTestingId(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#08121D] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Square className="h-3.5 w-3.5 text-amber-400" />
              {t(lang, 'إيقاف المعاينة', 'Stop Playback')}
            </button>

            <button
              type="button"
              onClick={toggleMuteAll}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                prefs.muted
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'border border-red-400/50 bg-red-500/20 text-red-200 hover:bg-red-500/30'
              }`}
            >
              {prefs.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {prefs.muted
                ? t(lang, 'إلغاء كتم الأصوات', 'Unmute All Audio')
                : t(lang, 'كتم الأصوات تماماً', 'Mute All Sounds')}
            </button>
          </div>
        </div>

        {/* Volume Slider, Voice Toggle & Reset */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 md:grid-cols-3 items-center">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                {t(lang, 'مستوى الصوت الرئيسي', 'Master Alert Volume')}
              </span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                {prefs.muted ? '0%' : `${Math.round(prefs.volume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              disabled={prefs.muted}
              value={prefs.volume}
              onChange={(e) => onUpdatePrefs({ ...prefs, volume: Number(e.target.value) })}
              className="w-full accent-emerald-400 disabled:opacity-40"
            />
          </div>

          <button
            type="button"
            disabled={prefs.muted}
            onClick={() =>
              onUpdatePrefs({ ...prefs, voiceEnabled: !prefs.voiceEnabled })
            }
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-40 ${
              prefs.voiceEnabled
                ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-[#08121D] text-slate-400'
            }`}
          >
            {prefs.voiceEnabled ? <Mic className="h-4 w-4 text-cyan-400" /> : <MicOff className="h-4 w-4" />}
            {prefs.voiceEnabled
              ? t(lang, 'المذيع الصوتي الذكي: مفعّل', 'Voice Announcer: ON')
              : t(lang, 'المذيع الصوتي الذكي: متوقف', 'Voice Announcer: OFF')}
          </button>

          <button
            type="button"
            onClick={() => {
              stopAllAlarms();
              setTestingId(null);
              onUpdatePrefs(DEFAULT_AUDIO_PREFERENCES);
              onNotify?.(
                t(lang, 'تمت استعادة إعدادات الصوت الافتراضية.', 'Restored default audio preferences.')
              );
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#08121D] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-emerald-400/40 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t(lang, 'استعادة النغمات الافتراضية', 'Reset to Defaults')}
          </button>
        </div>
      </div>

      {/* Selectable Alert Tone Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Fire Alarm Tones */}
        <div className="rounded-xl border border-red-500/25 bg-[#0D1E2E] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Flame className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(lang, 'نغمة إنذار الحريق والدخان', 'Fire & Smoke Alarm Tone')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(lang, 'تُطلق عند تفعيل رادار السلامة B-04', 'Played when Safety Sentry fires')}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {FIRE_TONES.map((tone) => {
              const selected = prefs.fireTone === tone.id;
              return (
                <div
                  key={tone.id}
                  className={`rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-red-400/60 bg-red-500/15'
                      : 'border-white/10 bg-[#08121D] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdatePrefs({ ...prefs, fireTone: tone.id })}
                      className="flex-1 text-start"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        <span>{lang === 'ar' ? tone.ar : tone.en}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'ar' ? tone.descAr : tone.descEn}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={prefs.muted}
                      onClick={() => {
                        onUpdatePrefs({ ...prefs, fireTone: tone.id });
                        setTestingId(`fire-${tone.id}`);
                        playFireAlarmSiren(tone.id);
                      }}
                      className={`shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-40 ${
                        testingId === `fire-${tone.id}`
                          ? 'border-red-400 bg-red-500 text-white'
                          : 'border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      {t(lang, 'تجربة', 'Test')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. BESS Warning Tones */}
        <div className="rounded-xl border border-amber-500/25 bg-[#0D1E2E] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <BatteryWarning className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(lang, 'نغمة تحذير بطاريات BESS (< 20%)', 'BESS Critical Warning Tone')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(lang, 'تُطلق عند هبوط الشحن دون 20% أو 10%', 'Triggered when battery drops below 20%')}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {BESS_TONES.map((tone) => {
              const selected = prefs.bessTone === tone.id;
              return (
                <div
                  key={tone.id}
                  className={`rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-amber-400/60 bg-amber-500/15'
                      : 'border-white/10 bg-[#08121D] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdatePrefs({ ...prefs, bessTone: tone.id })}
                      className="flex-1 text-start"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                        <span>{lang === 'ar' ? tone.ar : tone.en}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'ar' ? tone.descAr : tone.descEn}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={prefs.muted}
                      onClick={() => {
                        onUpdatePrefs({ ...prefs, bessTone: tone.id });
                        setTestingId(`bess-${tone.id}`);
                        playBessCriticalSiren(tone.id);
                      }}
                      className={`shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-40 ${
                        testingId === `bess-${tone.id}`
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      {t(lang, 'تجربة', 'Test')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Reservation Completed Tones */}
        <div className="rounded-xl border border-emerald-500/25 bg-[#0D1E2E] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(lang, 'نغمة اكتمال الحجز والمغادرة', 'Reservation Completed Chime')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(lang, 'تُطلق عند انتقال الحجز إلى completed', 'Played when booking switches to completed')}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {COMPLETION_TONES.map((tone) => {
              const selected = prefs.completionTone === tone.id;
              return (
                <div
                  key={tone.id}
                  className={`rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-emerald-400/60 bg-emerald-500/15'
                      : 'border-white/10 bg-[#08121D] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdatePrefs({ ...prefs, completionTone: tone.id })}
                      className="flex-1 text-start"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {selected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span>{lang === 'ar' ? tone.ar : tone.en}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'ar' ? tone.descAr : tone.descEn}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={prefs.muted}
                      onClick={() => {
                        onUpdatePrefs({ ...prefs, completionTone: tone.id });
                        setTestingId(`comp-${tone.id}`);
                        playReservationCompleteSound(tone.id);
                      }}
                      className={`shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-40 ${
                        testingId === `comp-${tone.id}`
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      {t(lang, 'تجربة', 'Test')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. FCM Push Notification Tones */}
        <div className="rounded-xl border border-cyan-500/25 bg-[#0D1E2E] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-cyan-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {t(lang, 'نغمة إشعارات FCM الفورية', 'FCM Push Notification Sound')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(lang, 'تُطلق مع الترحيب المصري الودود عند تفعيل أو استلام FCM', 'Played with friendly Egyptian greeting on FCM alerts')}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {FCM_TONES.map((tone) => {
              const selected = (prefs.fcmTone || 'egyptian_hospitality') === tone.id;
              return (
                <div
                  key={tone.id}
                  className={`rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-cyan-400/60 bg-cyan-500/15'
                      : 'border-white/10 bg-[#08121D] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdatePrefs({ ...prefs, fcmTone: tone.id })}
                      className="flex-1 text-start"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {selected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        )}
                        <span>{lang === 'ar' ? tone.ar : tone.en}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'ar' ? tone.descAr : tone.descEn}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={prefs.muted}
                      onClick={() => {
                        onUpdatePrefs({ ...prefs, fcmTone: tone.id });
                        setTestingId(`fcm-${tone.id}`);
                        playFcmNotificationSound('welcome', tone.id);
                      }}
                      className={`shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-40 ${
                        testingId === `fcm-${tone.id}`
                          ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                          : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      {t(lang, 'تجربة', 'Test')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
