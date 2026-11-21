export type VehicleType = 'ELECTRIC' | 'HYBRID' | 'GASOLINE' | 'DIESEL';

export type Language = 'ar' | 'en';

export type UserRole =
  | 'Super Admin'
  | 'Parking Manager'
  | 'Operator'
  | 'Driver'
  | 'Security'
  | 'Maintenance & Energy'
  | 'Finance'
  | 'Sustainability'
  | 'Guest';

export type NavTab =
  | 'dashboard'
  | 'livemap'
  | 'parking'
  | 'reservations'
  | 'robots'
  | 'billing'
  | 'forecast'
  | 'operations'
  | 'energy'
  | 'wallet'
  | 'sim2d'
  | 'sim3d'
  | 'reports'
  | 'search'
  | 'maintenance'
  | 'audio'
  | 'settings'
  | 'data_hygiene'
  | 'users'
  | 'help'
  | 'language';

export type CameraMode3D = 'orbit' | 'drone' | 'bess' | 'gate' | 'driver';
export type LightingMode3D = 'sunny' | 'sunset' | 'night';
export type WeatherCondition2D = 'sunny' | 'rainy' | 'stormy';

export interface ParkingSpot {
  id: string;
  label: string;
  zone: 'EV-Fast' | 'Eco-Hybrid' | 'Standard';
  status: 'available' | 'occupied' | 'reserved';
  hasCharger: boolean;
  chargerKw: number;
  vehiclePlate?: string;
  vehicleType?: VehicleType;
  driverName?: string;
  distanceFromGateMeters: number;
  x2d: number;
  y2d: number;
  x3d: number;
  z3d: number;
  row: 'top' | 'bottom';
}

export interface Reservation {
  id: string;
  ticketCode: string;
  branch: string;
  spotId: string;
  spotLabel: string;
  driverName: string;
  plateNumber: string;
  vehicleType: VehicleType;
  entryTime: string;
  exitTime: string;
  feeSar: number;
  carbonTaxSar: number;
  pointsEarned: number;
  co2SavedKg: number;
  exhaustPpm: number;
  status: 'active' | 'arrived' | 'completed' | 'cancelled';
  checkedInAt?: string;
  createdAt: string;
  userId?: string;
}

export interface CarbonTransaction {
  id: string;
  date: string;
  descriptionAr: string;
  descriptionEn: string;
  points: number;
  co2Kg: number;
  type: 'visit' | 'v2g' | 'tax_offset' | 'bonus';
}

export interface V2GSession {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  mode: 'charging' | 'discharging' | 'paused';
  energyKwh: number;
  powerKw: number;
  startedAt: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'pending' | 'rejected';
  lastSeen: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  actionAr: string;
  actionEn: string;
}

export interface SimCar {
  id: string;
  plate: string;
  vehicleType: VehicleType;
  targetSpotId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  phase: 'entering' | 'lane' | 'turning' | 'parked';
  color: string;
  distanceSavedM: number;
  co2SavedG: number;
  arrivalSeconds: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionTaken?: string;
  timestamp: string;
}

export type SupervisorAlertType = 'SMOKE_RADAR' | 'BESS_UNDER_10';

export interface SupervisorAlertIncident {
  id: string;
  userId: string;
  alertType: SupervisorAlertType;
  status: 'monitoring' | 'escalated' | 'resolved';
  bessCharge: number;
  smokeAlert: boolean;
  startedAtMs: number;
  thresholdMinutes: number;
  emailDispatched: boolean;
  recipients: string[];
  summaryAr: string;
  summaryEn: string;
}

export type FireToneId = 'nfpa_bell' | 'europa_hi_lo' | 'rapid_piezo';
export type BessToneId = 'industrial_klaxon' | 'substation_pulse' | 'sonar_ping';
export type CompletionToneId = 'eco_chime' | 'crystal_bell' | 'futuristic_trill';
export type FcmToneId = 'egyptian_hospitality' | 'vip_bell' | 'scada_ping';

export interface AudioPreferences {
  muted: boolean;
  voiceEnabled: boolean;
  volume: number;
  fireTone: FireToneId;
  bessTone: BessToneId;
  completionTone: CompletionToneId;
  fcmTone?: FcmToneId;
}

export type ChargingRobotPhase = 'docked' | 'dispatching' | 'charging' | 'returning';
export type EvacRobotPhase = 'patrol' | 'escorting' | 'suppression' | 'standby';

export interface ChargingRobotState {
  id: string;
  name: string;
  phase: ChargingRobotPhase;
  batteryPct: number;
  targetSpotId: string | null;
  targetPlate?: string;
  powerKw: number;
  deliveredKwh: number;
}

export interface EvacRobotState {
  id: string;
  name: string;
  phase: EvacRobotPhase;
  batteryPct: number;
  targetZone: string;
  laserGuideActive: boolean;
  sirenBeaconActive: boolean;
  evacuatedCount: number;
}

export interface FleetPermit {
  id: string;
  plateNumber: string;
  companyOrOwner: string;
  vehicleType: VehicleType;
  tier: 'CORPORATE_FLEET' | 'VIP_EXECUTIVE' | 'MONTHLY_GREEN';
  autoGateEnabled: boolean;
  validUntil: string;
  active: boolean;
}

