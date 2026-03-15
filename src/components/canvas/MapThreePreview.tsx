import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { PMREMGenerator, TextureLoader } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import type { DoorwayOrientation, MapRecord, Point, WallSegment } from '../../models/types';
import type { TileGrid } from '../../models/tilemap';
import { getRoomBounds, getRoomFootprint } from '../../lib/floorplan';
import { useAppStore } from '../../store/useAppStore';

interface MapBounds {
  cx: number;
  cz: number;
  span: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

interface DoorSlot {
  position: THREE.Vector3;
  orientation: DoorwayOrientation;
  transitionType: MapRecord['doorways'][number]['transitionType'];
  width: number;
  wallThickness: number;
}

interface MaterialTarget {
  mesh: THREE.Mesh | THREE.InstancedMesh;
  kind: 'floor' | 'wall';
  sizeX: number;
  sizeY: number;
}

interface PbrTextureSet {
  baseColor?: THREE.Texture;
  normal?: THREE.Texture;
  roughness?: THREE.Texture;
  ao?: THREE.Texture;
  height?: THREE.Texture;
  metallic?: THREE.Texture;
}

interface PreviewSceneRef {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  fpControls: PointerLockControls;
  bounds: MapBounds;
  clampOrbit: () => void;
  clock: { getDelta: () => number };
  keys: Record<string, boolean>;
  fpActive: boolean;
  tileGrid?: TileGrid;
  animationFrame: number;
  disposeList: Array<() => void>;
}

export interface MapThreePreviewHandle {
  resetCamera: () => void;
}

const HDRI_PATH = '/assets/hdri/indoor_environment_hdri_008.hdr';
const DOOR_MODEL_PATH = '/assets/models/doors/large_castle_door.glb';
const WALL_TEXTURES_PATH = '/assets/pbr/wall_stone';
const FLOOR_TEXTURES_PATH = '/assets/pbr/floor_stone';

const WALL_HEIGHT = 84;
const FLOOR_SLAB_HEIGHT = 4;
const CAMERA_HEIGHT = 44;
const PLAYER_RADIUS = 10;
const FP_MOVE_SPEED = 220;
const CORRIDOR_WALL_THICKNESS = 14;
const FLOOR_TEXTURE_SCALE = 176;
const WALL_TEXTURE_SCALE = 160;

const gltfLoader = new GLTFLoader();
const hdrLoader = new HDRLoader();
const textureLoader = new TextureLoader();
const texturePromiseCache = new Map<string, Promise<THREE.Texture | null>>();
let doorModelPromise: Promise<THREE.Group | null> | null = null;

const createFrameTimer = () => {
  let lastTime = performance.now();
  return {
    getDelta: () => {
      const currentTime = performance.now();
      const delta = Math.min(0.1, Math.max(0, (currentTime - lastTime) / 1000));
      lastTime = currentTime;
      return delta;
    },
  };
};

const doorwayNormal = (orientation: DoorwayOrientation) => {
  if (orientation === 'north') return { x: 0, z: -1 };
  if (orientation === 'south') return { x: 0, z: 1 };
  if (orientation === 'east') return { x: 1, z: 0 };
  return { x: -1, z: 0 };
};

const doorwayRotationY = (orientation: DoorwayOrientation) => {
  if (orientation === 'north') return 0;
  if (orientation === 'south') return Math.PI;
  if (orientation === 'east') return -Math.PI / 2;
  return Math.PI / 2;
};

const warnAsset = (label: string, error: unknown) => {
  console.warn(`[MapThreePreview] Failed to load ${label}. Falling back to simpler preview assets.`, error);
};

const ensureUv2 = (geometry: THREE.BufferGeometry) => {
  const uv = geometry.getAttribute('uv');
  if (uv && !geometry.getAttribute('uv2')) {
    geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(Array.from(uv.array), 2));
  }
};

const loadTextureAsset = (url: string, label: string, optional = false) => {
  const cached = texturePromiseCache.get(url);
  if (cached) return cached;

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    textureLoader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      (error) => {
        if (!optional) warnAsset(label, error);
        resolve(null);
      },
    );
  });

  texturePromiseCache.set(url, promise);
  return promise;
};

const loadDoorModel = () => {
  if (!doorModelPromise) {
    doorModelPromise = new Promise<THREE.Group | null>((resolve) => {
      gltfLoader.load(
        DOOR_MODEL_PATH,
        (gltf) => resolve(gltf.scene),
        undefined,
        (error) => {
          warnAsset('door model', error);
          resolve(null);
        },
      );
    });
  }

  return doorModelPromise;
};

