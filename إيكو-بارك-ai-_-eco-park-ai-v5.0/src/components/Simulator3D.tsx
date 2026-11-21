import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  Moon,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Sun,
  Sunset,
  ThermometerSun,
  TreePine,
  Zap,
} from 'lucide-react';
import {
  CameraMode3D,
  Language,
  LightingMode3D,
  ParkingSpot,
  VehicleType,
} from '../types/parking';
import { t } from '../data/i18n';
import { VEHICLE_SPECS, playHydraulicGateSound } from '../utils/ecoEngine';

interface Simulator3DProps {
  lang: Language;
  spots: ParkingSpot[];
  bessCharge: number;
  ecoConservation: boolean;
  smartNightActive?: boolean;
  nightPowerReductionPct?: number;
  lightingMode: LightingMode3D;
  onChangeLightingMode: (mode: LightingMode3D) => void;
  onToggleSmartNight?: () => void;
  onParkVehicle: (spotId: string, vehicleType: VehicleType, plate: string) => void;
  onAddSpot: () => ParkingSpot;
}

const CAMERA_PRESETS: Record<
  CameraMode3D,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  orbit: { pos: [24, 17, 25], target: [0, 1, 0] },
  drone: { pos: [0, 34, 2], target: [0, 0, 0] },
  bess: { pos: [-11, 7, 11], target: [-18, 2.2, 0] },
  gate: { pos: [26, 6, 12], target: [16, 1.5, 0] },
  driver: { pos: [17, 2.2, 0], target: [-4, 1.2, 0] },
};

function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b242d';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 22 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v + 5},${v + 10})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSolarPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#091f3a';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createThermalHeatmapTexture(
  spots: ParkingSpot[],
  lotMinX: number,
  lotWidth: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 256);

  const occupiedRatio =
    spots.filter((s) => s.status !== 'available').length / Math.max(spots.length, 1);

  // Shaded zones under solar canopies
  const canopyAlpha = 0.24 + occupiedRatio * 0.16;
  const topCool = ctx.createLinearGradient(0, 0, 0, 96);
  topCool.addColorStop(0, `rgba(6, 182, 212, ${canopyAlpha})`);
  topCool.addColorStop(
    1,
    occupiedRatio > 0.7 ? `rgba(245, 158, 11, ${canopyAlpha})` : `rgba(16, 185, 129, ${canopyAlpha})`
  );
  ctx.fillStyle = topCool;
  ctx.fillRect(16, 14, 480, 80);

  const botCool = ctx.createLinearGradient(0, 160, 0, 245);
  botCool.addColorStop(
    0,
    occupiedRatio > 0.7 ? `rgba(245, 158, 11, ${canopyAlpha})` : `rgba(16, 185, 129, ${canopyAlpha})`
  );
  botCool.addColorStop(1, `rgba(6, 182, 212, ${canopyAlpha})`);
  ctx.fillStyle = botCool;
  ctx.fillRect(16, 162, 480, 80);

  // Exposed central lane heat proportional to occupancy
  const laneAlpha = 0.20 + occupiedRatio * 0.34;
  const laneWarm = ctx.createLinearGradient(16, 98, 496, 158);
  laneWarm.addColorStop(0, `rgba(245, 158, 11, ${laneAlpha})`);
  laneWarm.addColorStop(0.5, `rgba(239, 68, 68, ${laneAlpha + 0.08})`);
  laneWarm.addColorStop(1, `rgba(245, 158, 11, ${laneAlpha})`);
  ctx.fillStyle = laneWarm;
  ctx.fillRect(16, 98, 480, 60);

  // Dynamic per-bay thermal plumes
  spots.forEach((spot) => {
    if (spot.status === 'available') return;
    const u = (spot.x3d - lotMinX) / Math.max(lotWidth, 1);
    const v = (spot.z3d + 13) / 26;
    const cx = u * 512;
    const cy = v * 256;
    const isIce = spot.vehicleType === 'GASOLINE' || spot.vehicleType === 'DIESEL';
    const isHybrid = spot.vehicleType === 'HYBRID';
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 50);
    if (isIce) {
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
      grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.46)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    } else if (isHybrid) {
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.60)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    } else {
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.54)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCompositeCar(bodyColor: number, isElectric: boolean): THREE.Group {
  const car = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.72,
    roughness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1522,
    metalness: 0.2,
    roughness: 0.08,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.9,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 1.75), paintMat);
  chassis.position.y = 0.52;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  car.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.55, 1.48), glassMat);
  cabin.position.set(-0.15, 1.08, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.4), paintMat);
  roof.position.set(-0.18, 1.38, 0);
  car.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 12);
  const wheelCoords: [number, number][] = [
    [1.15, 0.88],
    [1.15, -0.88],
    [-1.15, 0.88],
    [-1.15, -0.88],
  ];
  wheelCoords.forEach(([wx, wz]) => {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, 0.32, wz);
    tire.castShadow = true;
    car.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, 0.32, wz);
    car.add(rim);
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.3,
  });
  [-0.58, 0.58].forEach((zOff) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.28), headMat);
    hl.position.set(1.9, 0.56, zOff);
    car.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.28), tailMat);
    tl.position.set(-1.9, 0.56, zOff);
    car.add(tl);
  });

  if (isElectric) {
    const glowBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.06, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 2,
      })
    );
    glowBar.position.set(1.91, 0.42, 0);
    car.add(glowBar);
  }

  return car;
}