export interface MaintenanceWorkOrder {
  id: string;
  bayId: string;
  issueAr: string;
  issueEn: string;
  priority: 'critical' | 'high' | 'routine';
  assignee: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  autoDetected: boolean;
}

export interface EmergencyDrillRun {
  id: string;
  scenarioAr: string;
  scenarioEn: string;
  startedAtMs: number;
  durationSec: number;
  grade: 'A+' | 'A' | 'B';
  completedAt: string;
}

export interface ProjectSettings {
  projectNameAr: string;
  projectNameEn: string;
  teamNameAr: string;
  teamNameEn: string;
  instituteNameAr: string;
  instituteNameEn: string;
  projectCode: string;
  supervisorName: string;
  autoExpandWhenFull: boolean;
  strictSingleCarPerBay: boolean;
  accentTheme: 'emerald' | 'cyan' | 'amber';
  autoLoadBalance: boolean;
  gateKioskMode: boolean;
  carbonMultiplier: 1 | 1.5 | 2;
  thermalGuardLimitC: number;
  smartNightModeEnabled: boolean;
  smartNightForceActive: boolean;
  nightStartHour: number;
  nightEndHour: number;
  nightPowerReductionPct: number;
}

export interface EcoToggleEvent {
  id: string;
  hourIndex: number;
  hourLabel: string;
  timestamp: string;
  enabled: boolean;
  bessAtToggle: number;
}

export interface AnprScanRecord {
  id: string;
  plateNumber: string;
  timestamp: string;
  assignedBayId: string;
  assignedBayLabel: string;
  vehicleType: VehicleType;
  scanSource: 'anpr_camera' | 'qr_pass' | 'manual_gate';
  confidence: number;
  ticketCode?: string;
}

export type ChargerMaintenanceStatus = 'operational' | 'calibrating' | 'service_required';

export interface ChargerEfficiencyRatingEntry {
  id: string;
  bayId: string;
  bayLabel: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string;
  ratedAt: string;
  ratedBy: string;
  userId?: string;
}

export interface ChargerManualMaintenanceRecord {
  bayId: string;
  status: ChargerMaintenanceStatus;
  manualNote: string;
  expectedNextDate: string;
  calibrationStartedAt?: string;
  updatedAt: string;
  updatedBy: string;
  latestEfficiencyRating?: 1 | 2 | 3 | 4 | 5;
  efficiencyRatingsLog?: ChargerEfficiencyRatingEntry[];
}

export interface RobotChargingSessionLog {
  id: string;
  robotId: string;
  robotName: string;
  bayId: string;
  bayLabel: string;
  vehiclePlate: string;
  energyDeliveredKwh: number;
  energyConsumedKwh: number;
  efficiencyPct: number;
  powerKw: number;
  durationMinutes: number;
  startedAt: string;
  completedAt: string;
  supervisorVerified: boolean;
  userId?: string;
}

export interface AdminWastePolicy {
  paperlessQrOnly: boolean;
  autoApproveVerifiedFleets: boolean;
  consolidateDuplicateTickets: boolean;
  autoDigitalIsoArchive: boolean;
}

export interface SolarCleanCycleLog {
  id: string;
  triggeredBy: string;
  dustBeforePct: number;
  dustAfterPct: number;
  recoveredKw: number;
  waterSavedLiters: number;
  windKmh: number;
  completedAt: string;
}

export interface ShiftHandoverRecord {
  id: string;
  outgoingSupervisor: string;
  outgoingRole: UserRole;
  incomingSupervisor: string;
  incomingRole: UserRole;
  bessChargePct: number;
  solarKw: number;
  openWorkOrdersCount: number;
  occupiedBaysCount: number;
  robotKwhDelivered: number;
  checklistBessVerified: boolean;
  checklistAnprClean: boolean;
  checklistExitsClear: boolean;
  handoverNotes: string;
  signedAt: string;
  userId?: string;
}

export interface OfflineGateQueueItem {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  color: string;
  confidence: number;
  scanSource: 'anpr_camera' | 'qr_pass' | 'manual_gate';
  ticketCode?: string;
  queuedAt: string;
}

export interface GridFaultDrillLog {
  id: string;
  scenarioId: 'pv_inverter_trip' | 'grid_blackout_island' | 'transformer_overheat';
  scenarioAr: string;
  scenarioEn: string;
  failoverMs: number;
  islandRuntimeHours: number;
  restoredAt: string;
  grade: 'A+' | 'A';
}

export interface ActiveMergedTourState {
  cityId: string;
  cityAr: string;
  cityEn: string;
  branchName: string;
  totalKm: number;
  co2SavedKg: number;
  batteryEndPct: number;
  stopsCount: number;
  evStopsCount: number;
}

export interface ActiveMergedEventState {
  id: string;
  titleAr: string;
  titleEn: string;
  branch: string;
  capacity: number;
  predictedAttendance: number;
  predictedVehicles: number;
  targetBaysNeeded: number;
  energySavedKwh: number;
  waterSavedL: number;
  wasteReductionPct: number;
  eventWindow?: string;
  prepared: boolean;
}
