import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { MapRecord } from '../../models/types';
import type { TileGrid } from '../../models/tilemap';
import { useAppStore } from '../../store/useAppStore';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface LightingConfig {
  ambient: number;
  ambientIntensity: number;
  dir: number;
  dirIntensity: number;
  torch: number;
  torchIntensity: number;
  emissive: number;
  emissiveIntensity: number;
  fogColor: string;
}

interface MapBounds {
  cx: number;
  cz: number;
  span: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

const WALL_HEIGHT = 80;
const FLOOR_SLAB_HEIGHT = 2;
const FP_MOVE_SPEED = 200;

/* ------------------------------------------------------------------ */
/*  Lighting presets                                                    */
/* ------------------------------------------------------------------ */

function lightingForPreset(preset: string): LightingConfig {
  if (preset === 'moonlit') {
    return {
      ambient: 0x2a3552, ambientIntensity: 0.35,
      dir: 0x7799cc, dirIntensity: 0.6,
      torch: 0x6688bb, torchIntensity: 0.4,
      emissive: 0x334466, emissiveIntensity: 0.03,
      fogColor: '#0a0e18',
    };
  }
  if (preset === 'neutral') {
    return {
      ambient: 0x888888, ambientIntensity: 0.5,
      dir: 0xcccccc, dirIntensity: 0.7,
      torch: 0xddccbb, torchIntensity: 0.5,
      emissive: 0x666655, emissiveIntensity: 0.02,
      fogColor: '#111114',
    };
  }
  return {
    ambient: 0x3d2211, ambientIntensity: 0.3,
    dir: 0xffcc88, dirIntensity: 0.45,
    torch: 0xff9944, torchIntensity: 0.8,
    emissive: 0x7a4422, emissiveIntensity: 0.04,
    fogColor: '#110c08',
  };
}

/* ------------------------------------------------------------------ */
/*  Bounds computation                                                 */
/* ------------------------------------------------------------------ */

function computeMapBounds(map: MapRecord): MapBounds {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;

  if (map.tileGrid) {
    const g = map.tileGrid;
    minX = 0;
    minZ = 0;
    maxX = g.width * g.tileSizePx;
    maxZ = g.height * g.tileSizePx;
  }

  for (const room of map.floorRooms) {
    minX = Math.min(minX, room.bounds.x);
    minZ = Math.min(minZ, room.bounds.y);
    maxX = Math.max(maxX, room.bounds.x + room.bounds.width);
    maxZ = Math.max(maxZ, room.bounds.y + room.bounds.height);
  }

  for (const corridor of map.corridors) {
    for (const pt of corridor.points) {
      minX = Math.min(minX, pt.x - corridor.width);
      minZ = Math.min(minZ, pt.y - corridor.width);
      maxX = Math.max(maxX, pt.x + corridor.width);
      maxZ = Math.max(maxZ, pt.y + corridor.width);
    }
  }

  if (!isFinite(minX)) { minX = 0; minZ = 0; maxX = 1000; maxZ = 1000; }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 400);

  return { cx, cz, span, minX, minZ, maxX, maxZ };
}

/* ------------------------------------------------------------------ */
/*  Procedural texture generation for 3D (ambientCG-style)             */
/* ------------------------------------------------------------------ */