const loadPbrTextureSet = async (basePath: string, label: string): Promise<PbrTextureSet | null> => {
  const [baseColor, normal, roughness, ao, height, metallic] = await Promise.all([
    loadTextureAsset(`${basePath}/basecolor.jpg`, `${label} basecolor`),
    loadTextureAsset(`${basePath}/normal.jpg`, `${label} normal`),
    loadTextureAsset(`${basePath}/roughness.jpg`, `${label} roughness`),
    loadTextureAsset(`${basePath}/ao.jpg`, `${label} ao`),
    loadTextureAsset(`${basePath}/height.jpg`, `${label} height`, true),
    loadTextureAsset(`${basePath}/metallic.jpg`, `${label} metallic`, true),
  ]);

  if (!baseColor && !normal && !roughness && !ao && !height && !metallic) {
    return null;
  }

  if (baseColor) {
    baseColor.colorSpace = THREE.SRGBColorSpace;
  }

  return {
    baseColor: baseColor ?? undefined,
    normal: normal ?? undefined,
    roughness: roughness ?? undefined,
    ao: ao ?? undefined,
    height: height ?? undefined,
    metallic: metallic ?? undefined,
  };
};

const cloneTextureForRepeat = (texture: THREE.Texture, repeatX: number, repeatY: number) => {
  const clone = texture.clone();
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  clone.needsUpdate = true;
  clone.colorSpace = texture.colorSpace;
  return clone;
};

const buildSurfaceMaterial = (
  kind: 'floor' | 'wall',
  textures: PbrTextureSet,
  sizeX: number,
  sizeY: number,
) => {
  const scale = kind === 'floor' ? FLOOR_TEXTURE_SCALE : WALL_TEXTURE_SCALE;
  const repeatX = Math.max(1, sizeX / scale);
  const repeatY = Math.max(1, sizeY / scale);
  const ownedTextures: THREE.Texture[] = [];

  const map = textures.baseColor ? cloneTextureForRepeat(textures.baseColor, repeatX, repeatY) : undefined;
  const normalMap = textures.normal ? cloneTextureForRepeat(textures.normal, repeatX, repeatY) : undefined;
  const roughnessMap = textures.roughness ? cloneTextureForRepeat(textures.roughness, repeatX, repeatY) : undefined;
  const aoMap = textures.ao ? cloneTextureForRepeat(textures.ao, repeatX, repeatY) : undefined;
  const bumpMap = textures.height ? cloneTextureForRepeat(textures.height, repeatX, repeatY) : undefined;
  const metalnessMap = textures.metallic ? cloneTextureForRepeat(textures.metallic, repeatX, repeatY) : undefined;

  for (const texture of [map, normalMap, roughnessMap, aoMap, bumpMap, metalnessMap]) {
    if (texture) ownedTextures.push(texture);
  }

  const materialConfig: THREE.MeshStandardMaterialParameters = {
    color: kind === 'floor' ? 0xc4b5a0 : 0x7f7569,
    roughness: kind === 'floor' ? 0.95 : 0.88,
    metalness: 0.04,
    bumpScale: bumpMap ? 0.8 : 0,
  };

  if (map) materialConfig.map = map;
  if (normalMap) materialConfig.normalMap = normalMap;
  if (roughnessMap) materialConfig.roughnessMap = roughnessMap;
  if (aoMap) materialConfig.aoMap = aoMap;
  if (bumpMap) materialConfig.bumpMap = bumpMap;
  if (metalnessMap) materialConfig.metalnessMap = metalnessMap;

  const material = new THREE.MeshStandardMaterial(materialConfig);

  return { material, ownedTextures };
};

const distanceToSegment2d = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const px = start.x + dx * t;
  const py = start.y + dy * t;
  return Math.hypot(point.x - px, point.y - py);
};

function computeMapBounds(map: MapRecord): MapBounds {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  if (map.tileGrid) {
    minX = 0;
    minZ = 0;
    maxX = map.tileGrid.width * map.tileGrid.tileSizePx;
    maxZ = map.tileGrid.height * map.tileGrid.tileSizePx;
  }

  for (const room of map.floorRooms) {
    const bounds = getRoomBounds(room);
    minX = Math.min(minX, bounds.x);
    minZ = Math.min(minZ, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxZ = Math.max(maxZ, bounds.y + bounds.height);
  }

  for (const corridor of map.corridors) {
    for (const point of corridor.points) {
      minX = Math.min(minX, point.x - corridor.width);
      minZ = Math.min(minZ, point.y - corridor.width);
      maxX = Math.max(maxX, point.x + corridor.width);
      maxZ = Math.max(maxZ, point.y + corridor.width);
    }
  }

  for (const marker of map.markers) {
    minX = Math.min(minX, marker.position.x - 32);
    minZ = Math.min(minZ, marker.position.y - 32);
    maxX = Math.max(maxX, marker.position.x + 32);
    maxZ = Math.max(maxZ, marker.position.y + 32);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minZ = 0;
    maxX = 1000;
    maxZ = 1000;
  }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 420);

  return { cx, cz, span, minX, minZ, maxX, maxZ };
}

const isWallTileBlocked = (grid: TileGrid, worldX: number, worldZ: number) => {
  const tileX = Math.floor(worldX / grid.tileSizePx);
  const tileY = Math.floor(worldZ / grid.tileSizePx);

  if (tileX < 0 || tileY < 0 || tileX >= grid.width || tileY >= grid.height) {
    return true;
  }

  return grid.layers.walls.data[tileY * grid.width + tileX] !== 0;
};

