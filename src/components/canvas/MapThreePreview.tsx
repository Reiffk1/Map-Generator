import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { MapRecord } from '../../models/types';

const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const sizeRef = useRef({ width: 1280, height: 840 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, sizeRef };
};

function computeMapBounds(map: MapRecord) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

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

  if (!isFinite(minX)) {
    minX = 0;
    minZ = 0;
    maxX = 1000;
    maxZ = 1000;
  }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const span = Math.max(spanX, spanZ, 400);

  return { cx, cz, span, minX, minZ, maxX, maxZ };
}

export function MapThreePreview({ map }: { map: MapRecord }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const { ref: containerRef, sizeRef } = useElementSize<HTMLDivElement>();

  const preset = map.view.lightPreset;

  const lighting = useMemo(() => {
    if (preset === 'moonlit') {
      return {
        ambient: 0x2a3552,
        ambientIntensity: 0.35,
        dir: 0x7799cc,
        dirIntensity: 0.6,
        torch: 0x6688bb,
        torchIntensity: 0.4,
        emissive: 0x334466,
        emissiveIntensity: 0.03,
        fogColor: '#0a0e18',
      };
    }
    if (preset === 'neutral') {
      return {
        ambient: 0x888888,
        ambientIntensity: 0.5,
        dir: 0xcccccc,
        dirIntensity: 0.7,
        torch: 0xddccbb,
        torchIntensity: 0.5,
        emissive: 0x666655,
        emissiveIntensity: 0.02,
        fogColor: '#111114',
      };
    }
    return {
      ambient: 0x3d2211,
      ambientIntensity: 0.3,
      dir: 0xffcc88,
      dirIntensity: 0.45,
      torch: 0xff9944,
      torchIntensity: 0.8,
      emissive: 0x7a4422,
      emissiveIntensity: 0.04,
      fogColor: '#110c08',
    };
  }, [preset]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const bounds = computeMapBounds(map);
    const WALL_HEIGHT = 90;
    const FLOOR_SLAB_HEIGHT = 8;
    const CORRIDOR_SLAB_HEIGHT = 5;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lighting.fogColor);
    scene.fog = new THREE.FogExp2(lighting.fogColor, 0.0008);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
    const camDist = bounds.span * 1.3;
    const camHeight = bounds.span * 0.95;
    camera.position.set(bounds.cx + camDist * 0.7, camHeight, bounds.cz + camDist * 0.7);
    camera.lookAt(bounds.cx, 0, bounds.cz);

    // --- Materials ---
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1614,
      roughness: 0.95,
      metalness: 0.02,
    });

    const roomFloorMat = new THREE.MeshStandardMaterial({
      color: 0x6b5d50,
      roughness: 0.88,
      metalness: 0.03,
      emissive: lighting.emissive,
      emissiveIntensity: lighting.emissiveIntensity,
    });

    const corridorMat = new THREE.MeshStandardMaterial({
      color: 0x574a3e,
      roughness: 0.9,
      metalness: 0.02,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d3330,
      roughness: 0.92,
      metalness: 0.04,
    });

    const wallCapMat = new THREE.MeshStandardMaterial({
      color: 0x524540,
      roughness: 0.8,
      metalness: 0.05,
    });

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5c3d28,
      roughness: 0.6,
      metalness: 0.1,
    });

    const allMaterials = [groundMat, roomFloorMat, corridorMat, wallMat, wallCapMat, doorMat];

    // --- Ground plane ---
    const groundSize = bounds.span * 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(bounds.cx, -1, bounds.cz);
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Room floor slabs ---
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
        depth: FLOOR_SLAB_HEIGHT,
        bevelEnabled: true,
        bevelSize: 3,
        bevelThickness: 2,
        bevelSegments: 2,
      });
      const mesh = new THREE.Mesh(geo, roomFloorMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // --- Corridors as flat stone slabs ---
    for (const corridor of map.corridors) {
      const pts = corridor.points;
      const halfW = Math.max(corridor.width * 0.5, 8);

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) continue;

        const geo = new THREE.BoxGeometry(len + 4, CORRIDOR_SLAB_HEIGHT, halfW * 2);
        const mesh = new THREE.Mesh(geo, corridorMat);
        mesh.position.set(
          (a.x + b.x) / 2,
          CORRIDOR_SLAB_HEIGHT / 2,
          (a.y + b.y) / 2,
        );
        mesh.rotation.y = -Math.atan2(dy, dx);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }

    // --- Walls ---
    for (const wall of map.wallSegments) {
      const [start, end] = wall.points;
      if (!start || !end) continue;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;

      const thickness = Math.max(wall.thickness * 0.8, 12);

      const wallGeo = new THREE.BoxGeometry(len, WALL_HEIGHT, thickness);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(
        (start.x + end.x) / 2,
        WALL_HEIGHT / 2,
        (start.y + end.y) / 2,
      );
      wallMesh.rotation.y = -Math.atan2(dy, dx);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);

      const capGeo = new THREE.BoxGeometry(len + 4, 4, thickness + 4);
      const capMesh = new THREE.Mesh(capGeo, wallCapMat);
      capMesh.position.set(
        (start.x + end.x) / 2,
        WALL_HEIGHT + 2,
        (start.y + end.y) / 2,
      );
      capMesh.rotation.y = -Math.atan2(dy, dx);
      capMesh.castShadow = true;
      scene.add(capMesh);
    }

    // --- Doorways (frame: two posts + lintel) ---
    const DOOR_WIDTH = 36;
    const DOOR_HEIGHT = 70;
    const POST_THICKNESS = 8;

    for (const door of map.doorways) {
      const group = new THREE.Group();
      const isNS = door.orientation === 'north' || door.orientation === 'south';

      const leftPost = new THREE.Mesh(
        new THREE.BoxGeometry(POST_THICKNESS, DOOR_HEIGHT, POST_THICKNESS),
        doorMat,
      );
      leftPost.position.set(isNS ? -DOOR_WIDTH / 2 : 0, DOOR_HEIGHT / 2, isNS ? 0 : -DOOR_WIDTH / 2);
      leftPost.castShadow = true;
      leftPost.receiveShadow = true;

      const rightPost = new THREE.Mesh(
        new THREE.BoxGeometry(POST_THICKNESS, DOOR_HEIGHT, POST_THICKNESS),
        doorMat,
      );
      rightPost.position.set(isNS ? DOOR_WIDTH / 2 : 0, DOOR_HEIGHT / 2, isNS ? 0 : DOOR_WIDTH / 2);
      rightPost.castShadow = true;
      rightPost.receiveShadow = true;

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(
          isNS ? DOOR_WIDTH + POST_THICKNESS * 2 : POST_THICKNESS,
          POST_THICKNESS,
          isNS ? POST_THICKNESS : DOOR_WIDTH + POST_THICKNESS * 2,
        ),
        doorMat,
      );
      lintel.position.y = DOOR_HEIGHT + POST_THICKNESS / 2;
      lintel.castShadow = true;

      group.add(leftPost, rightPost, lintel);
      group.position.set(door.position.x, 0, door.position.y);
      scene.add(group);
    }

    // --- Marker glow lights ---
    for (const marker of map.markers) {
      const color =
        marker.markerType === 'hazard'
          ? 0xff4433
          : marker.markerType === 'loot'
            ? 0xffdd44
            : marker.markerType === 'secret'
              ? 0xaa66ff
              : marker.markerType === 'save'
                ? 0x44ddff
                : 0xffb46a;
      const glow = new THREE.PointLight(color, 0.5, 200);
      glow.position.set(marker.position.x, 40, marker.position.y);
      scene.add(glow);
    }

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(lighting.ambient, lighting.ambientIntensity);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(lighting.dir, lighting.dirIntensity);
    dirLight.position.set(bounds.cx - bounds.span * 0.5, bounds.span * 1.2, bounds.cz - bounds.span * 0.3);
    dirLight.target.position.set(bounds.cx, 0, bounds.cz);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    const shadowExtent = bounds.span * 0.8;
    dirLight.shadow.camera.left = -shadowExtent;
    dirLight.shadow.camera.right = shadowExtent;
    dirLight.shadow.camera.top = shadowExtent;
    dirLight.shadow.camera.bottom = -shadowExtent;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = bounds.span * 3;
    dirLight.shadow.bias = -0.002;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const torchLights: THREE.PointLight[] = [];
    for (const room of map.floorRooms) {
      const rx = room.bounds.x + room.bounds.width / 2;
      const rz = room.bounds.y + room.bounds.height / 2;
      const torchRange = Math.max(room.bounds.width, room.bounds.height) * 2.5;
      const torch = new THREE.PointLight(lighting.torch, lighting.torchIntensity, torchRange);
      torch.position.set(rx, 50, rz);
      torch.castShadow = false;
      scene.add(torch);
      torchLights.push(torch);
    }

    // --- Resize handler ---
    const resize = () => {
      const width = Math.max(320, sizeRef.current.width || host.clientWidth);
      const height = Math.max(280, sizeRef.current.height || host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    // --- Animate ---
    const clock = new THREE.Clock();
    const orbitRadius = camDist;
    const baseAngle = Math.atan2(
      camera.position.z - bounds.cz,
      camera.position.x - bounds.cx,
    );

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const angle = baseAngle + t * 0.04;
      camera.position.x = bounds.cx + Math.cos(angle) * orbitRadius * 0.7;
      camera.position.z = bounds.cz + Math.sin(angle) * orbitRadius * 0.7;
      camera.lookAt(bounds.cx, 0, bounds.cz);

      for (let i = 0; i < torchLights.length; i++) {
        const base = lighting.torchIntensity;
        const flicker =
          Math.sin(t * 3.7 + i * 1.3) * 0.08 +
          Math.sin(t * 7.1 + i * 2.7) * 0.05 +
          Math.sin(t * 11.3 + i * 0.9) * 0.03;
        torchLights[i].intensity = base + flicker;
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- Cleanup ---
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
        if (obj instanceof THREE.Light && 'shadow' in obj) {
          const shadowLight = obj as THREE.DirectionalLight;
          shadowLight.shadow?.map?.dispose();
        }
      });
      for (const mat of allMaterials) mat.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [containerRef, lighting, map.corridors, map.doorways, map.floorRooms, map.markers, map.wallSegments, sizeRef]);

  return (
    <div className="canvas-shell canvas-shell--3d" data-testid="map-3d-canvas" ref={rootRef}>
      <div className="canvas-3d-overlay">
        <strong>Cinematic Preview</strong>
        <span>Three.js 3D dungeon render (read-only preview)</span>
      </div>
      <div className="canvas-3d-host" ref={containerRef} />
    </div>
  );
}