function buildPalmTree(): THREE.Group {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 - i * 0.02, 0.26 - i * 0.02, 1.0, 8),
      trunkMat
    );
    seg.position.set(i * 0.08, 0.5 + i * 0.95, 0);
    seg.rotation.z = -0.05 * i;
    seg.castShadow = true;
    palm.add(seg);
  }

  const crown = new THREE.Group();
  crown.position.set(0.32, 5.1, 0);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 5), frondMat);
    frond.rotation.z = Math.PI / 2.6;
    frond.rotation.y = (i / 7) * Math.PI * 2;
    frond.position.x = Math.cos((i / 7) * Math.PI * 2) * 0.9;
    frond.position.z = Math.sin((i / 7) * Math.PI * 2) * 0.9;
    frond.castShadow = true;
    crown.add(frond);
  }
  palm.add(crown);
  return palm;
}

function buildEcoBioswalePlanter(lengthX: number): THREE.Group {
  const bioswale = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78, metalness: 0.15 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.95 });
  const shrubMatA = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.82 });
  const shrubMatB = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.88 });
  const dripMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });

  // 1. Primary silhouette: Planter stone curb box
  const curb = new THREE.Mesh(new THREE.BoxGeometry(lengthX, 0.38, 1.35), frameMat);
  curb.position.y = 0.19;
  curb.receiveShadow = true;
  curb.castShadow = true;
  bioswale.add(curb);

  // 2. Organic mulch/soil bed
  const soil = new THREE.Mesh(new THREE.BoxGeometry(lengthX - 0.3, 0.08, 1.05), soilMat);
  soil.position.y = 0.39;
  bioswale.add(soil);

  // 3. Multi-clustered foliage shrubs along planter length
  const clusterCount = Math.max(4, Math.floor(lengthX / 2.2));
  for (let i = 0; i < clusterCount; i++) {
    const cx = -lengthX / 2 + 1.1 + i * ((lengthX - 2.2) / Math.max(1, clusterCount - 1));
    const bushMain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.48 + (i % 2) * 0.1, 1),
      i % 2 === 0 ? shrubMatA : shrubMatB
    );
    bushMain.position.set(cx, 0.72, 0);
    bushMain.scale.set(1.15, 0.85, 0.95);
    bushMain.castShadow = true;
    bioswale.add(bushMain);

    // 4. Solar drip-irrigation moisture emitter accent
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), dripMat);
    emitter.position.set(cx + 0.55, 0.48, 0.36);
    bioswale.add(emitter);
  }

  return bioswale;
}

function buildLivingGreenWall(width: number, height: number): THREE.Group {
  const wall = new THREE.Group();
  const trellisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 });
  const backingMossMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.92 });
  const fernLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 });
  const headerPipeMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.5, roughness: 0.3 });

  // 1. Aluminum trellis frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, height, width), trellisMat);
  frame.position.y = height / 2;
  frame.castShadow = true;
  wall.add(frame);

  // 2. Living moss substrate panels
  const mossBed = new THREE.Mesh(new THREE.BoxGeometry(0.32, height - 0.35, width - 0.35), backingMossMat);
  mossBed.position.y = height / 2;
  wall.add(mossBed);

  // 3. Textured foliage relief modules across face
  const cols = Math.max(3, Math.floor(width / 1.4));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      const zOff = -width / 2 + 0.8 + c * ((width - 1.6) / Math.max(1, cols - 1));
      const yOff = 1.0 + r * 1.1;
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), fernLeafMat);
      tuft.position.set(0.18, yOff, zOff);
      tuft.scale.set(0.55, 1.0, 1.1);
      wall.add(tuft);
    }
  }

  // 4. Overhead misting irrigation bar
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, width, 10), headerPipeMat);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.16, height + 0.08, 0);
  wall.add(pipe);

  return wall;
}