const isWalkableFallback = (map: MapRecord, worldX: number, worldZ: number) => {
  const insideRoom = map.floorRooms.some((room) =>
    getRoomFootprint(room).some((rect) => (
      worldX >= rect.x + PLAYER_RADIUS &&
      worldX <= rect.x + rect.width - PLAYER_RADIUS &&
      worldZ >= rect.y + PLAYER_RADIUS &&
      worldZ <= rect.y + rect.height - PLAYER_RADIUS
    )),
  );

  if (insideRoom) return true;

  const insideCorridor = map.corridors.some((corridor) => {
    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index]!;
      const end = corridor.points[index + 1]!;
      if (distanceToSegment2d({ x: worldX, y: worldZ }, start, end) <= Math.max(6, corridor.width * 0.5 - PLAYER_RADIUS * 0.4)) {
        return true;
      }
    }
    return false;
  });

  if (insideCorridor) return true;

  return map.doorways.some((doorway) => {
    const normal = doorwayNormal(doorway.orientation);
    const depth = 12;
    const localX = Math.abs(worldX - doorway.position.x);
    const localZ = Math.abs(worldZ - doorway.position.y);

    if (normal.x !== 0) {
      return localX <= depth && localZ <= doorway.width * 0.5;
    }

    return localZ <= depth && localX <= doorway.width * 0.5;
  });
};

const collidesWithWallSegments = (walls: WallSegment[], worldX: number, worldZ: number) => {
  const point = { x: worldX, y: worldZ };

  return walls.some((wall) => {
    const [start, end] = wall.points;
    if (!start || !end) return false;
    const threshold = Math.max(6, wall.thickness * 0.35) + PLAYER_RADIUS * 0.4;
    return distanceToSegment2d(point, start, end) <= threshold;
  });
};

const doorwayUsesBarGate = (transitionType: DoorSlot['transitionType']) =>
  transitionType === 'gate' || transitionType === 'portcullis';

const corridorEndpointHasDoorway = (point: Point, doorways: MapRecord['doorways']) =>
  doorways.some((doorway) => Math.hypot(doorway.position.x - point.x, doorway.position.y - point.y) <= Math.max(18, doorway.width * 0.7));

const addFallbackDoorGeometry = (
  doorSlots: DoorSlot[],
  parent: THREE.Group,
  disposeList: Array<() => void>,
) => {
  const doorLeafGeometry = new THREE.BoxGeometry(1, 1, 0.16);
  const frameGeometry = new THREE.BoxGeometry(1, 1, 0.18);
  const doorLeafMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d3d28,
    roughness: 0.68,
    metalness: 0.08,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d211a,
    roughness: 0.82,
    metalness: 0.04,
  });

  ensureUv2(doorLeafGeometry);
  ensureUv2(frameGeometry);

  disposeList.push(() => doorLeafGeometry.dispose());
  disposeList.push(() => frameGeometry.dispose());
  disposeList.push(() => doorLeafMaterial.dispose());
  disposeList.push(() => frameMaterial.dispose());

  for (const slot of doorSlots) {
    const group = new THREE.Group();
    group.userData.transitionType = slot.transitionType;
    const normal = doorwayNormal(slot.orientation);
    const doorHeight = WALL_HEIGHT * 0.76;
    const depth = Math.max(8, slot.wallThickness * 0.65);

    const topFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    topFrame.scale.set(slot.width * 1.08, 8, depth * 1.1);
    topFrame.position.set(0, doorHeight + 4, 0);
    topFrame.castShadow = true;

    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    leftFrame.scale.set(8, doorHeight + 8, depth * 1.1);
    leftFrame.position.set(-slot.width * 0.54, (doorHeight + 8) / 2, 0);
    leftFrame.castShadow = true;

    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    rightFrame.scale.set(8, doorHeight + 8, depth * 1.1);
    rightFrame.position.set(slot.width * 0.54, (doorHeight + 8) / 2, 0);
    rightFrame.castShadow = true;

    if (doorwayUsesBarGate(slot.transitionType)) {
      const barOffsets = [-slot.width * 0.28, 0, slot.width * 0.28];
      for (const offset of barOffsets) {
        const bar = new THREE.Mesh(frameGeometry, frameMaterial);
        bar.scale.set(6, doorHeight, depth * 0.84);
        bar.position.set(offset, doorHeight / 2, 0);
        bar.castShadow = true;
        group.add(bar);
      }
    } else {
      const leaf = new THREE.Mesh(doorLeafGeometry, doorLeafMaterial);
      leaf.scale.set(slot.width * 0.82, doorHeight, depth);
      leaf.position.set(0, doorHeight / 2, 0);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    }

    group.add(topFrame, leftFrame, rightFrame);
    group.position.set(
      slot.position.x + normal.x * slot.wallThickness * 0.08,
      0,
      slot.position.z + normal.z * slot.wallThickness * 0.08,
    );
    group.rotation.y = doorwayRotationY(slot.orientation);
    parent.add(group);
  }
};

