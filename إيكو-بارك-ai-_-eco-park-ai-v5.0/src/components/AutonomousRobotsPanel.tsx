import React, { useMemo, useState } from 'react';
import {
  BatteryCharging,
  Bot,
  CheckCircle2,
  Flame,
  Navigation,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  ChargingRobotState,
  EvacRobotState,
  Language,
  ParkingSpot,
} from '../types/parking';
import { t } from '../data/i18n';
import {
  playHydraulicGateSound,
  playReservationCompleteSound,
  playSensorHeartbeatTick,
  speakGuidance,
  speakSafetyWarning,
} from '../utils/ecoEngine';

interface AutonomousRobotsPanelProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  smokeAlert: boolean;
  flashFxEnabled: boolean;
  chargingRobot: ChargingRobotState;
  evacRobot: EvacRobotState;
  onUpdateChargingRobot: React.Dispatch<React.SetStateAction<ChargingRobotState>>;
  onUpdateEvacRobot: React.Dispatch<React.SetStateAction<EvacRobotState>>;
  onLogRobotCharge: (spotId: string, plate: string, kwh: number) => void;
  onClearSmokeAlert: () => void;
  onLogAudit: (ar: string, en: string) => void;
  onNotify: (msg: string) => void;
}

export const AutonomousRobotsPanel: React.FC<AutonomousRobotsPanelProps> = ({
  lang,
  spots,
  bessCharge,
  smokeAlert,
  flashFxEnabled,
  chargingRobot,
  evacRobot,
  onUpdateChargingRobot,
  onUpdateEvacRobot,
  onLogRobotCharge,
  onClearSmokeAlert,
  onLogAudit,
  onNotify,
}) => {
  const [selectedChargeBay, setSelectedChargeBay] = useState<string>(
    () => spots.find((s) => s.status !== 'available')?.id || spots[0]?.id || 'A-01'
  );
  const [selectedEvacZone, setSelectedEvacZone] = useState<string>('B-04');

  const targetChargeSpot = useMemo(
    () => spots.find((s) => s.id === (chargingRobot.targetSpotId || selectedChargeBay)) || spots[0],
    [spots, chargingRobot.targetSpotId, selectedChargeBay]
  );

  const targetEvacSpot = useMemo(
    () => spots.find((s) => s.id === (evacRobot.targetZone || selectedEvacZone)) || spots[3] || spots[0],
    [spots, evacRobot.targetZone, selectedEvacZone]
  );

  const chargeRobotCoords = useMemo(() => {
    if (chargingRobot.phase === 'docked' || !chargingRobot.targetSpotId) {
      return { x: 85, y: 155 };
    }
    const idx = Math.max(
      0,
      spots.findIndex((s) => s.id === chargingRobot.targetSpotId)
    );
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    return { x: 210 + col * 105, y: row === 0 ? 78 : 225 };
  }, [chargingRobot.phase, chargingRobot.targetSpotId, spots]);

  const evacRobotCoords = useMemo(() => {
    if (evacRobot.phase === 'standby') {
      return { x: 85, y: 230 };
    }
    const idx = spots.findIndex((s) => s.id === evacRobot.targetZone);
    if (idx === -1) return { x: 420, y: 155 };
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    return { x: 210 + col * 105, y: row === 0 ? 112 : 195 };
  }, [evacRobot.phase, evacRobot.targetZone, spots]);

  const handleDispatchChargeRobot = () => {
    const bay = spots.find((s) => s.id === selectedChargeBay) || spots[0];
    if (!bay) return;
    if (bessCharge < 15) {
      onNotify(
        t(
          lang,
          'تحذير: بطارية BESS أقل من 15% — يُنصح بإبقاء الروبوت في وضع حفظ الطاقة.',
          'Warning: BESS below 15% — keep mobile charger docked for reserve.'
        )
      );
      return;
    }

    const plate = bay.vehiclePlate || `EV-${bay.label}`;
    playHydraulicGateSound();
    onUpdateChargingRobot((prev) => ({
      ...prev,
      phase: 'charging',
      targetSpotId: bay.id,
      targetPlate: plate,
      powerKw: 45,
      batteryPct: Math.max(25, prev.batteryPct - 6),
    }));
    speakGuidance(
      lang === 'ar'
        ? `تم توجيه روبوت الشحن المتنقل إلى الموقف ${bay.label} لبدء الشحن السريع بقدرة 45 كيلوواط.`
        : `EcoCharge mobile robot dispatched to bay ${bay.label} at 45 kilowatts DC.`,
      lang
    );
    onLogAudit(
      `إرسال روبوت الشحن المتنقل EcoCharge X1 إلى الموقف ${bay.label} (${plate})`,
      `Dispatched EcoCharge X1 mobile robot to bay ${bay.label} (${plate})`
    );
    onNotify(
      t(
        lang,
        `روبوت الشحن EcoCharge X1 وصل إلى ${bay.label} وبدأ شحن ${plate} (45 kW).`,
        `EcoCharge X1 docked at ${bay.label}, fast-charging ${plate} (45 kW).`
      )
    );
  };

  const handleCompleteRobotCharge = () => {
    const bayId = chargingRobot.targetSpotId || selectedChargeBay;
    const plate = chargingRobot.targetPlate || `EV-${bayId}`;
    const kwhAdded = 18.5;
    playReservationCompleteSound();
    onUpdateChargingRobot((prev) => ({
      ...prev,
      phase: 'docked',
      targetSpotId: null,
      targetPlate: undefined,
      powerKw: 0,
      deliveredKwh: Number((prev.deliveredKwh + kwhAdded).toFixed(1)),
      batteryPct: Math.min(100, prev.batteryPct + 10),
    }));
    onLogRobotCharge(bayId, plate, kwhAdded);
    onNotify(
      t(
        lang,
        `اكتمل شحن ${kwhAdded} kWh للمركبة ${plate} وأُضيفت نقاط الكربون وعاد الروبوت للمحطة الشمسية.`,
        `Delivered ${kwhAdded} kWh to ${plate}. Carbon points logged and robot returned to solar dock.`
      )
    );
  };

  const handleDispatchEvacRobot = (mode: 'escorting' | 'suppression') => {
    const zone = selectedEvacZone || 'B-04';
    playSensorHeartbeatTick();
    onUpdateEvacRobot((prev) => ({
      ...prev,
      phase: mode,
      targetZone: zone,
      laserGuideActive: true,
      sirenBeaconActive: true,
      evacuatedCount: prev.evacuatedCount + (mode === 'escorting' ? 4 : 1),
      batteryPct: Math.max(20, prev.batteryPct - 4),
    }));

    if (mode === 'escorting') {
      speakSafetyWarning(
        lang === 'ar'
          ? `روبوت الإخلاء الذكي في القطاع ${zone}: يرجى من السائقين اتباع المسار الضوئي الأخضر والتوجه نحو بوابة الخروج الآمنة فوراً.`
          : `SafeGuard Evacuation Robot at sector ${zone}: drivers please follow the green laser corridor to the safe exit gate immediately.`,
        lang,
        0
      );
      onLogAudit(
        `تفعيل روبوت الإخلاء SafeGuard R2 لقيادة الإخلاء الضوئي والصوتي عند ${zone}`,
        `Activated SafeGuard R2 Evacuation Robot for guided evacuation at ${zone}`
      );
      onNotify(
        t(
          lang,
          `روبوت الإخلاء يوجّه السائقين ضوئياً وصوتياً عبر الممر الأخضر من ${zone}.`,
          `Evacuation Robot guiding drivers along green laser corridor from ${zone}.`
        )
      );
    } else {
      speakGuidance(
        lang === 'ar'
          ? `روبوت الإخلاء بدأ العزل الحراري ورش رذاذ الإخماد عند ${zone}.`
          : `SafeGuard Robot initiated thermal containment and suppression mist at ${zone}.`,
        lang
      );
      onLogAudit(
        `روبوت السلامة SafeGuard R2 نفذ تدخل عزل حراري في ${zone}`,
        `SafeGuard R2 executed thermal containment at ${zone}`
      );
      onNotify(
        t(
          lang,
          `روبوت السلامة يعالج البؤرة الحرارية في ${zone} بالرذاذ المبرد.`,
          `Safety robot suppressing thermal hotspot at ${zone}.`
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Dual Status Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Charging Robot Card */}
        <div
          className={`rounded-xl border bg-[#0D1E2E] p-5 space-y-4 transition ${
            chargingRobot.phase === 'charging' && flashFxEnabled
              ? 'eco-flash-glow border-cyan-400/60'
              : 'border-white/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                <BatteryCharging className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {t(lang, 'روبوت الشحن المتنقل (EcoCharge Bot X1)', 'Mobile EV Charging Robot (EcoCharge X1)')}
                </h2>
                <p className="text-xs text-slate-400">
                  {t(
                    lang,
                    'يتحرك ذاتياً لأي موقف لشحن المركبات الكهربائية بقدرة 45kW DC',
                    'Autonomous 45kW DC fast charger dispatched directly to any bay'
                  )}
                </p>
              </div>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${
                chargingRobot.phase === 'charging'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {chargingRobot.phase === 'charging'
                ? t(lang, `يشحن ${chargingRobot.targetSpotId}`, `Charging ${chargingRobot.targetSpotId}`)
                : t(lang, 'في المحطة الشمسية', 'Solar Docked')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'بطارية الروبوت', 'Robot Battery')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
                {chargingRobot.batteryPct}%
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'القدرة اللحظية', 'Live Output')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-cyan-400 tabular-nums">
                {chargingRobot.powerKw} kW
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'الطاقة المنقولة', 'Delivered')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-amber-400 tabular-nums">
                {chargingRobot.deliveredKwh} kWh
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedChargeBay}
              onChange={(e) => setSelectedChargeBay(e.target.value)}
              className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            >
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.vehiclePlate || t(lang, 'متاح / EV', 'Available / EV')} ({s.zone})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDispatchChargeRobot}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              <Zap className="h-3.5 w-3.5" />
              {t(lang, 'إرسال للشحن 45kW', 'Dispatch 45kW')}
            </button>
            {chargingRobot.phase === 'charging' && (
              <button
                type="button"
                onClick={handleCompleteRobotCharge}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t(lang, 'إنهاء وتسجيل +18.5 kWh', 'Finish & Log Charge')}
              </button>
            )}
          </div>
        </div>

        {/* Evacuation Robot Card */}
        <div
          className={`rounded-xl border bg-[#0D1E2E] p-5 space-y-4 transition ${
            (smokeAlert || evacRobot.phase === 'escorting' || evacRobot.phase === 'suppression') &&
            flashFxEnabled
              ? 'eco-siren-strobe border-red-500/70'
              : 'border-white/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {t(lang, 'روبوت الإخلاء والسلامة (SafeGuard Evac-Bot R2)', 'Autonomous Evacuation Robot (SafeGuard R2)')}
                </h2>
                <p className="text-xs text-slate-400">
                  {t(
                    lang,
                    'إرشاد السائقين بالليزر والنداء الصوتي والعزل الحراري في الطوارئ',
                    'Laser corridor escort, voice alerts & thermal containment in emergencies'
                  )}
                </p>
              </div>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${
                evacRobot.phase === 'escorting' || evacRobot.phase === 'suppression'
                  ? 'bg-red-500/25 text-red-300'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {evacRobot.phase}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'جاهزية الطاقة', 'Unit Power')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
                {evacRobot.batteryPct}%
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'القطاع المستهدف', 'Active Sector')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-amber-400">
                {evacRobot.targetZone}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#08121D] p-2.5">
              <div className="text-[11px] text-slate-400">{t(lang, 'مساعدات الإخلاء', 'Escorted Cars')}</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-cyan-400 tabular-nums">
                {evacRobot.evacuatedCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedEvacZone}
              onChange={(e) => setSelectedEvacZone(e.target.value)}
              className="flex-1 min-w-[130px] rounded-xl border border-white/10 bg-[#08121D] px-3 py-2 text-xs text-white outline-none focus:border-red-400"
            >
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(lang, `القطاع / الموقف ${s.label}`, `Sector / Bay ${s.label}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDispatchEvacRobot('escorting')}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {t(lang, 'إخلاء صوتي وضوئي', 'Voice Escort')}
            </button>
            <button
              type="button"
              onClick={() => handleDispatchEvacRobot('suppression')}
              className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-400"
            >
              <Flame className="h-3.5 w-3.5" />
              {t(lang, 'عزل حراري', 'Suppress')}
            </button>
            {(evacRobot.phase !== 'patrol' || smokeAlert) && (
              <button
                type="button"
                onClick={() => {
                  onUpdateEvacRobot((prev) => ({
                    ...prev,
                    phase: 'patrol',
                    laserGuideActive: false,
                    sirenBeaconActive: false,
                  }));
                  if (smokeAlert) onClearSmokeAlert();
                  onNotify(t(lang, 'عاد روبوت السلامة لدورية المراقبة.', 'SafeGuard robot returned to patrol.'));
                }}
                className="flex items-center gap-1 rounded-xl border border-white/15 bg-[#08121D] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/50"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                {t(lang, 'تأمين ودورية', 'Return Patrol')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Facility Radar Floorplan showing both robots in real time */}
      <div className="rounded-xl border border-white/10 bg-[#0D1E2E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Navigation className="h-4 w-4 text-emerald-400" />
              {t(lang, 'خريطة المسار الحي للروبوتات داخل الساحة', 'Live Autonomous Fleet Floorplan & Routing')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                lang,
                'تتبع لحظي لموقع EcoCharge Bot X1 و SafeGuard Evac-Bot R2 ومسار الإخلاء الأخضر.',
                'Real-time bay telemetry showing EcoCharge Bot X1, SafeGuard R2 & green exit lane.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Bot className="h-3.5 w-3.5" /> EcoCharge X1 ({targetChargeSpot?.label || 'Dock'})
            </span>
            <span className="flex items-center gap-1.5 text-red-300">
              <Radio className="h-3.5 w-3.5" /> SafeGuard R2 ({targetEvacSpot?.label || 'Patrol'})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 760 290"
            className="w-full min-w-[600px] rounded-xl border border-white/10 bg-[#07111C]"
          >
            {/* Solar Dock Zone */}
            <rect x="20" y="105" width="120" height="150" rx="12" fill="#0D2234" stroke="#1E4E68" strokeWidth="1.5" />
            <text x="80" y="130" textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="700">
              SOLAR ROBOT DOCK
            </text>

            {/* Green Evacuation Corridor */}
            <rect
              x="160"
              y="132"
              width="580"
              height="34"
              rx="8"
              fill={evacRobot.laserGuideActive || smokeAlert ? '#064E3B' : '#0B1B2A'}
              stroke={evacRobot.laserGuideActive || smokeAlert ? '#10B981' : '#1E3A52'}
              strokeWidth="1.5"
              strokeDasharray={evacRobot.laserGuideActive || smokeAlert ? '8 5' : undefined}
            />
            <text x="450" y="153" textAnchor="middle" fill="#34D399" fontSize="11" fontWeight="700">
              {evacRobot.laserGuideActive || smokeAlert
                ? '>>> GREEN EVACUATION LASER CORRIDOR ACTIVE >>> EXIT >>>'
                : 'CENTRAL SMART LANE & AUTONOMOUS TRANSIT'}
            </text>

            {/* Bays */}
            {spots.slice(0, 10).map((s, idx) => {
              const col = idx % 5;
              const row = Math.floor(idx / 5);
              const bx = 170 + col * 105;
              const by = row === 0 ? 25 : 190;
              const isSmoke = smokeAlert && s.id === 'B-04';
              const stroke = isSmoke
                ? '#EF4444'
                : s.status === 'available'
                  ? '#10B981'
                  : s.status === 'reserved'
                    ? '#F59E0B'
                    : '#38BDF8';
              return (
                <g key={s.id}>
                  <rect
                    x={bx}
                    y={by}
                    width="88"
                    height="72"
                    rx="10"
                    fill={isSmoke ? '#450A0A' : '#0D1E2E'}
                    stroke={stroke}
                    strokeWidth={isSmoke ? '2.5' : '1.5'}
                  />
                  <text x={bx + 44} y={by + 24} textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800">
                    {s.label}
                  </text>
                  <text x={bx + 44} y={by + 42} textAnchor="middle" fill={stroke} fontSize="9.5" fontWeight="700">
                    {isSmoke ? 'SMOKE ALERT' : s.vehiclePlate || s.status.toUpperCase()}
                  </text>
                  <text x={bx + 44} y={by + 58} textAnchor="middle" fill="#94A3B8" fontSize="9">
                    {s.hasCharger ? `${s.chargerKw}kW EV` : s.zone}
                  </text>
                </g>
              );
            })}

            {/* EcoCharge Robot Route Line */}
            {chargingRobot.phase === 'charging' && (
              <line
                x1="85"
                y1="155"
                x2={chargeRobotCoords.x}
                y2={chargeRobotCoords.y}
                stroke="#22D3EE"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}

            {/* EcoCharge Bot X1 Marker */}
            <g transform={`translate(${chargeRobotCoords.x}, ${chargeRobotCoords.y})`}>
              <circle r="16" fill="#083344" stroke="#22D3EE" strokeWidth="2.5" />
              <text y="4" textAnchor="middle" fill="#22D3EE" fontSize="10" fontWeight="900">
                ⚡X1
              </text>
            </g>

            {/* SafeGuard Evac Bot R2 Marker */}
            <g transform={`translate(${evacRobotCoords.x}, ${evacRobotCoords.y})`}>
              <circle
                r="16"
                fill={evacRobot.sirenBeaconActive ? '#7F1D1D' : '#1E293B'}
                stroke={evacRobot.sirenBeaconActive ? '#F87171' : '#FBBF24'}
                strokeWidth="2.5"
              />
              <text
                y="4"
                textAnchor="middle"
                fill={evacRobot.sirenBeaconActive ? '#FCA5A5' : '#FCD34D'}
                fontSize="10"
                fontWeight="900"
              >
                🛡R2
              </text>
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-[#08121D] px-4 py-3 text-xs text-slate-300">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            {t(
              lang,
              'ملاحظة: يرتبط روبوت الشحن مباشرة بمحفظة الكربون وسجل الطاقة، بينما يرتبط روبوت الإخلاء برادار السلامة والنداء الصوتي لتوجيه السائقين فورياً.',
              'Charging Bot logs kWh & Carbon Points directly to your ledger; Evacuation Bot coordinates Safety Sentry voice & corridor lighting.'
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