export const Simulator3D: React.FC<Simulator3DProps> = ({
  lang,
  spots,
  bessCharge,
  ecoConservation,
  smartNightActive = false,
  nightPowerReductionPct = 40,
  lightingMode,
  onChangeLightingMode,
  onToggleSmartNight,
  onParkVehicle,
  onAddSpot,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode3D>('orbit');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showThermal3D, setShowThermal3D] = useState(false);
  const [showGreenEnv3D, setShowGreenEnv3D] = useState(true);
  const [autoExpand3D, setAutoExpand3D] = useState(true);
  const [dispatchVehicleType, setDispatchVehicleType] = useState<VehicleType>('ELECTRIC');
  const [lastExpandedLabel, setLastExpandedLabel] = useState<string | null>(null);
  const [autoOrbit, setAutoOrbit] = useState(false);

  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const bessRef = useRef(bessCharge);
  bessRef.current = bessCharge;
  const ecoRef = useRef(ecoConservation);
  ecoRef.current = ecoConservation;
  const smartNightRef = useRef(smartNightActive);
  smartNightRef.current = smartNightActive;
  const nightReductionRef = useRef(nightPowerReductionPct);
  nightReductionRef.current = nightPowerReductionPct;
  const lightingRef = useRef(lightingMode);
  lightingRef.current = lightingMode;
  const thermalRef = useRef(showThermal3D);
  thermalRef.current = showThermal3D;
  const greenEnvRef = useRef(showGreenEnv3D);
  greenEnvRef.current = showGreenEnv3D;
  const autoOrbitRef = useRef(autoOrbit);
  autoOrbitRef.current = autoOrbit;
  const cameraModeRef = useRef<CameraMode3D>(cameraMode);
  const cameraAnimatingRef = useRef(false);

  const spawnQueueRef = useRef<{ vehicleType: VehicleType; spot: ParkingSpot; plate: string } | null>(null);
  const expandedBeaconRef = useRef<{ x3d: number; z3d: number; expiresAt: number } | null>(null);
  const prevAvailableRef = useRef<number>(spots.filter((s) => s.status === 'available').length);

  const availableCount = spots.filter((s) => s.status === 'available').length;
  const occupiedPct = Math.round(((spots.length - availableCount) / Math.max(spots.length, 1)) * 100);

  // Automatic Dynamic Bay Expansion Algorithm in 3D when lot hits 100% saturation
  useEffect(() => {
    const prevAvail = prevAvailableRef.current;
    prevAvailableRef.current = availableCount;

    if (autoExpand3D && availableCount === 0 && prevAvail > 0 && spots.length < 24) {
      const created = onAddSpot();
      setLastExpandedLabel(created.label);
      expandedBeaconRef.current = {
        x3d: created.x3d,
        z3d: created.z3d,
        expiresAt: performance.now() + 5000,
      };
    }
  }, [availableCount, autoExpand3D, onAddSpot, spots.length]);

  const handleSelectCamera = (mode: CameraMode3D) => {
    setCameraMode(mode);
    cameraModeRef.current = mode;
    cameraAnimatingRef.current = true;
  };

  const handleManualAddBay3D = () => {
    const created = onAddSpot();
    setLastExpandedLabel(created.label);
    expandedBeaconRef.current = {
      x3d: created.x3d,
      z3d: created.z3d,
      expiresAt: performance.now() + 5000,
    };
  };

  const handleSpawn3DCar = (vehicleType: VehicleType) => {
    const avail = spotsRef.current.filter((s) => s.status === 'available');
    let target =
      (vehicleType === 'ELECTRIC' ? avail.find((s) => s.hasCharger) : avail[0]) || avail[0];
    if (!target) {
      target = onAddSpot();
      setLastExpandedLabel(target.label);
      expandedBeaconRef.current = {
        x3d: target.x3d,
        z3d: target.z3d,
        expiresAt: performance.now() + 5000,
      };
    }
    const plate = `ط ي ع ${Math.floor(1000 + Math.random() * 8999)}`;
    spawnQueueRef.current = { vehicleType, spot: target, plate };
    playHydraulicGateSound();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1929);
    scene.fog = new THREE.FogExp2(0x0b1929, 0.012);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 240);
    camera.position.set(...CAMERA_PRESETS.orbit.pos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 6;
    controls.maxDistance = 95;
    controls.target.set(...CAMERA_PRESETS.orbit.target);
    controls.addEventListener('start', () => {
      cameraAnimatingRef.current = false;
    });

    // Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.75);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sunLight.position.set(22, 32, 18);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.left = -45;
    sunLight.shadow.camera.right = 45;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const asphaltTex = createAsphaltTexture();
    asphaltTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const solarTex = createSolarPanelTexture();
    solarTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: 0x0d1b26, roughness: 0.95 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.05;
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    const curbMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.88,
      metalness: 0.05,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.25,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const wheelStopMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const pvMat = new THREE.MeshPhysicalMaterial({
      map: solarTex,
      metalness: 0.4,
      roughness: 0.18,
      clearcoat: 0.9,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    // Dynamic Lot Structure (Asphalt Deck, Curbs, Canopies, Bays, Status LEDs, Perimeter)
    const dynamicLotGroup = new THREE.Group();
    scene.add(dynamicLotGroup);

    // Holographic Expansion Beacon Group (Highlights newly added 3D bay)
    const expansionBeaconGroup = new THREE.Group();
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.55, 32), beaconRingMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.06;
    expansionBeaconGroup.add(beaconRing);

    const beaconFrameMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const beaconFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 4.8), beaconFrameMat);
    beaconFrame.position.y = 1.1;
    expansionBeaconGroup.add(beaconFrame);
    expansionBeaconGroup.visible = false;
    scene.add(expansionBeaconGroup);

    // Thermal Heatmap Overlay Group
    const thermalGroup = new THREE.Group();
    scene.add(thermalGroup);
    let thermalOverlayMesh: THREE.Mesh | null = null;
    let thermalTex: THREE.CanvasTexture | null = null;

    // Gate reference that shifts cleanly if bays expand past x = 12
    const gateGroup = new THREE.Group();
    const gateKiosk = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.5, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 })
    );
    gateKiosk.position.set(0, 0.75, 2.8);
    gateKiosk.castShadow = true;
    gateGroup.add(gateKiosk);

    const anprMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), steelMat);
    anprMast.position.set(0, 1.7, 2.8);
    gateGroup.add(anprMast);

    const anprCam = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.8 })
    );
    anprCam.position.set(-0.2, 3.3, 2.6);
    gateGroup.add(anprCam);

    const barrierPivot = new THREE.Group();
    barrierPivot.position.set(0, 1.15, 2.2);
    const barrierArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 4.6),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.4 })
    );
    barrierArm.position.set(0, 0, -2.2);
    barrierArm.castShadow = true;
    barrierPivot.add(barrierArm);
    gateGroup.add(barrierPivot);
    scene.add(gateGroup);

    const streetSpotLights: THREE.PointLight[] = [];
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.2,
    });

    const getLotBounds = (list: ParkingSpot[]) => {
      const maxSpotX = list.reduce((m, s) => Math.max(m, s.x3d), 12);
      const lotMinX = -21;
      const lotMaxX = Math.max(21, maxSpotX + 9);
      const lotWidth = lotMaxX - lotMinX;
      const lotCenterX = (lotMinX + lotMaxX) / 2;
      const gateX = Math.max(17.5, maxSpotX + 5.5);
      return { lotMinX, lotMaxX, lotWidth, lotCenterX, gateX, maxSpotX };
    };

    const rebuildDynamicLot = () => {
      dynamicLotGroup.clear();
      streetSpotLights.length = 0;

      const { lotWidth, lotCenterX, gateX, maxSpotX } = getLotBounds(spotsRef.current);
      gateGroup.position.set(gateX, 0, 0);

      // Asphalt Deck
      const lotDeck = new THREE.Mesh(new THREE.BoxGeometry(lotWidth, 0.15, 26), asphaltMat);
      lotDeck.position.set(lotCenterX, -0.075, 0);
      lotDeck.receiveShadow = true;
      dynamicLotGroup.add(lotDeck);

      // Concrete Sidewalks
      [-11.5, 11.5].forEach((zPos) => {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(lotWidth - 2, 0.24, 2.4), curbMat);
        curb.position.set(lotCenterX, 0.12, zPos);
        curb.receiveShadow = true;
        curb.castShadow = true;
        dynamicLotGroup.add(curb);
      });

      // Pedestrian Crosswalk near Gate
      for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(gateX - 2.7, 0.015, i * 0.9);
        dynamicLotGroup.add(stripe);
      }

      // Parking Bay Lines, Wheel Stops, Overhead Status LED, EV Chargers
      spotsRef.current.forEach((spot) => {
        const lLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.8), lineMat);
        lLeft.rotation.x = -Math.PI / 2;
        lLeft.position.set(spot.x3d - 2.2, 0.02, spot.z3d);
        dynamicLotGroup.add(lLeft);

        const lRight = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.8), lineMat);
        lRight.rotation.x = -Math.PI / 2;
        lRight.position.set(spot.x3d + 2.2, 0.02, spot.z3d);
        dynamicLotGroup.add(lRight);

        const stop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.24), wheelStopMat);
        stop.position.set(spot.x3d, 0.08, spot.z3d + (spot.row === 'top' ? -1.9 : 1.9));
        stop.castShadow = true;
        dynamicLotGroup.add(stop);

        // Bay Status Indicator Beacon mounted under canopy edge
        const statusColor =
          spot.status === 'available'
            ? 0x10b981
            : spot.status === 'reserved'
              ? 0xf59e0b
              : 0xef4444;
        const ledOrb = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 12),
          new THREE.MeshStandardMaterial({
            color: statusColor,
            emissive: statusColor,
            emissiveIntensity: 2.2,
          })
        );
        ledOrb.position.set(spot.x3d, 4.1, spot.z3d + (spot.row === 'top' ? 2.4 : -2.4));
        dynamicLotGroup.add(ledOrb);

        if (spot.hasCharger) {
          const charger = new THREE.Group();
          charger.position.set(spot.x3d, 0, spot.z3d + (spot.row === 'top' ? -2.9 : 2.9));
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 1.75, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
          );
          body.position.y = 0.875;
          body.castShadow = true;
          charger.add(body);

          const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.45, 0.44),
            new THREE.MeshStandardMaterial({
              color: 0x06b6d4,
              emissive: 0x06b6d4,
              emissiveIntensity: 1.5,
            })
          );
          screen.position.y = 1.3;
          charger.add(screen);
          dynamicLotGroup.add(charger);
        }
      });

      // Expandable Solar Canopies
      const canopySpan = Math.max(30, maxSpotX + 18);
      const canopyCenterX = (-15 + (maxSpotX + 3)) / 2;
      [-7, 7].forEach((rowZ) => {
        const canopyGroup = new THREE.Group();
        const pillarPositions = [-12, 0, 12];
        if (maxSpotX > 12) {
          for (let px = 18; px <= maxSpotX + 4; px += 12) {
            pillarPositions.push(px);
          }
        }
        pillarPositions.forEach((px) => {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.4, 12), steelMat);
          pillar.position.set(px, 2.2, rowZ + (rowZ < 0 ? -2.6 : 2.6));
          pillar.castShadow = true;
          canopyGroup.add(pillar);
        });

        const roof = new THREE.Mesh(new THREE.BoxGeometry(canopySpan, 0.16, 6.2), pvMat);
        roof.position.set(canopyCenterX, 4.5, rowZ);
        roof.rotation.x = rowZ < 0 ? 0.14 : -0.14;
        roof.castShadow = true;
        roof.receiveShadow = true;
        canopyGroup.add(roof);
        dynamicLotGroup.add(canopyGroup);
      });

      // Dynamic Palm Trees & Biophilic Green Sustainable Environment scaled to expanded perimeter
      const palmCoords: [number, number][] = [
        [-17, -11.5],
        [-6, -11.5],
        [6, -11.5],
        [gateX - 0.5, -11.5],
        [-17, 11.5],
        [gateX - 0.5, 11.5],
      ];
      palmCoords.forEach(([px, pz]) => {
        const palm = buildPalmTree();
        palm.position.set(px, 0.24, pz);
        dynamicLotGroup.add(palm);
      });

      if (greenEnvRef.current) {
        [-12.9, 12.9].forEach((zPos) => {
          const bioswale = buildEcoBioswalePlanter(Math.max(24, lotWidth - 6));
          bioswale.position.set(lotCenterX, 0, zPos);
          dynamicLotGroup.add(bioswale);
        });

        const livingWall = buildLivingGreenWall(8.5, 3.2);
        livingWall.position.set(-20.4, 0, -5.8);
        dynamicLotGroup.add(livingWall);

        const livingWallSouth = buildLivingGreenWall(8.5, 3.2);
        livingWallSouth.position.set(-20.4, 0, 5.8);
        dynamicLotGroup.add(livingWallSouth);
      }

      // Dynamic Street Lamps along expanded bottom sidewalk
      const lampXs = [-10, 0, 10];
      if (maxSpotX > 12) {
        lampXs.push(maxSpotX + 2);
      }
      lampXs.forEach((lx) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 8), steelMat);
        pole.position.set(lx, 3.1, 11.5);
        dynamicLotGroup.add(pole);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.4), lampMat);
        bulb.position.set(lx, 6.1, 10.9);
        dynamicLotGroup.add(bulb);

        const pLight = new THREE.PointLight(0xfde68a, 0, 18);
        pLight.position.set(lx, 5.8, 10.5);
        dynamicLotGroup.add(pLight);
        streetSpotLights.push(pLight);
      });
    };

    const syncThermalOverlay = () => {
      thermalGroup.clear();
      if (thermalTex) {
        thermalTex.dispose();
        thermalTex = null;
      }
      if (!thermalRef.current) return;

      const { lotMinX, lotWidth, lotCenterX } = getLotBounds(spotsRef.current);
      thermalTex = createThermalHeatmapTexture(spotsRef.current, lotMinX, lotWidth);
      const mat = new THREE.MeshBasicMaterial({
        map: thermalTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      thermalOverlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(lotWidth, 26), mat);
      thermalOverlayMesh.rotation.x = -Math.PI / 2;
      thermalOverlayMesh.position.set(lotCenterX, 0.032, 0);
      thermalGroup.add(thermalOverlayMesh);

      spotsRef.current.forEach((spot) => {
        if (spot.status === 'available') return;
        const isIce = spot.vehicleType === 'GASOLINE' || spot.vehicleType === 'DIESEL';
        const ringColor = isIce ? 0xef4444 : spot.vehicleType === 'HYBRID' ? 0xf59e0b : 0x06b6d4;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.75, 2.25, 28),
          new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(spot.x3d, 0.045, spot.z3d);
        thermalGroup.add(ring);
      });
    };

    rebuildDynamicLot();

    // BESS Industrial Battery Station (Left side x = -18)
    const bessGroup = new THREE.Group();
    bessGroup.position.set(-18, 0, 0);

    const bessHousing = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.8, 7.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 })
    );
    bessHousing.position.y = 1.4;
    bessHousing.castShadow = true;
    bessHousing.receiveShadow = true;
    bessGroup.add(bessHousing);

    const bessLedMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
    });
    const bessLedStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 6.2), bessLedMat);
    bessLedStrip.position.set(1.62, 2.1, 0);
    bessGroup.add(bessLedStrip);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0,
    });
    const beaconDome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), beaconMat);
    beaconDome.position.set(0, 3.0, 0);
    bessGroup.add(beaconDome);

    const beaconLight = new THREE.PointLight(0xef4444, 0, 18);
    beaconLight.position.set(-18, 3.5, 0);
    scene.add(beaconLight);
    scene.add(bessGroup);

    // Static Parked Cars Container
    const parkedCarsGroup = new THREE.Group();
    scene.add(parkedCarsGroup);

    const syncParkedCars = () => {
      parkedCarsGroup.clear();
      spotsRef.current.forEach((spot) => {
        if (spot.status === 'occupied' || spot.status === 'reserved') {
          const hex =
            spot.status === 'reserved'
              ? 0xf59e0b
              : spot.vehicleType === 'ELECTRIC'
                ? 0x06b6d4
                : spot.vehicleType === 'HYBRID'
                  ? 0x10b981
                  : 0xef4444;
          const car = buildCompositeCar(hex, spot.vehicleType === 'ELECTRIC');
          car.position.set(spot.x3d, 0, spot.z3d);
          car.rotation.y = spot.row === 'top' ? Math.PI / 2 : -Math.PI / 2;
          parkedCarsGroup.add(car);
        }
      });
    };
    syncParkedCars();

    let movingCar: {
      mesh: THREE.Group;
      spot: ParkingSpot;
      vehicleType: VehicleType;
      plate: string;
      phase: 'entering' | 'lane' | 'parking';
    } | null = null;
    let gateTargetAngle = 0;

    const clock = new THREE.Clock();
    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    let frameId = 0;
    let lastSpotSignature = '';
    let lastSpotCount = spotsRef.current.length;
    let lastThermalState = thermalRef.current;
    let lastGreenEnvState = greenEnvRef.current;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const sig = spotsRef.current.map((s) => `${s.id}:${s.status}:${s.vehicleType || ''}`).join('|');
      if (
        spotsRef.current.length !== lastSpotCount ||
        sig !== lastSpotSignature ||
        thermalRef.current !== lastThermalState ||
        greenEnvRef.current !== lastGreenEnvState
      ) {
        lastSpotCount = spotsRef.current.length;
        lastSpotSignature = sig;
        lastThermalState = thermalRef.current;
        lastGreenEnvState = greenEnvRef.current;
        rebuildDynamicLot();
        syncParkedCars();
        syncThermalOverlay();
      }

      // Holographic Construction Indicator for Newly Expanded Bay
      const exp = expandedBeaconRef.current;
      if (exp && performance.now() < exp.expiresAt) {
        expansionBeaconGroup.visible = true;
        expansionBeaconGroup.position.set(exp.x3d, 0, exp.z3d);
        const pulse = 1 + Math.sin(elapsed * 8) * 0.08;
        beaconRing.scale.set(pulse, pulse, 1);
        beaconFrame.rotation.y += dt * 1.2;
      } else {
        expansionBeaconGroup.visible = false;
      }

      // Check spawned car queue
      if (spawnQueueRef.current && !movingCar) {
        const q = spawnQueueRef.current;
        spawnQueueRef.current = null;
        const { gateX } = getLotBounds(spotsRef.current);
        const hex = parseInt(VEHICLE_SPECS[q.vehicleType].carColorHex.replace('#', ''), 16);
        const mesh = buildCompositeCar(hex, q.vehicleType === 'ELECTRIC');
        mesh.position.set(gateX + 6.5, 0, 0);
        mesh.rotation.y = Math.PI;
        scene.add(mesh);
        movingCar = {
          mesh,
          spot: q.spot,
          vehicleType: q.vehicleType,
          plate: q.plate,
          phase: 'entering',
        };
        gateTargetAngle = Math.PI / 2.2;
      }

      // Move animated car
      if (movingCar) {
        const speed = 7.5 * dt;
        const pos = movingCar.mesh.position;
        const { gateX } = getLotBounds(spotsRef.current);
        if (movingCar.phase === 'entering') {
          pos.x -= speed;
          if (pos.x <= gateX - 2.5) {
            movingCar.phase = 'lane';
            gateTargetAngle = 0;
          }
        } else if (movingCar.phase === 'lane') {
          const dx = movingCar.spot.x3d - pos.x;
          if (Math.abs(dx) <= speed) {
            pos.x = movingCar.spot.x3d;
            movingCar.phase = 'parking';
            movingCar.mesh.rotation.y = movingCar.spot.row === 'top' ? Math.PI / 2 : -Math.PI / 2;
          } else {
            pos.x += Math.sign(dx) * speed;
            movingCar.mesh.rotation.y = dx < 0 ? Math.PI : 0;
          }
        } else if (movingCar.phase === 'parking') {
          const dz = movingCar.spot.z3d - pos.z;
          if (Math.abs(dz) <= speed) {
            pos.z = movingCar.spot.z3d;
            const done = movingCar;
            scene.remove(done.mesh);
            movingCar = null;
            onParkVehicle(done.spot.id, done.vehicleType, done.plate);
          } else {
            pos.z += Math.sign(dz) * speed;
          }
        }
      }

      barrierPivot.rotation.x = THREE.MathUtils.damp(barrierPivot.rotation.x, gateTargetAngle, 6, dt);

      // Update BESS LED & Strobe Alarm Beacon
      const charge = bessRef.current;
      if (charge < 20) {
        bessLedMat.color.setHex(0xef4444);
        bessLedMat.emissive.setHex(0xef4444);
        const strobe = Math.sin(elapsed * 12) > 0 ? 3.5 : 0.1;
        beaconMat.emissiveIntensity = strobe;
        beaconLight.intensity = strobe * 2.5;
      } else if (charge < 45) {
        bessLedMat.color.setHex(0xf59e0b);
        bessLedMat.emissive.setHex(0xf59e0b);
        beaconMat.emissiveIntensity = 0;
        beaconLight.intensity = 0;
      } else {
        bessLedMat.color.setHex(0x10b981);
        bessLedMat.emissive.setHex(0x10b981);
        beaconMat.emissiveIntensity = 0;
        beaconLight.intensity = 0;
      }

      // Lighting Mode & Smart Eye-Comfort Night Mode
      const mode = lightingRef.current;
      const dimFactor = ecoRef.current ? 0.55 : 1.0;
      if (smartNightRef.current) {
        const nightDim = Math.max(0.35, 1 - nightReductionRef.current / 100);
        (scene.background as THREE.Color).setHex(0x0c1322);
        (scene.fog as THREE.FogExp2).color.setHex(0x0c1322);
        renderer.toneMappingExposure = 0.84;
        sunLight.color.setHex(0x93b4e6);
        sunLight.intensity = 0.48;
        sunLight.position.set(-14, 24, -14);
        hemiLight.color.setHex(0x64748b);
        hemiLight.groundColor.setHex(0x0f172a);
        hemiLight.intensity = 0.44;
        lineMat.color.setHex(0x34d399);
        lineMat.emissive.setHex(0x065f46);
        lineMat.emissiveIntensity = 0.12;
        lampMat.color.setHex(0xfbbf24);
        lampMat.emissive.setHex(0xd97706);
        lampMat.emissiveIntensity = 1.35 * nightDim;
        streetSpotLights.forEach((l) => {
          l.color.setHex(0xfcd34d);
          l.intensity = 5.2 * nightDim * dimFactor;
        });
      } else {
        renderer.toneMappingExposure = 1.1;
        hemiLight.color.setHex(0xbae6fd);
        hemiLight.groundColor.setHex(0x1e293b);
        lineMat.color.setHex(0x10b981);
        lineMat.emissive.setHex(0x059669);
        lineMat.emissiveIntensity = 0.25;
        lampMat.color.setHex(0xfef08a);
        lampMat.emissive.setHex(0xfef08a);
        streetSpotLights.forEach((l) => l.color.setHex(0xfde68a));

        if (mode === 'sunny') {
          (scene.background as THREE.Color).setHex(0x0c2438);
          (scene.fog as THREE.FogExp2).color.setHex(0x0c2438);
          sunLight.color.setHex(0xfffbeb);
          sunLight.intensity = 1.9 * dimFactor;
          sunLight.position.set(22, 32, 18);
          hemiLight.intensity = 0.85 * dimFactor;
          lampMat.emissiveIntensity = 0.1;
          streetSpotLights.forEach((l) => (l.intensity = 0));
        } else if (mode === 'sunset') {
          (scene.background as THREE.Color).setHex(0x2c1a24);
          (scene.fog as THREE.FogExp2).color.setHex(0x2c1a24);
          sunLight.color.setHex(0xfb923c);
          sunLight.intensity = 1.5 * dimFactor;
          sunLight.position.set(-28, 12, 16);
          hemiLight.intensity = 0.65 * dimFactor;
          lampMat.emissiveIntensity = 0.8 * dimFactor;
          streetSpotLights.forEach((l) => (l.intensity = 2.5 * dimFactor));
        } else {
          (scene.background as THREE.Color).setHex(0x040914);
          (scene.fog as THREE.FogExp2).color.setHex(0x040914);
          sunLight.color.setHex(0x60a5fa);
          sunLight.intensity = 0.45;
          sunLight.position.set(-15, 24, -15);
          hemiLight.intensity = 0.35;
          lampMat.emissiveIntensity = 2.2 * dimFactor;
          streetSpotLights.forEach((l) => (l.intensity = 8.0 * dimFactor));
        }
      }

      if (cameraAnimatingRef.current) {
        const preset = CAMERA_PRESETS[cameraModeRef.current];
        const { maxSpotX } = getLotBounds(spotsRef.current);
        const expansionShift = Math.max(0, maxSpotX - 12);
        targetCamPos.set(
          preset.pos[0] + (cameraModeRef.current === 'gate' ? expansionShift : expansionShift * 0.4),
          preset.pos[1],
          preset.pos[2]
        );
        targetLookAt.set(
          preset.target[0] + (cameraModeRef.current === 'gate' ? expansionShift : expansionShift * 0.35),
          preset.target[1],
          preset.target[2]
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, 5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookAt.x, 5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookAt.y, 5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookAt.z, 5, dt);
        if (camera.position.distanceTo(targetCamPos) < 0.15) {
          cameraAnimatingRef.current = false;
        }
      }

      controls.autoRotate = autoOrbitRef.current && !cameraAnimatingRef.current;
      controls.autoRotateSpeed = 1.25;
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(animate);
      else frameId = requestAnimationFrame(animate);
    };

    if (isSoftwareGl) {
      animate();
    } else {
      renderer.compile(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (thermalTex) thermalTex.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, [onParkVehicle]);

  return (
    <div
      className={`relative h-[590px] w-full overflow-hidden rounded-xl border transition ${
        smartNightActive ? 'bg-[#0C1322]' : 'bg-[#040914]'
      } ${
        bessCharge < 20
          ? 'eco-siren-strobe border-red-500/70'
          : smartNightActive
            ? 'border-indigo-300/20'
            : 'border-white/10'
      }`}
    >
      {/* Dedicated Three.js Canvas Mount */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Minimal Top Corner Info Badge */}
      <div
        className={`pointer-events-none absolute top-4 start-4 z-10 rounded-lg border px-3.5 py-2.5 transition ${
          smartNightActive
            ? 'bg-[#10192D]/90 border-indigo-300/20'
            : 'bg-[#08121D]/90 border-white/10'
        } ${lastExpandedLabel ? 'eco-flash-glow border-emerald-400/50' : ''}`}
      >
        <div className={`text-xs font-semibold ${smartNightActive ? 'text-amber-200' : 'text-emerald-400'}`}>
          {t(lang, 'محرك المحاكاة ثلاثي الأبعاد PBR · التوسع الديناميكي', '3D PBR Engine · Dynamic Bay Expansion')}
        </div>
        <div className={`mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums ${smartNightActive ? 'text-slate-300/90' : 'text-slate-300'}`}>
          <span>BESS: {bessCharge}%</span>
          <span>·</span>
          <span>
            {t(lang, `المواقف: ${spots.length} (متاح ${availableCount})`, `Bays: ${spots.length} (${availableCount} free)`)}
          </span>
          <span>·</span>
          <span>{t(lang, `الإشغال: ${occupiedPct}%`, `Occ: ${occupiedPct}%`)}</span>
        </div>
        {smartNightActive && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-amber-200/90 tabular-nums">
            <Eye className="h-3 w-3 text-indigo-300" />
            {t(
              lang,
              `الوضع الليلي المريح للعين نشط · خفض الطاقة -${nightPowerReductionPct}%`,
              `Eye-Comfort Night Mode · Power -${nightPowerReductionPct}%`
            )}
          </div>
        )}
        {lastExpandedLabel && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-emerald-300">
            <Sparkles className="h-3 w-3" />
            {t(
              lang,
              `توسعة ذكية 3D: تم تشييد الموقف ${lastExpandedLabel} تلقائياً`,
              `Dynamic 3D Expansion: Bay ${lastExpandedLabel} built`
            )}
          </div>
        )}
        {showThermal3D && (
          <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-amber-300">
            <span>26°C {t(lang, 'تحت المظلات', 'Shaded')}</span>
            <span>→</span>
            <span className="text-red-400">48°C {t(lang, 'حرارة المحركات', 'ICE Heat')}</span>
          </div>
        )}
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div
        className={`absolute bottom-4 left-1/2 z-20 w-[min(1040px,96%)] -translate-x-1/2 transition-transform duration-200 ${
          dockCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center">
          <button
            onClick={() => setDockCollapsed((c) => !c)}
            className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-1 text-[11px] font-semibold transition ${
              smartNightActive
                ? 'border-indigo-300/20 bg-[#111A2E]/95 text-slate-200 hover:text-amber-200'
                : 'border-white/15 bg-[#0B1826]/95 text-slate-200 hover:text-emerald-400'
            }`}
          >
            {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {dockCollapsed ? t(lang, 'إظهار أدوات التحكم 3D', 'Show 3D Controls') : t(lang, 'إخفاء أدوات التحكم', 'Hide Controls')}
          </button>
        </div>

        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 shadow-2xl transition ${
            smartNightActive
              ? 'border-indigo-300/20 bg-[#111A2E]/95'
              : 'border-white/15 bg-[#0B1826]/95'
          }`}
        >
          {/* Camera Modes */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Camera className="me-1 h-4 w-4 text-emerald-400" />
            {(
              [
                { id: 'orbit', labelAr: 'مداري حر', labelEn: 'Free Orbit' },
                { id: 'drone', labelAr: 'درون علوي', labelEn: 'Top Drone' },
                { id: 'bess', labelAr: 'محطة BESS', labelEn: 'BESS View' },
                { id: 'gate', labelAr: 'البوابة', labelEn: 'Gate View' },
                { id: 'driver', labelAr: 'السائق', labelEn: 'Driver View' },
              ] as { id: CameraMode3D; labelAr: string; labelEn: string }[]
            ).map((cam) => (
              <button
                key={cam.id}
                onClick={() => handleSelectCamera(cam.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                  cameraMode === cam.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#12263A] text-slate-300 hover:bg-slate-800'
                }`}
              >
                {lang === 'ar' ? cam.labelAr : cam.labelEn}
              </button>
            ))}
            <button
              onClick={() => handleSelectCamera('orbit')}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#12263A] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              {t(lang, 'ضبط', 'Reset')}
            </button>
          </div>

          {/* Lighting, Thermal Heatmap, Auto-Expand & Dispatch */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'sunny', icon: Sun, labelAr: 'نهار', labelEn: 'Day' },
                { id: 'sunset', icon: Sunset, labelAr: 'غروب', labelEn: 'Sunset' },
                { id: 'night', icon: Moon, labelAr: 'ليل', labelEn: 'Night' },
              ] as { id: LightingMode3D; icon: typeof Sun; labelAr: string; labelEn: string }[]
            ).map((lt) => {
              const Icon = lt.icon;
              return (
                <button
                  key={lt.id}
                  onClick={() => onChangeLightingMode(lt.id)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    lightingMode === lt.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-[#12263A] text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {lang === 'ar' ? lt.labelAr : lt.labelEn}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowThermal3D((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                showThermal3D
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                  : 'border-white/10 bg-[#12263A] text-slate-300 hover:text-white'
              }`}
            >
              <ThermometerSun className="h-3.5 w-3.5" />
              {t(lang, 'حرارية 3D', 'Thermal 3D')}
            </button>

            <button
              type="button"
              onClick={() => setShowGreenEnv3D((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                showGreenEnv3D
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/10 bg-[#12263A] text-slate-300 hover:text-white'
              }`}
            >
              <TreePine className="h-3.5 w-3.5" />
              {t(lang, 'بيئة خضراء 3D', 'Green Flora 3D')}
            </button>

            <button
              type="button"
              onClick={() => setAutoOrbit((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                autoOrbit
                  ? 'eco-flash-glow border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/10 bg-[#12263A] text-slate-300 hover:text-white'
              }`}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${autoOrbit ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              {t(lang, 'جولة سينمائية', 'Cinema Orbit')}
            </button>

            <button
              type="button"
              onClick={() => setAutoExpand3D((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                autoExpand3D
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-[#12263A] text-slate-400'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t(lang, 'توسع تلقائي', 'Auto-Expand')}
            </button>

            {onToggleSmartNight && (
              <button
                type="button"
                onClick={onToggleSmartNight}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                  smartNightActive
                    ? 'border-amber-300/40 bg-indigo-500/25 text-amber-200'
                    : 'border-white/10 bg-[#12263A] text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {t(lang, 'ليلي مريح للعين', 'Eye-Comfort Night')}
              </button>
            )}

            <button
              type="button"
              onClick={handleManualAddBay3D}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                availableCount === 0
                  ? 'eco-amber-flash border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              {t(lang, '+ موقف جديد (3D & 2D)', '+ Add Bay (3D & 2D)')}
            </button>

            <div className="flex items-center gap-1">
              <select
                value={dispatchVehicleType}
                onChange={(e) => setDispatchVehicleType(e.target.value as VehicleType)}
                className="rounded-lg border border-white/10 bg-[#12263A] px-2 py-1.5 text-xs text-white outline-none"
                aria-label="3D Vehicle Type"
              >
                {(['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'] as VehicleType[]).map((vt) => (
                  <option key={vt} value={vt}>
                    {lang === 'ar' ? VEHICLE_SPECS[vt].labelAr : VEHICLE_SPECS[vt].labelEn}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleSpawn3DCar(dispatchVehicleType)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 whitespace-nowrap"
              >
                <Zap className="h-3.5 w-3.5" />
                {t(lang, 'إدخال مركبة', 'Drive In')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