function generateStoneTexture(size: number, baseR: number, baseG: number, baseB: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = ((x * 374761393 + y * 668265263 + 1013904223) >>> 0) % 256;
      const offset = (n % 20) - 10;
      ctx.fillStyle = `rgb(${baseR + offset},${baseG + offset},${baseB + offset})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/* ------------------------------------------------------------------ */
/*  GLTF prop loader                                                   */
/* ------------------------------------------------------------------ */

const gltfLoader = new GLTFLoader();
const gltfCache = new Map<string, THREE.Group>();

export function loadPropModel(url: string): Promise<THREE.Group> {
  const cached = gltfCache.get(url);
  if (cached) return Promise.resolve(cached.clone());
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => { gltfCache.set(url, gltf.scene); resolve(gltf.scene.clone()); },
      undefined,
      reject,
    );
  });
}

function placeProps(
  grid: TileGrid,
  scene: THREE.Scene,
  disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; textures?: THREE.Texture[] },
): void {
  const { width, height, tileSizePx } = grid;
  const decorData = grid.layers.decor.data;
  const propGeo = new THREE.BoxGeometry(tileSizePx * 0.3, tileSizePx * 0.5, tileSizePx * 0.3);

  const propColors: Record<number, number> = {
    10: 0xff9933, 11: 0x6b4830, 12: 0x8c7c60,
    13: 0xc4993a, 14: 0xb0a898, 15: 0x6a6054,
  };

  const counts: Record<number, number> = {};
  for (let i = 0; i < width * height; i++) {
    const v = decorData[i];
    if (v >= 10 && v <= 15) counts[v] = (counts[v] ?? 0) + 1;
  }

  for (const [tileIdStr, count] of Object.entries(counts)) {
    const tileId = Number(tileIdStr);
    const mat = new THREE.MeshStandardMaterial({ color: propColors[tileId] ?? 0x888888, roughness: 0.7 });
    disposables.mats.push(mat);
    const mesh = new THREE.InstancedMesh(propGeo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (decorData[y * width + x] !== tileId) continue;
        dummy.position.set(x * tileSizePx + tileSizePx / 2, tileSizePx * 0.25, y * tileSizePx + tileSizePx / 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  disposables.geos.push(propGeo);
}

/* ------------------------------------------------------------------ */
/*  Tile-grid instanced mesh builders                                  */
/* ------------------------------------------------------------------ */

function buildTileInstances(
  grid: TileGrid,
  scene: THREE.Scene,
  lighting: LightingConfig,
  disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; textures: THREE.Texture[] },
): THREE.PointLight[] {
  const { width, height, tileSizePx } = grid;
  const floorData = grid.layers.floor.data;
  const wallData = grid.layers.walls.data;
  const doorData = grid.layers.doors.data;

  let floorCount = 0, wallCount = 0, doorCount = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    if (floorData[i] !== 0) floorCount++;
    if (wallData[i] !== 0) wallCount++;
    if (doorData[i] !== 0) doorCount++;
  }

  const floorGeo = new THREE.BoxGeometry(tileSizePx, FLOOR_SLAB_HEIGHT, tileSizePx);
  const wallGeo = new THREE.BoxGeometry(tileSizePx, WALL_HEIGHT, tileSizePx);
  const doorGeo = new THREE.BoxGeometry(tileSizePx * 0.3, 60, tileSizePx * 0.8);

  const floorTex = generateStoneTexture(128, 107, 93, 80);
  const wallTex = generateStoneTexture(128, 61, 51, 48);
  disposables.textures.push(floorTex, wallTex);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, color: 0xffffff, roughness: 0.88, metalness: 0.03,
    emissive: lighting.emissive, emissiveIntensity: lighting.emissiveIntensity,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex, color: 0xffffff, roughness: 0.92, metalness: 0.04,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d28, roughness: 0.6, metalness: 0.1,
  });

  disposables.geos.push(floorGeo, wallGeo, doorGeo);
  disposables.mats.push(floorMat, wallMat, doorMat);

  const dummy = new THREE.Object3D();

  if (floorCount > 0) {
    const mesh = new THREE.InstancedMesh(floorGeo, floorMat, floorCount);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (floorData[y * width + x] === 0) continue;
        dummy.position.set(
          x * tileSizePx + tileSizePx / 2,
          0,
          y * tileSizePx + tileSizePx / 2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  if (wallCount > 0) {
    const mesh = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (wallData[y * width + x] === 0) continue;
        dummy.position.set(
          x * tileSizePx + tileSizePx / 2,
          WALL_HEIGHT / 2,
          y * tileSizePx + tileSizePx / 2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  if (doorCount > 0) {
    const mesh = new THREE.InstancedMesh(doorGeo, doorMat, doorCount);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (doorData[y * width + x] === 0) continue;
        dummy.position.set(
          x * tileSizePx + tileSizePx / 2,
          30,
          y * tileSizePx + tileSizePx / 2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  placeProps(grid, scene, disposables);

  const torchLights: THREE.PointLight[] = [];
  const roomSize = Math.max(width, height) * tileSizePx * 0.3;
  const lightStep = Math.max(4, Math.floor(width / 6));

  for (let gy = lightStep; gy < height - lightStep; gy += lightStep * 2) {
    for (let gx = lightStep; gx < width - lightStep; gx += lightStep * 2) {
      if (floorData[gy * width + gx] === 0) continue;
      const torch = new THREE.PointLight(lighting.torch, lighting.torchIntensity, roomSize);
      torch.position.set(
        gx * tileSizePx + tileSizePx / 2,
        50,
        gy * tileSizePx + tileSizePx / 2,
      );
      scene.add(torch);
      torchLights.push(torch);
    }
  }

  return torchLights;
}

/* ------------------------------------------------------------------ */
/*  Fallback: build from floorRooms / wallSegments / doorways          */
/* ------------------------------------------------------------------ */

function buildFallbackGeometry(
  map: MapRecord,
  scene: THREE.Scene,
  lighting: LightingConfig,
  disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; textures?: THREE.Texture[] },
): THREE.PointLight[] {
  const roomFloorMat = new THREE.MeshStandardMaterial({
    color: 0x6b5d50, roughness: 0.88, metalness: 0.03,
    emissive: lighting.emissive, emissiveIntensity: lighting.emissiveIntensity,
  });
  const corridorMat = new THREE.MeshStandardMaterial({ color: 0x574a3e, roughness: 0.9, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d3330, roughness: 0.92, metalness: 0.04 });
  const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x524540, roughness: 0.8, metalness: 0.05 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.6, metalness: 0.1 });

  disposables.mats.push(roomFloorMat, corridorMat, wallMat, wallCapMat, doorMat);

  const CORRIDOR_SLAB = 5;

  for (const room of map.floorRooms) {
    const { x, y, width, height } = room.bounds;
    const bevel = Math.min(6, width * 0.02, height * 0.02);
    const shape = new THREE.Shape();
    shape.moveTo(x + bevel, y);
    shape.lineTo(x + width - bevel, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + bevel);
    shape.lineTo(x + width, y + height - bevel);
    shape.quadraticCurveTo(x + width, y + height, x + width - bevel, y + height);
    shape.lineTo(x + bevel, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - bevel);
    shape.lineTo(x, y + bevel);
    shape.quadraticCurveTo(x, y, x + bevel, y);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 8, bevelEnabled: true, bevelSize: 3, bevelThickness: 2, bevelSegments: 2,
    });
    disposables.geos.push(geo);
    const mesh = new THREE.Mesh(geo, roomFloorMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  for (const corridor of map.corridors) {
    const pts = corridor.points;
    const halfW = Math.max(corridor.width * 0.5, 8);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const geo = new THREE.BoxGeometry(len + 4, CORRIDOR_SLAB, halfW * 2);
      disposables.geos.push(geo);
      const mesh = new THREE.Mesh(geo, corridorMat);
      mesh.position.set((a.x + b.x) / 2, CORRIDOR_SLAB / 2, (a.y + b.y) / 2);
      mesh.rotation.y = -Math.atan2(dy, dx);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  for (const wall of map.wallSegments) {
    const [start, end] = wall.points;
    if (!start || !end) continue;
    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const thickness = Math.max(wall.thickness * 0.8, 12);

    const wallGeo = new THREE.BoxGeometry(len, WALL_HEIGHT, thickness);
    const capGeo = new THREE.BoxGeometry(len + 4, 4, thickness + 4);
    disposables.geos.push(wallGeo, capGeo);

    const wm = new THREE.Mesh(wallGeo, wallMat);
    wm.position.set((start.x + end.x) / 2, WALL_HEIGHT / 2, (start.y + end.y) / 2);
    wm.rotation.y = -Math.atan2(dy, dx);
    wm.castShadow = true;
    wm.receiveShadow = true;
    scene.add(wm);

    const cm = new THREE.Mesh(capGeo, wallCapMat);
    cm.position.set((start.x + end.x) / 2, WALL_HEIGHT + 2, (start.y + end.y) / 2);
    cm.rotation.y = -Math.atan2(dy, dx);
    cm.castShadow = true;
    scene.add(cm);
  }

  const DOOR_WIDTH = 36, DOOR_H = 70, POST = 8;
  for (const door of map.doorways) {
    const group = new THREE.Group();
    const isNS = door.orientation === 'north' || door.orientation === 'south';
    const postGeo = new THREE.BoxGeometry(POST, DOOR_H, POST);
    disposables.geos.push(postGeo);

    const lp = new THREE.Mesh(postGeo, doorMat);
    lp.position.set(isNS ? -DOOR_WIDTH / 2 : 0, DOOR_H / 2, isNS ? 0 : -DOOR_WIDTH / 2);
    lp.castShadow = true;

    const rp = new THREE.Mesh(postGeo, doorMat);
    rp.position.set(isNS ? DOOR_WIDTH / 2 : 0, DOOR_H / 2, isNS ? 0 : DOOR_WIDTH / 2);
    rp.castShadow = true;

    const lintelGeo = new THREE.BoxGeometry(
      isNS ? DOOR_WIDTH + POST * 2 : POST, POST,
      isNS ? POST : DOOR_WIDTH + POST * 2,
    );
    disposables.geos.push(lintelGeo);
    const lintel = new THREE.Mesh(lintelGeo, doorMat);
    lintel.position.y = DOOR_H + POST / 2;
    lintel.castShadow = true;

    group.add(lp, rp, lintel);
    group.position.set(door.position.x, 0, door.position.y);
    scene.add(group);
  }

  // Marker glow lights
  for (const marker of map.markers) {
    const color =
      marker.markerType === 'hazard' ? 0xff4433
      : marker.markerType === 'loot' ? 0xffdd44
      : marker.markerType === 'secret' ? 0xaa66ff
      : marker.markerType === 'save' ? 0x44ddff
      : 0xffb46a;
    const glow = new THREE.PointLight(color, 0.5, 200);
    glow.position.set(marker.position.x, 40, marker.position.y);
    scene.add(glow);
  }

  const torchLights: THREE.PointLight[] = [];
  for (const room of map.floorRooms) {
    const rx = room.bounds.x + room.bounds.width / 2;
    const rz = room.bounds.y + room.bounds.height / 2;
    const torchRange = Math.max(room.bounds.width, room.bounds.height) * 2.5;
    const torch = new THREE.PointLight(lighting.torch, lighting.torchIntensity, torchRange);
    torch.position.set(rx, 50, rz);
    scene.add(torch);
    torchLights.push(torch);
  }

  return torchLights;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function isWallAt(grid: TileGrid, worldX: number, worldZ: number): boolean {
  const tx = Math.floor(worldX / grid.tileSizePx);
  const ty = Math.floor(worldZ / grid.tileSizePx);
  if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) return true;
  const wallVal = grid.layers.walls.data[ty * grid.width + tx];
  return wallVal !== undefined && wallVal !== 0;
}

export function MapThreePreview({ map }: { map: MapRecord }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    fpControls: PointerLockControls;
    torchLights: THREE.PointLight[];
    clock: THREE.Clock;
    bounds: MapBounds;
    lighting: LightingConfig;
    disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; textures: THREE.Texture[] };
    fpActive: boolean;
    keys: Record<string, boolean>;
    animId: number;
    tileGrid: TileGrid | undefined;
  } | null>(null);

  const [firstPerson, setFirstPerson] = useState(false);

  const lighting = useMemo(() => lightingForPreset(map.view.lightPreset), [map.view.lightPreset]);

  /* ---------- build / rebuild scene ---------- */
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const bounds = computeMapBounds(map);
    const disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; textures: THREE.Texture[] } = { geos: [], mats: [], textures: [] };

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lighting.fogColor);
    scene.fog = new THREE.FogExp2(lighting.fogColor, 0.0008);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
    const camDist = bounds.span * 1.3;
    const camHeight = bounds.span * 0.95;
    camera.position.set(bounds.cx + camDist * 0.7, camHeight, bounds.cz + camDist * 0.7);
    camera.lookAt(bounds.cx, 0, bounds.cz);

    // Ground
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.95, metalness: 0.02 });
    disposables.mats.push(groundMat);
    const groundGeo = new THREE.PlaneGeometry(bounds.span * 4, bounds.span * 4);
    disposables.geos.push(groundGeo);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(bounds.cx, -1, bounds.cz);
    ground.receiveShadow = true;
    scene.add(ground);

    // Build geometry depending on available data
    let torchLights: THREE.PointLight[];
    if (map.tileGrid) {
      torchLights = buildTileInstances(map.tileGrid, scene, lighting, disposables);
    } else {
      torchLights = buildFallbackGeometry(map, scene, lighting, disposables);
    }

    // Global lighting
    const ambientLight = new THREE.AmbientLight(lighting.ambient, lighting.ambientIntensity);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(lighting.dir, lighting.dirIntensity);
    dirLight.position.set(bounds.cx - bounds.span * 0.5, bounds.span * 1.2, bounds.cz - bounds.span * 0.3);
    dirLight.target.position.set(bounds.cx, 0, bounds.cz);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(4096, 4096);
    const se = bounds.span * 0.8;
    dirLight.shadow.camera.left = -se;
    dirLight.shadow.camera.right = se;
    dirLight.shadow.camera.top = se;
    dirLight.shadow.camera.bottom = -se;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = bounds.span * 3;
    dirLight.shadow.bias = -0.002;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.minDistance = 50;
    orbit.maxDistance = bounds.span * 3;
    orbit.target.set(bounds.cx, 0, bounds.cz);
    orbit.maxPolarAngle = Math.PI * 0.48;

    // PointerLockControls
    const fpControls = new PointerLockControls(camera, renderer.domElement);

    // Resize
    const resizeObs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const w = Math.max(320, width);
      const h = Math.max(280, height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObs.observe(host);

    // Initial sizing
    const initW = Math.max(320, host.clientWidth);
    const initH = Math.max(280, host.clientHeight);
    renderer.setSize(initW, initH, false);
    camera.aspect = initW / initH;
    camera.updateProjectionMatrix();

    // Key state for first-person
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Animation
    const clock = new THREE.Clock();

    const animate = () => {
      const ref = sceneRef.current;
      if (!ref) return;
      ref.animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      if (ref.fpActive && fpControls.isLocked) {
        const speed = FP_MOVE_SPEED * dt;
        const direction = new THREE.Vector3();
        if (keys['KeyW']) direction.z -= 1;
        if (keys['KeyS']) direction.z += 1;
        if (keys['KeyA']) direction.x -= 1;
        if (keys['KeyD']) direction.x += 1;
        direction.normalize();

        const prevPos = camera.position.clone();
        fpControls.moveForward(-direction.z * speed);
        fpControls.moveRight(direction.x * speed);

        if (ref.tileGrid) {
          const margin = ref.tileGrid.tileSizePx * 0.4;
          if (isWallAt(ref.tileGrid, camera.position.x + margin, camera.position.z) ||
              isWallAt(ref.tileGrid, camera.position.x - margin, camera.position.z) ||
              isWallAt(ref.tileGrid, camera.position.x, camera.position.z + margin) ||
              isWallAt(ref.tileGrid, camera.position.x, camera.position.z - margin)) {
            camera.position.copy(prevPos);
          }
        }
        camera.position.y = 45;
      } else {
        orbit.update();
      }

      // Torch flicker
      for (let i = 0; i < torchLights.length; i++) {
        const base = ref.lighting.torchIntensity;
        const flicker =
          Math.sin(t * 3.7 + i * 1.3) * 0.08 +
          Math.sin(t * 7.1 + i * 2.7) * 0.05 +
          Math.sin(t * 11.3 + i * 0.9) * 0.03;
        torchLights[i]!.intensity = base + flicker;
      }

      renderer.render(scene, camera);
    };

    const animId = requestAnimationFrame(animate);

    sceneRef.current = {
      renderer, scene, camera, orbit, fpControls,
      torchLights, clock, bounds, lighting, disposables,
      fpActive: false, keys, animId,
      tileGrid: map.tileGrid,
    };

    return () => {
      resizeObs.disconnect();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);

      const ref = sceneRef.current;
      if (ref) cancelAnimationFrame(ref.animId);
      sceneRef.current = null;

      orbit.dispose();
      if (fpControls.isLocked) fpControls.unlock();
      fpControls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
        if (obj instanceof THREE.Light && 'shadow' in obj) {
          (obj as THREE.DirectionalLight).shadow?.map?.dispose();
        }
      });
      for (const g of disposables.geos) g.dispose();
      for (const m of disposables.mats) m.dispose();
      for (const t of disposables.textures) t.dispose();

      renderer.dispose();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [
    lighting,
    map.tileGrid,
    map.floorRooms,
    map.corridors,
    map.wallSegments,
    map.doorways,
    map.markers,
  ]);

  /* ---------- sync first-person toggle ---------- */
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;

    if (firstPerson) {
      ref.orbit.enabled = false;
      ref.fpActive = true;
      ref.camera.position.set(ref.bounds.cx, 45, ref.bounds.cz);
      ref.fpControls.lock();
    } else {
      ref.fpActive = false;
      ref.orbit.enabled = true;
      if (ref.fpControls.isLocked) ref.fpControls.unlock();
    }
  }, [firstPerson]);

  const handleResetCamera = useCallback(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { bounds } = ref;
    const camDist = bounds.span * 1.3;
    const camHeight = bounds.span * 0.95;
    ref.camera.position.set(bounds.cx + camDist * 0.7, camHeight, bounds.cz + camDist * 0.7);
    ref.camera.lookAt(bounds.cx, 0, bounds.cz);
    ref.orbit.target.set(bounds.cx, 0, bounds.cz);
    ref.orbit.update();
    if (firstPerson) setFirstPerson(false);
  }, [firstPerson]);

  const selection = useAppStore((s) => s.selection);

  const handleFocusSelection = useCallback(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const ids = 'ids' in selection ? selection.ids : [];
    if (ids.length === 0) return;

    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    const expand = (x: number, z: number, w: number, h: number) => {
      minX = Math.min(minX, x); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + w); maxZ = Math.max(maxZ, z + h);
    };
    for (const id of ids) {
      const room = map.floorRooms.find((r) => r.id === id);
      if (room) { expand(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height); continue; }
      const corridor = map.corridors.find((c) => c.id === id);
      if (corridor) { for (const p of corridor.points) expand(p.x - corridor.width, p.y - corridor.width, corridor.width * 2, corridor.width * 2); continue; }
      const door = map.doorways.find((d) => d.id === id);
      if (door) { expand(door.position.x - 30, door.position.y - 30, 60, 60); }
    }
    if (!isFinite(minX)) return;

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, 100);
    const camDist = span * 1.4;
    ref.camera.position.set(cx + camDist * 0.5, span * 0.8, cz + camDist * 0.5);
    ref.camera.lookAt(cx, 0, cz);
    ref.orbit.target.set(cx, 0, cz);
    ref.orbit.update();
    if (firstPerson) setFirstPerson(false);
  }, [map, selection, firstPerson]);

  const toggleFirstPerson = useCallback(() => {
    setFirstPerson((v) => !v);
  }, []);

  return (
    <div className="canvas-shell canvas-shell--3d" data-testid="map-3d-canvas">
      <div className="canvas-3d-overlay">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>Cinematic Preview</strong>
          <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
            Three.js 3D dungeon render (read-only preview)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleResetCamera}
            style={{
              padding: '3px 10px', fontSize: '0.78em',
              background: 'rgba(255,255,255,0.12)', color: '#ddd',
              border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reset Camera
          </button>
          <button
            type="button"
            onClick={toggleFirstPerson}
            style={{
              padding: '3px 10px', fontSize: '0.78em',
              background: firstPerson ? 'rgba(255,160,60,0.35)' : 'rgba(255,255,255,0.12)',
              color: '#ddd',
              border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {firstPerson ? 'Exit First Person' : 'First Person'}
          </button>
          {selection.kind !== 'none' && 'ids' in selection && selection.ids.length > 0 ? (
            <button
              type="button"
              data-testid="focus-selection-3d"
              onClick={handleFocusSelection}
              style={{
                padding: '3px 10px', fontSize: '0.78em',
                background: 'rgba(100,200,255,0.2)',
                color: '#ddd',
                border: '1px solid rgba(100,200,255,0.3)', borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Focus Selection
            </button>
          ) : null}
        </div>
      </div>
      <div className="canvas-3d-host" ref={containerRef} />
    </div>
  );
}