const addDoorModelInstances = (
  template: THREE.Group,
  doorSlots: DoorSlot[],
  parent: THREE.Group,
) => {
  const bounds = new THREE.Box3().setFromObject(template);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const baseWidth = Math.max(size.x, size.z, 1);
  const baseHeight = Math.max(size.y, 1);

  for (const slot of doorSlots.filter((candidate) => candidate.transitionType === 'door')) {
    const instance = template.clone(true);
    const root = new THREE.Group();
    const normal = doorwayNormal(slot.orientation);
    const uniformScale = (slot.width / baseWidth) * 0.96;
    const visualScale = baseHeight * uniformScale < WALL_HEIGHT * 0.72
      ? (WALL_HEIGHT * 0.76) / baseHeight
      : uniformScale;

    instance.position.set(-center.x, -bounds.min.y, -center.z);
    instance.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    root.add(instance);
    root.scale.setScalar(visualScale);
    root.position.set(
      slot.position.x + normal.x * slot.wallThickness * 0.08,
      0,
      slot.position.z + normal.z * slot.wallThickness * 0.08,
    );
    root.rotation.y = doorwayRotationY(slot.orientation);
    parent.add(root);
  }
};

const addCorridorWallGeometry = (
  map: MapRecord,
  scene: THREE.Scene,
  wallMaterial: THREE.Material,
  materialTargets: MaterialTarget[],
  disposeList: Array<() => void>,
) => {
  const addWallMesh = (width: number, thickness: number, centerX: number, centerZ: number, rotationY: number) => {
    const geometry = new THREE.BoxGeometry(width, WALL_HEIGHT, thickness);
    ensureUv2(geometry);
    disposeList.push(() => geometry.dispose());

    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set(centerX, WALL_HEIGHT / 2, centerZ);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    materialTargets.push({ mesh, kind: 'wall', sizeX: width, sizeY: WALL_HEIGHT });
  };

  for (const corridor of map.corridors) {
    const wallThickness = Math.max(10, Math.min(CORRIDOR_WALL_THICKNESS, corridor.width * 0.2));
    const capWidth = corridor.width + wallThickness * 1.6;
    const lastSegmentIndex = corridor.points.length - 2;

    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index]!;
      const end = corridor.points[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.y - start.y;
      const length = Math.hypot(dx, dz);
      if (length < 1) continue;

      const tangentX = dx / length;
      const tangentZ = dz / length;
      const normalX = -tangentZ;
      const normalZ = tangentX;
      const rotationY = -Math.atan2(dz, dx);
      const centerX = (start.x + end.x) / 2;
      const centerZ = (start.y + end.y) / 2;
      const sideOffset = corridor.width * 0.5 + wallThickness * 0.5 - 1;

      addWallMesh(length + wallThickness, wallThickness, centerX + normalX * sideOffset, centerZ + normalZ * sideOffset, rotationY);
      addWallMesh(length + wallThickness, wallThickness, centerX - normalX * sideOffset, centerZ - normalZ * sideOffset, rotationY);

      if (index === 0 && !corridorEndpointHasDoorway(start, map.doorways)) {
        addWallMesh(
          wallThickness,
          capWidth,
          start.x - tangentX * wallThickness * 0.5,
          start.y - tangentZ * wallThickness * 0.5,
          rotationY,
        );
      }

      if (index === lastSegmentIndex && !corridorEndpointHasDoorway(end, map.doorways)) {
        addWallMesh(
          wallThickness,
          capWidth,
          end.x + tangentX * wallThickness * 0.5,
          end.y + tangentZ * wallThickness * 0.5,
          rotationY,
        );
      }
    }
  }
};

const buildTileGridScene = (
  map: MapRecord,
  scene: THREE.Scene,
  floorMaterial: THREE.Material,
  wallMaterial: THREE.Material,
  materialTargets: MaterialTarget[],
  doorSlots: DoorSlot[],
  disposeList: Array<() => void>,
) => {
  if (!map.tileGrid) return;

  const { width, height, tileSizePx } = map.tileGrid;
  const floorData = map.tileGrid.layers.floor.data;
  const wallData = map.tileGrid.layers.walls.data;

  let floorCount = 0;
  let wallCount = 0;
  const total = width * height;
  for (let index = 0; index < total; index += 1) {
    if (floorData[index] !== 0) floorCount += 1;
    if (wallData[index] !== 0) wallCount += 1;
  }

  const floorGeometry = new THREE.BoxGeometry(tileSizePx, FLOOR_SLAB_HEIGHT, tileSizePx);
  const wallGeometry = new THREE.BoxGeometry(tileSizePx, WALL_HEIGHT, tileSizePx);
  ensureUv2(floorGeometry);
  ensureUv2(wallGeometry);

  disposeList.push(() => floorGeometry.dispose());
  disposeList.push(() => wallGeometry.dispose());

  if (floorCount > 0) {
    const mesh = new THREE.InstancedMesh(floorGeometry, floorMaterial, floorCount);
    const helper = new THREE.Object3D();
    let cursor = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (floorData[y * width + x] === 0) continue;
        helper.position.set(
          x * tileSizePx + tileSizePx / 2,
          FLOOR_SLAB_HEIGHT / 2,
          y * tileSizePx + tileSizePx / 2,
        );
        helper.updateMatrix();
        mesh.setMatrixAt(cursor, helper.matrix);
        cursor += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    materialTargets.push({ mesh, kind: 'floor', sizeX: tileSizePx, sizeY: tileSizePx });
  }

  if (wallCount > 0) {
    const mesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallCount);
    const helper = new THREE.Object3D();
    let cursor = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (wallData[y * width + x] === 0) continue;
        helper.position.set(
          x * tileSizePx + tileSizePx / 2,
          WALL_HEIGHT / 2,
          y * tileSizePx + tileSizePx / 2,
        );
        helper.updateMatrix();
        mesh.setMatrixAt(cursor, helper.matrix);
        cursor += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    materialTargets.push({ mesh, kind: 'wall', sizeX: tileSizePx, sizeY: WALL_HEIGHT });
  }

  for (const doorway of map.doorways) {
    doorSlots.push({
      position: new THREE.Vector3(doorway.position.x, 0, doorway.position.y),
      orientation: doorway.orientation,
      transitionType: doorway.transitionType,
      width: doorway.width,
      wallThickness: Math.max(12, tileSizePx * 0.6),
    });
  }
};

const buildFloorplanScene = (
  map: MapRecord,
  scene: THREE.Scene,
  floorMaterial: THREE.Material,
  wallMaterial: THREE.Material,
  materialTargets: MaterialTarget[],
  doorSlots: DoorSlot[],
  disposeList: Array<() => void>,
) => {
  for (const room of map.floorRooms) {
    for (const rect of getRoomFootprint(room)) {
      const geometry = new THREE.BoxGeometry(rect.width, FLOOR_SLAB_HEIGHT, rect.height);
      ensureUv2(geometry);
      disposeList.push(() => geometry.dispose());

      const mesh = new THREE.Mesh(geometry, floorMaterial);
      mesh.position.set(
        rect.x + rect.width / 2,
        FLOOR_SLAB_HEIGHT / 2,
        rect.y + rect.height / 2,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      materialTargets.push({ mesh, kind: 'floor', sizeX: rect.width, sizeY: rect.height });
    }
  }

  for (const corridor of map.corridors) {
    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index]!;
      const end = corridor.points[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.y - start.y;
      const length = Math.hypot(dx, dz);
      if (length < 1) continue;

      const geometry = new THREE.BoxGeometry(length, FLOOR_SLAB_HEIGHT, corridor.width);
      ensureUv2(geometry);
      disposeList.push(() => geometry.dispose());

      const mesh = new THREE.Mesh(geometry, floorMaterial);
      mesh.position.set((start.x + end.x) / 2, FLOOR_SLAB_HEIGHT / 2, (start.y + end.y) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      materialTargets.push({ mesh, kind: 'floor', sizeX: length, sizeY: corridor.width });
    }
  }

  addCorridorWallGeometry(map, scene, wallMaterial, materialTargets, disposeList);

  for (const wall of map.wallSegments) {
    const [start, end] = wall.points;
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    if (length < 1) continue;

    const thickness = Math.max(10, wall.thickness * 0.85);
    const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, thickness);
    ensureUv2(geometry);
    disposeList.push(() => geometry.dispose());

    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set((start.x + end.x) / 2, WALL_HEIGHT / 2, (start.y + end.y) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    materialTargets.push({ mesh, kind: 'wall', sizeX: length, sizeY: WALL_HEIGHT });
  }

  for (const doorway of map.doorways) {
    doorSlots.push({
      position: new THREE.Vector3(doorway.position.x, 0, doorway.position.y),
      orientation: doorway.orientation,
      transitionType: doorway.transitionType,
      width: doorway.width,
      wallThickness: 18,
    });
  }

  for (const marker of map.markers.slice(0, 10)) {
    const color =
      marker.markerType === 'loot' ? 0xffc95c :
      marker.markerType === 'secret' ? 0xd47aea :
      marker.markerType === 'save' ? 0x6fd3ff :
      0xff8b63;
    const light = new THREE.PointLight(color, 0.25, 260);
    light.position.set(marker.position.x, 48, marker.position.y);
    scene.add(light);
  }
};

export const MapThreePreview = forwardRef<MapThreePreviewHandle, { map: MapRecord }>(
  function MapThreePreview({ map }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<PreviewSceneRef | null>(null);
    const [fpArmed, setFpArmed] = useState(false);
    const [fpLocked, setFpLocked] = useState(false);

    const selection = useAppStore((state) => state.selection);
    const bounds = useMemo(() => computeMapBounds(map), [map]);

    const resetCamera = useCallback(() => {
      const current = sceneRef.current;
      if (!current) return;

      current.fpControls.unlock();
      current.fpActive = false;
      current.orbit.enabled = true;
      current.orbit.reset();
      current.clampOrbit();
      current.orbit.update();
      setFpArmed(false);
      setFpLocked(false);
    }, []);

    useImperativeHandle(ref, () => ({
      resetCamera,
    }), [resetCamera]);

    useEffect(() => {
      const host = containerRef.current;
      if (!host) return;

      let disposed = false;
      const disposeList: Array<() => void> = [];

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      host.appendChild(renderer.domElement);
      disposeList.push(() => renderer.dispose());
      disposeList.push(() => {
        if (host.contains(renderer.domElement)) {
          host.removeChild(renderer.domElement);
        }
      });

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0f0d0b');
      scene.fog = new THREE.FogExp2('#0f0d0b', 0.00065);

      const camera = new THREE.PerspectiveCamera(52, 1, 1, 20000);
      const orbitDistance = bounds.span * 1.15;
      camera.position.set(bounds.cx + orbitDistance * 0.7, bounds.span * 0.78, bounds.cz + orbitDistance * 0.72);
      camera.lookAt(bounds.cx, 0, bounds.cz);

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.1;
      orbit.minDistance = 72;
      orbit.maxDistance = bounds.span * 1.9;
      orbit.minPolarAngle = Math.PI * 0.18;
      orbit.maxPolarAngle = Math.PI * 0.48;
      orbit.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      orbit.target.set(bounds.cx, 0, bounds.cz);
      orbit.enablePan = true;

      const clampOrbit = () => {
        orbit.target.x = THREE.MathUtils.clamp(orbit.target.x, bounds.minX, bounds.maxX);
        orbit.target.z = THREE.MathUtils.clamp(orbit.target.z, bounds.minZ, bounds.maxZ);

        const offset = camera.position.clone().sub(orbit.target);
        const distance = THREE.MathUtils.clamp(offset.length(), orbit.minDistance, orbit.maxDistance);
        if (offset.lengthSq() > 0) {
          offset.setLength(distance);
          camera.position.copy(orbit.target).add(offset);
        }

        camera.position.y = Math.max(CAMERA_HEIGHT, camera.position.y);
      };

      orbit.addEventListener('change', clampOrbit);
      disposeList.push(() => orbit.removeEventListener('change', clampOrbit));
      clampOrbit();
      orbit.saveState();

      const fpControls = new PointerLockControls(camera, renderer.domElement);
      fpControls.minPolarAngle = Math.PI * 0.24;
      fpControls.maxPolarAngle = Math.PI * 0.76;

      const preventContextMenu = (event: MouseEvent) => event.preventDefault();
      host.addEventListener('contextmenu', preventContextMenu);
      renderer.domElement.addEventListener('contextmenu', preventContextMenu);
      disposeList.push(() => host.removeEventListener('contextmenu', preventContextMenu));
      disposeList.push(() => renderer.domElement.removeEventListener('contextmenu', preventContextMenu));

      const floorFallbackMaterial = new THREE.MeshStandardMaterial({
        color: 0xc1b39f,
        roughness: 0.94,
        metalness: 0.03,
      });
      const wallFallbackMaterial = new THREE.MeshStandardMaterial({
        color: 0x7c7266,
        roughness: 0.88,
        metalness: 0.05,
      });
      disposeList.push(() => floorFallbackMaterial.dispose());
      disposeList.push(() => wallFallbackMaterial.dispose());

      const groundGeometry = new THREE.PlaneGeometry(bounds.span * 4, bounds.span * 4);
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x14110f,
        roughness: 1,
        metalness: 0.02,
      });
      disposeList.push(() => groundGeometry.dispose());
      disposeList.push(() => groundMaterial.dispose());
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(bounds.cx, -2, bounds.cz);
      ground.receiveShadow = true;
      scene.add(ground);

      const ambientLight = new THREE.AmbientLight(0xf0d9bf, 0.42);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xfff0d6, 1.1);
      directionalLight.position.set(bounds.cx - bounds.span * 0.42, bounds.span * 1.15, bounds.cz - bounds.span * 0.3);
      directionalLight.target.position.set(bounds.cx, 0, bounds.cz);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.set(2048, 2048);
      const shadowExtent = bounds.span * 0.9;
      directionalLight.shadow.camera.left = -shadowExtent;
      directionalLight.shadow.camera.right = shadowExtent;
      directionalLight.shadow.camera.top = shadowExtent;
      directionalLight.shadow.camera.bottom = -shadowExtent;
      directionalLight.shadow.camera.near = 1;
      directionalLight.shadow.camera.far = bounds.span * 3;
      directionalLight.shadow.bias = -0.0008;
      scene.add(directionalLight);
      scene.add(directionalLight.target);
      disposeList.push(() => directionalLight.shadow.map?.dispose());

      const materialTargets: MaterialTarget[] = [];
      const doorSlots: DoorSlot[] = [];
      if (map.tileGrid) {
        buildTileGridScene(map, scene, floorFallbackMaterial, wallFallbackMaterial, materialTargets, doorSlots, disposeList);
      } else {
        buildFloorplanScene(map, scene, floorFallbackMaterial, wallFallbackMaterial, materialTargets, doorSlots, disposeList);
      }

      const fallbackDoorGroup = new THREE.Group();
      scene.add(fallbackDoorGroup);
      addFallbackDoorGeometry(doorSlots, fallbackDoorGroup, disposeList);

      const modelDoorGroup = new THREE.Group();
      modelDoorGroup.visible = false;
      scene.add(modelDoorGroup);

      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      disposeList.push(() => pmremGenerator.dispose());

      const applyAssetMaterials = async () => {
        const [floorTextures, wallTextures, doorTemplate] = await Promise.all([
          loadPbrTextureSet(FLOOR_TEXTURES_PATH, 'floor textures'),
          loadPbrTextureSet(WALL_TEXTURES_PATH, 'wall textures'),
          loadDoorModel(),
        ]);

        if (disposed) return;

        if (floorTextures || wallTextures) {
          for (const target of materialTargets) {
            const textureSet = target.kind === 'floor' ? floorTextures : wallTextures;
            if (!textureSet) continue;

            const { material, ownedTextures } = buildSurfaceMaterial(
              target.kind,
              textureSet,
              target.sizeX,
              target.sizeY,
            );

            target.mesh.material = material;
            disposeList.push(() => material.dispose());
            for (const texture of ownedTextures) {
              disposeList.push(() => texture.dispose());
            }
          }
        }

        if (doorTemplate) {
          modelDoorGroup.visible = true;
          fallbackDoorGroup.traverse((object) => {
            if (object instanceof THREE.Group && object.userData.transitionType === 'door') {
              object.visible = false;
            }
          });
          addDoorModelInstances(doorTemplate, doorSlots, modelDoorGroup);
        }
      };

      void applyAssetMaterials();

      hdrLoader.load(
        HDRI_PATH,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }

          const environmentMap = pmremGenerator.fromEquirectangular(texture).texture;
          texture.dispose();
          scene.environment = environmentMap;
          disposeList.push(() => environmentMap.dispose());
        },
        undefined,
        (error) => warnAsset('HDR environment', error),
      );

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = Math.max(320, entry.contentRect.width);
        const height = Math.max(280, entry.contentRect.height);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(host);
      disposeList.push(() => resizeObserver.disconnect());

      const initialWidth = Math.max(320, host.clientWidth);
      const initialHeight = Math.max(280, host.clientHeight);
      renderer.setSize(initialWidth, initialHeight, false);
      camera.aspect = initialWidth / initialHeight;
      camera.updateProjectionMatrix();

      const keys: Record<string, boolean> = {};
      const onKeyDown = (event: KeyboardEvent) => {
        keys[event.code] = true;
      };
      const onKeyUp = (event: KeyboardEvent) => {
        keys[event.code] = false;
      };
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      disposeList.push(() => document.removeEventListener('keydown', onKeyDown));
      disposeList.push(() => document.removeEventListener('keyup', onKeyUp));

      const onLock = () => {
        if (disposed) return;
        orbit.enabled = false;
        camera.position.y = CAMERA_HEIGHT;
        setFpLocked(true);
        setFpArmed(true);
        if (sceneRef.current) {
          sceneRef.current.fpActive = true;
        }
      };

      const onUnlock = () => {
        if (disposed) return;
        orbit.enabled = true;
        setFpLocked(false);
        setFpArmed(false);
        if (sceneRef.current) {
          sceneRef.current.fpActive = false;
        }
        clampOrbit();
        orbit.update();
      };

      fpControls.addEventListener('lock', onLock);
      fpControls.addEventListener('unlock', onUnlock);
      disposeList.push(() => fpControls.removeEventListener('lock', onLock));
      disposeList.push(() => fpControls.removeEventListener('unlock', onUnlock));
      disposeList.push(() => fpControls.dispose());

      const clock = createFrameTimer();
      const animate = () => {
        const current = sceneRef.current;
        if (!current) return;

        current.animationFrame = requestAnimationFrame(animate);
        const delta = current.clock.getDelta();

        if (current.fpActive && current.fpControls.isLocked) {
          const previous = current.camera.position.clone();
          const step = FP_MOVE_SPEED * delta;
          const movement = new THREE.Vector3();

          if (current.keys.KeyW) movement.z -= 1;
          if (current.keys.KeyS) movement.z += 1;
          if (current.keys.KeyA) movement.x -= 1;
          if (current.keys.KeyD) movement.x += 1;

          if (movement.lengthSq() > 0) {
            movement.normalize();
            current.fpControls.moveForward(-movement.z * step);
            current.fpControls.moveRight(movement.x * step);
          }

          current.camera.position.x = THREE.MathUtils.clamp(current.camera.position.x, current.bounds.minX, current.bounds.maxX);
          current.camera.position.z = THREE.MathUtils.clamp(current.camera.position.z, current.bounds.minZ, current.bounds.maxZ);
          current.camera.position.y = CAMERA_HEIGHT;

          if (current.tileGrid) {
            const blocked =
              isWallTileBlocked(current.tileGrid, current.camera.position.x + PLAYER_RADIUS, current.camera.position.z) ||
              isWallTileBlocked(current.tileGrid, current.camera.position.x - PLAYER_RADIUS, current.camera.position.z) ||
              isWallTileBlocked(current.tileGrid, current.camera.position.x, current.camera.position.z + PLAYER_RADIUS) ||
              isWallTileBlocked(current.tileGrid, current.camera.position.x, current.camera.position.z - PLAYER_RADIUS);
            if (blocked) {
              current.camera.position.copy(previous);
            }
          } else if (
            !isWalkableFallback(map, current.camera.position.x, current.camera.position.z) ||
            collidesWithWallSegments(map.wallSegments, current.camera.position.x, current.camera.position.z)
          ) {
            current.camera.position.copy(previous);
          }
        } else {
          current.orbit.update();
        }

        current.renderer.render(current.scene, current.camera);
      };

      sceneRef.current = {
        renderer,
        scene,
        camera,
        orbit,
        fpControls,
        bounds,
        clampOrbit,
        clock,
        keys,
        fpActive: false,
        tileGrid: map.tileGrid,
        animationFrame: requestAnimationFrame(animate),
        disposeList,
      };

      return () => {
        disposed = true;
        const current = sceneRef.current;
        if (current) {
          cancelAnimationFrame(current.animationFrame);
        }
        sceneRef.current = null;
        for (const dispose of disposeList.reverse()) {
          dispose();
        }
      };
    }, [bounds, map]);

    const handleFocusSelection = useCallback(() => {
      const current = sceneRef.current;
      if (!current) return;
      const ids = 'ids' in selection ? selection.ids : [];
      if (ids.length === 0) return;

      let minX = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxZ = -Infinity;
      const expand = (x: number, z: number, width: number, height: number) => {
        minX = Math.min(minX, x);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x + width);
        maxZ = Math.max(maxZ, z + height);
      };

      for (const id of ids) {
        const room = map.floorRooms.find((entry) => entry.id === id);
        if (room) {
          const bounds = getRoomBounds(room);
          expand(bounds.x, bounds.y, bounds.width, bounds.height);
          continue;
        }

        const corridor = map.corridors.find((entry) => entry.id === id);
        if (corridor) {
          for (const point of corridor.points) {
            expand(point.x - corridor.width * 0.5, point.y - corridor.width * 0.5, corridor.width, corridor.width);
          }
          continue;
        }

        const doorway = map.doorways.find((entry) => entry.id === id);
        if (doorway) {
          expand(doorway.position.x - doorway.width * 0.5, doorway.position.y - doorway.width * 0.5, doorway.width, doorway.width);
        }
      }

      if (!Number.isFinite(minX)) return;

      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ, 120);

      current.fpControls.unlock();
      current.fpActive = false;
      current.orbit.enabled = true;
      current.camera.position.set(cx + span * 0.78, span * 0.72, cz + span * 0.82);
      current.orbit.target.set(cx, 0, cz);
      current.clampOrbit();
      current.orbit.update();
      setFpLocked(false);
      setFpArmed(false);
    }, [map, selection]);

    const toggleFirstPerson = useCallback(() => {
      const current = sceneRef.current;
      if (!current) return;

      if (current.fpControls.isLocked || fpArmed) {
        current.fpControls.unlock();
        current.fpActive = false;
        current.orbit.enabled = true;
        setFpArmed(false);
        setFpLocked(false);
        current.clampOrbit();
        return;
      }

      current.camera.position.x = THREE.MathUtils.clamp(current.camera.position.x, current.bounds.minX, current.bounds.maxX);
      current.camera.position.z = THREE.MathUtils.clamp(current.camera.position.z, current.bounds.minZ, current.bounds.maxZ);
      current.camera.position.y = CAMERA_HEIGHT;
      setFpArmed(true);
      current.fpControls.lock();
    }, [fpArmed]);

    return (
      <div
        className="canvas-shell canvas-shell--3d"
        data-testid="map-3d-canvas"
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          const current = sceneRef.current;
          if (current && fpArmed && !fpLocked) {
            current.fpControls.lock();
          }
        }}
      >
        <div className="canvas-3d-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="canvas-3d-overlay__header">
            <strong>Cinematic Preview</strong>
            <span>{fpLocked ? 'First-person active' : fpArmed ? 'First-person armed' : 'Orbit camera active'}</span>
          </div>
          <div className="canvas-3d-overlay__actions">
            <button type="button" onClick={resetCamera}>Reset Camera</button>
            <button
              type="button"
              onClick={toggleFirstPerson}
              className={fpLocked || fpArmed ? 'is-active' : ''}
            >
              {fpLocked || fpArmed ? 'Exit First Person' : 'First Person'}
            </button>
            {selection.kind !== 'none' && selection.ids.length > 0 ? (
              <button data-testid="focus-selection-3d" type="button" onClick={handleFocusSelection}>
                Focus Selection
              </button>
            ) : null}
          </div>
          {fpArmed && !fpLocked ? (
            <div className="canvas-3d-overlay__hint">Click in the view to capture mouse. Esc to release.</div>
          ) : null}
          {fpLocked ? (
            <div className="canvas-3d-overlay__hint">WASD moves, mouse looks, Esc releases the camera.</div>
          ) : null}
        </div>
        <div className="canvas-3d-host" ref={containerRef} />
      </div>
    );
  },
);
