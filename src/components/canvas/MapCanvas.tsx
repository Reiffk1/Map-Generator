import {
  useCallback,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { Arc, Circle, Group, Image as KonvaImage, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import useImage from 'use-image';

import { builtInIconLibrary, type IconPalette, type IconPrimitive } from '../../data/iconLibrary';
import { TileCanvasLayer } from './TileCanvasLayer';
import { getMapContentBounds, snapDoorwayToFloorplan } from '../../lib/floorplan';
import { clamp } from '../../lib/utils';
import type {
  MapRecord,
  Point,
  ProjectRecord,
  TransitionRecord,
} from '../../models/types';
import { useAppStore } from '../../store/useAppStore';

const virtualSize = { width: 2400, height: 1800 };
const iconPalette: IconPalette = {
  ink: '#12090b',
  fill: '#f0e4d3',
  accent: '#cf313f',
  muted: '#8f6a67',
};

const surfacePalette: Record<
  MapRecord['view']['floorSurfaceStyle'],
  {
    stage: string;
    backdrop: string;
    roomBase: string;
    roomInset: string;
    corridorFill: string;
    corridorEdge: string;
    corridorCenter: string;
    wallHighlight: string;
    label: string;
    labelMuted: string;
    grid: string;
  }
> = {
  stonekeep: {
    stage: '#0a0a0b',
    backdrop: '#1a1614',
    roomBase: '#3d3530',
    roomInset: '#4a4038',
    corridorFill: '#342e28',
    corridorEdge: '#2a2420',
    corridorCenter: 'rgba(20, 16, 12, 0.4)',
    wallHighlight: 'rgba(255, 200, 160, 0.12)',
    label: '#ddd4c8',
    labelMuted: '#9a8e80',
    grid: 'rgba(255, 200, 160, 0.06)',
  },
  parchment_blueprint: {
    stage: '#0b0a09',
    backdrop: '#1c1814',
    roomBase: '#403832',
    roomInset: '#4d443c',
    corridorFill: '#38302a',
    corridorEdge: '#2c2620',
    corridorCenter: 'rgba(22, 18, 14, 0.38)',
    wallHighlight: 'rgba(255, 210, 170, 0.10)',
    label: '#e0d6ca',
    labelMuted: '#9c9084',
    grid: 'rgba(255, 210, 170, 0.05)',
  },
  pixel_dungeon: {
    stage: '#08080a',
    backdrop: '#181412',
    roomBase: '#3a322c',
    roomInset: '#483e36',
    corridorFill: '#302a24',
    corridorEdge: '#26201a',
    corridorCenter: 'rgba(18, 14, 10, 0.42)',
    wallHighlight: 'rgba(255, 190, 140, 0.14)',
    label: '#dad0c4',
    labelMuted: '#968a7c',
    grid: 'rgba(255, 190, 140, 0.07)',
  },
};

const wallPalette: Record<MapRecord['view']['wallStyle'], string> = {
  stone: '#1e1816',
  brick: '#2a201c',
  ruin: '#3a322c',
};

const selectionStroke = '#b99556';
const transitionBadgeOffset: Record<string, Point> = {
  north: { x: 0, y: -28 },
  south: { x: 0, y: 28 },
  east: { x: 28, y: 0 },
  west: { x: -28, y: 0 },
};
const doorwayRotation: Record<string, number> = {
  east: 0,
  south: 90,
  west: 180,
  north: 270,
};

const transitionIcon: Record<TransitionRecord['transitionType'], string> = {
  door: 'door',
  stairs_up: 'stairs-up',
  stairs_down: 'stairs-down',
  ladder: 'ladder',
  elevator: 'shortcut',
  warp: 'warp',
  hole: 'uncertain-route',
  gate: 'gate',
  tunnel: 'breakable-wall',
  bridge: 'shortcut',
  window_exit: 'one-way-door',
  trapdoor: 'secret-door',
};

const boardMargin = 92;
const dungeonTextures = {
  stonekeep: {
    room: '/assets/dungeon-core/stonekeep-room.svg',
    corridor: '/assets/dungeon-core/stonekeep-corridor.svg',
  },
  parchment_blueprint: {
    room: '/assets/dungeon-core/parchment-room.svg',
    corridor: '/assets/dungeon-core/parchment-corridor.svg',
  },
  pixel_dungeon: {
    room: '/assets/dungeon-core/pixel-room.svg',
    corridor: '/assets/dungeon-core/pixel-corridor.svg',
  },
} as const;

const createPatternImage = (
  colors: { base: string; accent: string; crack?: string },
  options: { pixel?: boolean } = {},
) => {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  context.fillStyle = colors.base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const step = options.pixel ? 16 : 32;
  context.strokeStyle = colors.accent;
  context.globalAlpha = 0.25;
  context.lineWidth = options.pixel ? 1.5 : 1;
  for (let x = 0; x <= canvas.width; x += step) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.globalAlpha = 0.08;
  context.fillStyle = colors.accent;
  for (let gx = 0; gx < canvas.width; gx += step) {
    for (let gy = 0; gy < canvas.height; gy += step) {
      const shade = ((gx * 7 + gy * 13) % 5) * 0.02;
      context.globalAlpha = 0.04 + shade;
      context.fillRect(gx + 1, gy + 1, step - 2, step - 2);
    }
  }

  if (colors.crack) {
    context.globalAlpha = 0.18;
    context.strokeStyle = colors.crack;
    context.lineWidth = options.pixel ? 1.2 : 0.8;
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      const sx = 8 + ((index * 17) % 80);
      const sy = 4 + ((index * 23) % 80);
      context.moveTo(sx, sy);
      context.lineTo(sx + 8 + (index % 3) * 4, sy + 6 + (index % 2) * 5);
      context.lineTo(sx + 3 + (index % 4) * 3, sy + 14 + (index % 3) * 4);
      context.stroke();
    }
  }

  return canvas;
};

export interface MapCanvasHandle {
  toDataUrl: () => string | undefined;
  fitToMap: () => void;
  fitSelection: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

const getTone = (tone: IconPrimitive['fill'] | IconPrimitive['stroke']) => {
  switch (tone) {
    case 'ink':
      return iconPalette.ink;
    case 'fill':
      return iconPalette.fill;
    case 'accent':
      return iconPalette.accent;
    case 'muted':
      return iconPalette.muted;
    case 'none':
      return 'transparent';
    default:
      return undefined;
  }
};

const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 1280, height: 840 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
};

const CanvasVectorIcon = ({ iconId, x, y, size }: { iconId: string; x: number; y: number; size: number }) => {
  const icon = builtInIconLibrary.find((entry) => entry.id === iconId);
  if (!icon) return null;

  const scale = size / 24;
  return (
    <Group x={x - size / 2} y={y - size / 2} scaleX={scale} scaleY={scale}>
      {icon.primitives.map((primitive, index) => {
        if (primitive.kind === 'path') {
          return (
            <Path
              key={`${icon.id}_${index}`}
              data={primitive.d}
              fill={getTone(primitive.fill) ?? 'transparent'}
              opacity={primitive.opacity}
              stroke={getTone(primitive.stroke)}
              strokeWidth={primitive.strokeWidth}
            />
          );
        }

        if (primitive.kind === 'circle') {
          return (
            <Circle
              key={`${icon.id}_${index}`}
              x={primitive.cx}
              y={primitive.cy}
              radius={primitive.r}
              fill={getTone(primitive.fill) ?? 'transparent'}
              opacity={primitive.opacity}
              stroke={getTone(primitive.stroke)}
              strokeWidth={primitive.strokeWidth}
            />
          );
        }

        if (primitive.kind === 'rect') {
          return (
            <Rect
              key={`${icon.id}_${index}`}
              x={primitive.x}
              y={primitive.y}
              width={primitive.width}
              height={primitive.height}
              cornerRadius={primitive.rx}
              fill={getTone(primitive.fill) ?? 'transparent'}
              opacity={primitive.opacity}
              stroke={getTone(primitive.stroke)}
              strokeWidth={primitive.strokeWidth}
            />
          );
        }

        return (
          <Line
            key={`${icon.id}_${index}`}
            points={primitive.points}
            closed={primitive.closed}
            fill={primitive.closed ? getTone(primitive.fill) ?? 'transparent' : 'transparent'}
            opacity={primitive.opacity}
            stroke={getTone(primitive.stroke)}
            strokeWidth={primitive.strokeWidth}
            dash={primitive.dash}
            lineCap="round"
            lineJoin="round"
          />
        );
      })}
    </Group>
  );
};

const buildOrthogonal = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) > Math.abs(end.y - start.y)
    ? [start, { x: end.x, y: start.y }, end]
    : [start, { x: start.x, y: end.y }, end];

const snapPoint = (point: Point, map: MapRecord) => {
  if (!map.view.snapToGrid) return point;
  const gridSize = map.view.gridSize || 48;
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
};

const layerVisibleForPreset = (map: MapRecord, type: string) => {
  const visible = map.layers.find((layer) => layer.type === type)?.visible ?? true;
  if (!visible) return false;
  if (map.view.overlayPreset === 'links' && ['terrain', 'icons', 'notes'].includes(type)) return false;
  return true;
};

const MiniNavigator = ({ map }: { map: MapRecord }) => {
  const bounds = getMapContentBounds(map);
  const padding = 120;
  const viewBox = `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;

  return (
    <div className="canvas-minimap">
      <div className="canvas-minimap__label">
        <span>Navigator</span>
        <span>{map.floorRooms.length} rooms</span>
      </div>
      <svg viewBox={viewBox}>
        <rect
          x={bounds.x - padding}
          y={bounds.y - padding}
          width={bounds.width + padding * 2}
          height={bounds.height + padding * 2}
          rx={40}
          fill="#15191e"
          stroke="#584d3b"
          strokeWidth={16}
        />
        {map.corridors.map((corridor) => (
          <polyline
            key={corridor.id}
            points={corridor.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="#d8cab5"
            strokeWidth={corridor.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.58}
          />
        ))}
        {map.floorRooms.map((room) => (
          <rect
            key={room.id}
            x={room.bounds.x}
            y={room.bounds.y}
            width={room.bounds.width}
            height={room.bounds.height}
            rx={26}
            fill={room.color}
            opacity={0.92}
          />
        ))}
      </svg>
    </div>
  );
};

export const MapCanvas = forwardRef<MapCanvasHandle, { project: ProjectRecord; map: MapRecord }>(
  function MapCanvas({ map }, ref) {
    const stageRef = useRef<Konva.Stage | null>(null);
    const grainRef = useRef<Konva.Rect | null>(null);
    const fittedMapsRef = useRef<Set<string>>(new Set());
    const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
    const [backgroundImage] = useImage(map.background?.src ?? '', 'anonymous');
    const [stonekeepRoomImage] = useImage(dungeonTextures.stonekeep.room, 'anonymous');
    const [stonekeepCorridorImage] = useImage(dungeonTextures.stonekeep.corridor, 'anonymous');
    const [parchmentRoomImage] = useImage(dungeonTextures.parchment_blueprint.room, 'anonymous');
    const [parchmentCorridorImage] = useImage(dungeonTextures.parchment_blueprint.corridor, 'anonymous');
    const [pixelRoomImage] = useImage(dungeonTextures.pixel_dungeon.room, 'anonymous');
    const [pixelCorridorImage] = useImage(dungeonTextures.pixel_dungeon.corridor, 'anonymous');
    const [draftRect, setDraftRect] = useState<{ start: Point; current: Point } | null>(null);
    const [draftPath, setDraftPath] = useState<Point[]>([]);
    const [draftKind, setDraftKind] = useState<'corridor' | 'wall' | 'route' | 'sketch' | null>(null);

    const editorMode = useAppStore((state) => state.editorMode);
    const activeTool = useAppStore((state) => state.activeTool);
    const toolSettings = useAppStore((state) => state.toolSettings);
    const selection = useAppStore((state) => state.selection);
    const focusAnchorId = useAppStore((state) => state.focusAnchorId);
    const highlightedTransitionId = useAppStore((state) => state.highlightedTransitionId);
    const addFloorRoom = useAppStore((state) => state.addFloorRoom);
    const addCorridor = useAppStore((state) => state.addCorridor);
    const addWall = useAppStore((state) => state.addWall);
    const addDoorwayAt = useAppStore((state) => state.addDoorwayAt);
    const addMarkerAt = useAppStore((state) => state.addMarkerAt);
    const addNoteAt = useAppStore((state) => state.addNoteAt);
    const addAnchorAt = useAppStore((state) => state.addAnchorAt);
    const addRouteOverlay = useAppStore((state) => state.addRouteOverlay);
    const addSketchStroke = useAppStore((state) => state.addSketchStroke);
    const setSelection = useAppStore((state) => state.setSelection);
    const updateMapView = useAppStore((state) => state.updateMapView);
    const moveEntity = useAppStore((state) => state.moveEntity);
    const deleteEntity = useAppStore((state) => state.deleteEntity);
    const openMap = useAppStore((state) => state.openMap);

    const roomPattern = useMemo(() => {
      if (map.view.floorSurfaceStyle === 'parchment_blueprint') {
        return createPatternImage({ base: '#f2e7d2', accent: '#d1bea3', crack: '#9e8a6f' });
      }
      if (map.view.floorSurfaceStyle === 'pixel_dungeon') {
        return createPatternImage({ base: '#dac9af', accent: '#9b8a74', crack: '#7a6c5a' }, { pixel: true });
      }
      return createPatternImage({ base: '#e6d8c2', accent: '#b8a88e', crack: '#8f7f68' });
    }, [map.view.floorSurfaceStyle]);

    const corridorPattern = useMemo(() => {
      if (map.view.floorSurfaceStyle === 'parchment_blueprint') {
        return createPatternImage({ base: '#dcccb1', accent: '#beab8f' });
      }
      if (map.view.floorSurfaceStyle === 'pixel_dungeon') {
        return createPatternImage({ base: '#b8a68e', accent: '#8b7a64' }, { pixel: true });
      }
      return createPatternImage({ base: '#cab89d', accent: '#9f8b72' });
    }, [map.view.floorSurfaceStyle]);
    const roomPatternData = useMemo(() => roomPattern.toDataURL(), [roomPattern]);
    const corridorPatternData = useMemo(() => corridorPattern.toDataURL(), [corridorPattern]);
    const [roomPatternImage] = useImage(roomPatternData);
    const [corridorPatternImage] = useImage(corridorPatternData);
    const skinRoomTexture = useMemo(() => {
      if (map.view.floorSurfaceStyle === 'parchment_blueprint') return parchmentRoomImage;
      if (map.view.floorSurfaceStyle === 'pixel_dungeon') return pixelRoomImage;
      return stonekeepRoomImage;
    }, [map.view.floorSurfaceStyle, parchmentRoomImage, pixelRoomImage, stonekeepRoomImage]);
    const skinCorridorTexture = useMemo(() => {
      if (map.view.floorSurfaceStyle === 'parchment_blueprint') return parchmentCorridorImage;
      if (map.view.floorSurfaceStyle === 'pixel_dungeon') return pixelCorridorImage;
      return stonekeepCorridorImage;
    }, [map.view.floorSurfaceStyle, parchmentCorridorImage, pixelCorridorImage, stonekeepCorridorImage]);

    const applyZoom = (nextZoom: number) => {
      const centerWorld = {
        x: (size.width / 2 - map.view.pan.x) / map.view.zoom,
        y: (size.height / 2 - map.view.pan.y) / map.view.zoom,
      };
      updateMapView({
        zoom: nextZoom,
        pan: {
          x: size.width / 2 - centerWorld.x * nextZoom,
          y: size.height / 2 - centerWorld.y * nextZoom,
        },
      });
    };

    const fitToMap = useCallback((preserveAuto = false) => {
      if (!size.width || !size.height) return;
      const bounds = getMapContentBounds(map);
      const padding = 120;
      const nextZoom = clamp(
        Math.min((size.width - padding * 2) / bounds.width, (size.height - padding * 2) / bounds.height),
        0.32,
        2.5,
      );
      updateMapView({
        zoom: nextZoom,
        pan: {
          x: (size.width - bounds.width * nextZoom) / 2 - bounds.x * nextZoom,
          y: (size.height - bounds.height * nextZoom) / 2 - bounds.y * nextZoom,
        },
        hasUserAdjusted: preserveAuto ? false : true,
      });
    }, [map, size.height, size.width, updateMapView]);

    const fitSelection = useCallback(() => {
      if (!size.width || !size.height) return;
      if (selection.kind === 'none') return;
      const ids = 'ids' in selection ? selection.ids : [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const expand = (x: number, y: number, w: number, h: number) => {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
      };
      for (const id of ids) {
        const room = map.floorRooms.find((r) => r.id === id);
        if (room) { expand(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height); continue; }
        const corridor = map.corridors.find((c) => c.id === id);
        if (corridor) { for (const p of corridor.points) expand(p.x - corridor.width, p.y - corridor.width, corridor.width * 2, corridor.width * 2); continue; }
        const door = map.doorways.find((d) => d.id === id);
        if (door) { expand(door.position.x - 30, door.position.y - 30, 60, 60); continue; }
        const marker = map.markers.find((m) => m.id === id);
        if (marker) { expand(marker.position.x - 20, marker.position.y - 20, 40, 40); continue; }
        const note = map.notesBoard.find((n) => n.id === id);
        if (note) { expand(note.position.x - 40, note.position.y - 20, 200, 80); continue; }
        const trans = map.transitions.find((t) => t.id === id);
        if (trans) { expand(trans.position.x - 30, trans.position.y - 30, 60, 60); }
      }
      if (!isFinite(minX)) return;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const padding = 80;
      const nextZoom = clamp(Math.min((size.width - padding * 2) / bw, (size.height - padding * 2) / bh), 0.32, 3);
      updateMapView({
        zoom: nextZoom,
        pan: { x: (size.width - bw * nextZoom) / 2 - minX * nextZoom, y: (size.height - bh * nextZoom) / 2 - minY * nextZoom },
        hasUserAdjusted: true,
      });
    }, [map, selection, size.width, size.height, updateMapView]);

    useImperativeHandle(ref, () => ({
      toDataUrl: () => stageRef.current?.toDataURL({ pixelRatio: 2 }),
      fitToMap,
      fitSelection,
      zoomIn: () => applyZoom(clamp(map.view.zoom * 1.12, 0.32, 3)),
      zoomOut: () => applyZoom(clamp(map.view.zoom / 1.12, 0.32, 3)),
    }));

    useEffect(() => {
      if (!focusAnchorId || size.width === 0 || size.height === 0) return;
      const anchor = map.anchors.find((entry) => entry.id === focusAnchorId);
      if (!anchor) return;
      const nextPan = {
        x: size.width / 2 - anchor.position.x * map.view.zoom,
        y: size.height / 2 - anchor.position.y * map.view.zoom,
      };
      if (
        Math.abs(nextPan.x - map.view.pan.x) < 0.5 &&
        Math.abs(nextPan.y - map.view.pan.y) < 0.5
      ) {
        return;
      }
      updateMapView({
        pan: nextPan,
      });
    }, [focusAnchorId, map.anchors, map.view.pan.x, map.view.pan.y, map.view.zoom, size.height, size.width, updateMapView]);

    useEffect(() => {
      if (!size.width || !size.height) return;
      if (fittedMapsRef.current.has(map.id)) return;
      if (map.view.hasUserAdjusted) {
        fittedMapsRef.current.add(map.id);
        return;
      }
      if (map.view.zoom !== 1 || map.view.pan.x !== 0 || map.view.pan.y !== 0) {
        fittedMapsRef.current.add(map.id);
        return;
      }
      updateMapView({ hasUserAdjusted: false });
      fitToMap(true);
      fittedMapsRef.current.add(map.id);
    }, [fitToMap, map.id, map.view.hasUserAdjusted, map.view.pan.x, map.view.pan.y, map.view.zoom, size.height, size.width, updateMapView]);

    useEffect(() => {
      const node = grainRef.current;
      if (!node) return;
      node.cache({ pixelRatio: 1 });
      node.filters([Konva.Filters.Noise]);
      node.noise(0.16);
      node.getLayer()?.batchDraw();
    }, [map.id, map.view.floorSurfaceStyle]);

    const getWorldPosition = () => {
      const stage = stageRef.current;
      if (!stage) return undefined;
      const pointer = stage.getPointerPosition();
      if (!pointer) return undefined;
      const transform = stage.getAbsoluteTransform().copy().invert();
      return snapPoint(transform.point(pointer), map);
    };

    const entityOpacity = (state: string) =>
      map.view.dimUnknown && (state === 'unknown' || state === 'suspected') ? 0.55 : 1;

    const startDraft = (kind: typeof draftKind, point: Point) => {
      setDraftKind(kind);
      setDraftPath([point]);
    };

    const handleEntitySelection = (
      kind: Exclude<typeof selection.kind, 'none' | 'path' | 'zone'>,
      id: string,
      options?: { destinationMapId?: string; destinationAnchorId?: string },
    ) => (event?: KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'erase') {
        if (kind === 'wall' && toolSettings.eraseMode === 'entity') {
          const roomMatch = id.match(/(.+)_(n|e|s|w)$/);
          if (roomMatch && map.floorRooms.some((room) => room.id === roomMatch[1])) {
            deleteEntity('floor_room', roomMatch[1]);
            return;
          }
        }
        deleteEntity(kind, id);
        return;
      }

      if (editorMode === 'navigate' && options?.destinationMapId) {
        openMap(options.destinationMapId, { anchorId: options.destinationAnchorId, highlightedTransitionId: id });
        return;
      }

      setSelection({ kind, ids: [id] }, Boolean(event?.evt.shiftKey));
    };

    const stageMouseDown = (event: KonvaEventObject<MouseEvent>) => {
      const isBlank = event.target === event.target.getStage();
      const position = getWorldPosition();
      if (!position) return;

      if (activeTool === 'doorway') {
        const snapped = snapDoorwayToFloorplan(position, map);
        addDoorwayAt(snapped.position, snapped.orientation);
        return;
      }

      if (activeTool === 'marker') {
        addMarkerAt(position);
        return;
      }

      if (activeTool === 'note') {
        addNoteAt(position);
        return;
      }

      if (activeTool === 'anchor') {
        addAnchorAt(position);
        return;
      }

      if (activeTool === 'corridor') {
        startDraft('corridor', position);
        return;
      }

      if (activeTool === 'wall') {
        startDraft('wall', position);
        return;
      }

      if (activeTool === 'route') {
        startDraft('route', position);
        return;
      }

      if (activeTool === 'sketch') {
        startDraft('sketch', position);
        return;
      }

      if (!isBlank) return;

      if (activeTool === 'floorRoom') {
        if (toolSettings.roomPlacement === 'stamp') {
          addFloorRoom({
            x: position.x - 120,
            y: position.y - 84,
            width: 240,
            height: 168,
          });
          return;
        }
        setDraftRect({ start: position, current: position });
        return;
      }

      if (activeTool === 'select' || activeTool === 'erase') setSelection({ kind: 'none', ids: [] });
    };

    const stageMouseMove = () => {
      const position = getWorldPosition();
      if (!position) return;

      if (draftRect) {
        setDraftRect((current) => (current ? { ...current, current: position } : current));
        return;
      }

      if (!draftKind || draftPath.length === 0) return;

      const start = draftPath[0];
      if (draftKind === 'corridor' || draftKind === 'wall') {
        setDraftPath(buildOrthogonal(start, position));
        return;
      }

      setDraftPath((current) => [...current, position]);
    };

    const stageMouseUp = () => {
      if (draftRect) {
        const x = Math.min(draftRect.start.x, draftRect.current.x);
        const y = Math.min(draftRect.start.y, draftRect.current.y);
        const width = Math.max(120, Math.abs(draftRect.current.x - draftRect.start.x));
        const height = Math.max(120, Math.abs(draftRect.current.y - draftRect.start.y));
        addFloorRoom({ x, y, width, height });
        setDraftRect(null);
      }

      if (draftKind && draftPath.length > 1) {
        if (draftKind === 'corridor') addCorridor(draftPath);
        if (draftKind === 'wall') addWall(draftPath);
        if (draftKind === 'route') addRouteOverlay(draftPath);
        if (draftKind === 'sketch') addSketchStroke(draftPath);
      }

      setDraftKind(null);
      setDraftPath([]);
    };

    const onWheel = (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = map.view.zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scaleBy = 1.08;
      const nextZoom = clamp(event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy, 0.32, 3);
      const mousePointTo = {
        x: (pointer.x - map.view.pan.x) / oldScale,
        y: (pointer.y - map.view.pan.y) / oldScale,
      };
      updateMapView({
        zoom: nextZoom,
        pan: {
          x: pointer.x - mousePointTo.x * nextZoom,
          y: pointer.y - mousePointTo.y * nextZoom,
        },
      });
    };

    const currentHint = useMemo(() => {
      if (activeTool === 'floorRoom') {
        return toolSettings.roomPlacement === 'stamp'
          ? 'Click once to stamp a quick chamber.'
          : 'Click-drag to block out a room footprint.';
      }
      if (activeTool === 'corridor') return 'Drag an orthogonal hallway between connected spaces.';
      if (activeTool === 'doorway') return 'Click near a room or corridor edge to place a doorway.';
      if (activeTool === 'marker') return 'Drop hazard, loot, secret, or save markers over the floorplan.';
      if (activeTool === 'route') return 'Paint a red route overlay to mark confirmed exploration paths.';
      if (activeTool === 'sketch') return 'Freehand red-ink markup for theory crafting and route notes.';
      if (activeTool === 'erase') {
        return toolSettings.eraseMode === 'segment'
          ? 'Click specific segments and primitives to remove them.'
          : 'Click any object (or room wall) to remove the whole entity.';
      }
      if (editorMode === 'navigate') return 'Use linked doorway hotspots to jump between maps.';
      return 'Select, pan, inspect, and annotate the active floorplan.';
    }, [activeTool, editorMode, toolSettings.eraseMode, toolSettings.roomPlacement]);

    const showHotspots = activeTool === 'select' || editorMode === 'navigate';
    const surfaceStyle = surfacePalette[map.view.floorSurfaceStyle];
    const wallTone = wallPalette[map.view.wallStyle];

    const doorwayStroke = (doorway: MapRecord['doorways'][number], isSelected: boolean) => {
      if (isSelected) return selectionStroke;
      if (doorway.doorwayState === 'locked') return '#8a5a3a';
      if (doorway.doorwayState === 'hidden' || doorway.doorwayState === 'suspected') return '#6e5040';
      return '#5c3d28';
    };

    const doorwayLabelPosition = (orientation: MapRecord['doorways'][number]['orientation']) => {
      if (orientation === 'north') return { x: -48, y: -38 };
      if (orientation === 'south') return { x: -48, y: 18 };
      if (orientation === 'west') return { x: -92, y: -10 };
      return { x: 18, y: -10 };
    };

    return (
      <div className="canvas-shell" data-testid="map-canvas" ref={containerRef}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={map.view.pan.x}
          y={map.view.pan.y}
          scaleX={map.view.zoom}
          scaleY={map.view.zoom}
          draggable={activeTool === 'select' && draftKind === null && !draftRect}
          onDragEnd={(event) => updateMapView({ pan: { x: event.target.x(), y: event.target.y() } })}
          onMouseDown={stageMouseDown}
          onMouseMove={stageMouseMove}
          onMouseUp={stageMouseUp}
          onWheel={onWheel}
        >
          <Layer listening={false}>
            <Rect x={0} y={0} width={virtualSize.width} height={virtualSize.height} fill={surfaceStyle.stage} />
            <Rect
              x={boardMargin}
              y={boardMargin}
              width={virtualSize.width - boardMargin * 2}
              height={virtualSize.height - boardMargin * 2}
              cornerRadius={48}
              fill={surfaceStyle.backdrop}
              opacity={0.99}
              stroke="rgba(255, 200, 160, 0.06)"
              strokeWidth={2}
              shadowBlur={32}
              shadowColor="rgba(0, 0, 0, 0.5)"
            />
            {backgroundImage && map.background ? (
              <KonvaImage
                image={backgroundImage}
                x={boardMargin}
                y={boardMargin}
                width={virtualSize.width - boardMargin * 2}
                height={virtualSize.height - boardMargin * 2}
                opacity={map.background.opacity}
              />
            ) : null}
            {map.view.showGrid
              ? Array.from({ length: Math.ceil((virtualSize.width - boardMargin * 2) / map.view.gridSize) + 1 }).map((_, index) => (
                  <Line
                    key={`grid_v_${index}`}
                    points={[
                      boardMargin + index * map.view.gridSize,
                      boardMargin,
                      boardMargin + index * map.view.gridSize,
                      virtualSize.height - boardMargin,
                    ]}
                    stroke={surfaceStyle.grid}
                    strokeWidth={1}
                  />
                ))
              : null}
            {map.view.showGrid
              ? Array.from({ length: Math.ceil((virtualSize.height - boardMargin * 2) / map.view.gridSize) + 1 }).map((_, index) => (
                  <Line
                    key={`grid_h_${index}`}
                    points={[
                      boardMargin,
                      boardMargin + index * map.view.gridSize,
                      virtualSize.width - boardMargin,
                      boardMargin + index * map.view.gridSize,
                    ]}
                    stroke={surfaceStyle.grid}
                    strokeWidth={1}
                  />
                ))
              : null}
            <Rect
              ref={grainRef}
              x={boardMargin}
              y={boardMargin}
              width={virtualSize.width - boardMargin * 2}
              height={virtualSize.height - boardMargin * 2}
              cornerRadius={48}
              fill="rgba(0,0,0,0.12)"
              opacity={map.view.floorSurfaceStyle === 'pixel_dungeon' ? 0.18 : 0.1}
            />
          </Layer>

          {map.tileGrid && map.view.renderStyle2d === 'tile' ? (
            <Layer listening={false}>
              <TileCanvasLayer
                grid={map.tileGrid}
                packId={map.view.assetPackId}
                viewportWidth={size.width}
                viewportHeight={size.height}
                zoom={map.view.zoom}
                panX={map.view.pan.x}
                panY={map.view.pan.y}
              />
            </Layer>
          ) : null}

          <Layer>
            {layerVisibleForPreset(map, 'paths')
              ? map.corridors.map((corridor) => {
                  const isSelected = selection.kind === 'corridor' && selection.ids.includes(corridor.id);
                  const isTileMode = map.view.renderStyle2d === 'tile' && !!map.tileGrid;
                  return (
                  <Group key={corridor.id} onClick={handleEntitySelection('corridor', corridor.id)} opacity={isTileMode && !isSelected ? 0.12 : 1}>
                    {isSelected ? (
                      <Line
                        points={corridor.points.flatMap((point) => [point.x, point.y])}
                        stroke={selectionStroke}
                        strokeWidth={corridor.width + 28}
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.22}
                      />
                    ) : null}
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={wallTone}
                      strokeWidth={corridor.width + 28}
                      lineCap="round"
                      lineJoin="round"
                      opacity={1}
                    />
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorEdge}
                      strokeWidth={corridor.width + 14}
                      lineCap="round"
                      lineJoin="round"
                      opacity={0.85}
                    />
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorFill}
                      strokeWidth={Math.max(16, corridor.width - 6)}
                      lineCap="round"
                      lineJoin="round"
                      fillPatternImage={skinCorridorTexture ?? corridorPatternImage}
                      fillPatternRepeat="repeat"
                      opacity={entityOpacity(corridor.state)}
                    />
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorCenter}
                      strokeWidth={2}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                );
                })
              : null}

            {layerVisibleForPreset(map, 'rooms')
              ? map.floorRooms.map((room) => {
                  const isSelected = selection.kind === 'floor_room' && selection.ids.includes(room.id);
                  const isTileMode = map.view.renderStyle2d === 'tile' && !!map.tileGrid;
                  return (
                    <Group
                      draggable={editorMode !== 'navigate' && activeTool === 'select'}
                      key={room.id}
                      onClick={handleEntitySelection('floor_room', room.id)}
                      onDragEnd={(event) => moveEntity('floor_room', room.id, { x: event.target.x(), y: event.target.y() })}
                      x={room.bounds.x}
                      y={room.bounds.y}
                      opacity={isTileMode ? (isSelected ? 0.6 : 0.15) : 1}
                    >
                      {!isTileMode ? (
                        <>
                          <Rect
                            width={room.bounds.width}
                            height={room.bounds.height}
                            cornerRadius={room.roomShape === 'octagon' ? 36 : 24}
                            fillPatternImage={skinRoomTexture ?? roomPatternImage}
                            fillPatternRepeat="repeat"
                            fill={surfaceStyle.roomBase}
                            stroke={isSelected ? selectionStroke : wallTone}
                            strokeWidth={isSelected ? 6 : 7}
                            shadowBlur={isSelected ? 30 : 24}
                            shadowColor="rgba(0,0,0,0.55)"
                            opacity={entityOpacity(room.state)}
                          />
                          <Rect
                            x={8}
                            y={8}
                            width={room.bounds.width - 16}
                            height={room.bounds.height - 16}
                            cornerRadius={room.roomShape === 'octagon' ? 30 : 18}
                            fill={room.color}
                            opacity={0.15}
                          />
                        </>
                      ) : null}
                      <Rect
                        x={isTileMode ? 0 : 8}
                        y={isTileMode ? 0 : 8}
                        width={isTileMode ? room.bounds.width : room.bounds.width - 16}
                        height={isTileMode ? room.bounds.height : room.bounds.height - 16}
                        cornerRadius={room.roomShape === 'octagon' ? 30 : 18}
                        stroke={isSelected ? selectionStroke : (isTileMode ? 'rgba(255,255,255,0.2)' : surfaceStyle.roomInset)}
                        strokeWidth={isSelected ? 3 : 1.5}
                        opacity={isTileMode ? 1 : 0.4}
                      />
                      <Text x={18} y={16} text={room.label} fontFamily="Space Grotesk" fontSize={22} fontStyle="700" fill={isTileMode ? '#ffffff' : surfaceStyle.label} />
                      {room.subtitle ? (
                        <Text x={18} y={46} text={room.subtitle} fontFamily="Inter Tight" fontSize={13} fill={isTileMode ? '#cccccc' : surfaceStyle.labelMuted} />
                      ) : null}
                    </Group>
                  );
                })
              : null}

            {layerVisibleForPreset(map, 'rooms')
              ? map.wallSegments.map((wall) => (
                  <Group key={wall.id}>
                    <Line
                      points={wall.points.flatMap((point) => [point.x, point.y])}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={wall.thickness * 1.5 + 4}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Line
                      points={wall.points.flatMap((point) => [point.x, point.y])}
                      stroke={wallTone}
                      strokeWidth={wall.thickness * 1.5}
                      lineCap="round"
                      lineJoin="round"
                      onClick={() => {
                        if (activeTool !== 'erase') return;
                        if (toolSettings.eraseMode === 'entity') {
                          const roomMatch = wall.id.match(/(.+)_(n|e|s|w)$/);
                          if (roomMatch && map.floorRooms.some((room) => room.id === roomMatch[1])) {
                            deleteEntity('floor_room', roomMatch[1]);
                            return;
                          }
                        }
                        deleteEntity('wall', wall.id);
                      }}
                    />
                    <Line
                      points={wall.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.wallHighlight}
                      strokeWidth={Math.max(2, wall.thickness * 0.24)}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                ))
              : null}
          </Layer>

          <Layer>
            {layerVisibleForPreset(map, 'transitions')
              ? map.doorways.map((doorway) => {
                  const linked = doorway.transitionId ? map.transitions.find((entry) => entry.id === doorway.transitionId) : undefined;
                  const isSelected = selection.kind === 'doorway' && selection.ids.includes(doorway.id);
                  const stroke = doorwayStroke(doorway, isSelected);
                  const labelPosition = doorwayLabelPosition(doorway.orientation);
                  const badgeOffset = transitionBadgeOffset[doorway.orientation];
                  return (
                    <Group
                      draggable={editorMode !== 'navigate' && activeTool === 'select'}
                      key={doorway.id}
                      onClick={handleEntitySelection('doorway', doorway.id, {
                        destinationMapId: linked?.destinationMapId,
                        destinationAnchorId: linked?.destinationAnchorId,
                      })}
                      onDragEnd={(event) => moveEntity('doorway', doorway.id, { x: event.target.x(), y: event.target.y() })}
                      x={doorway.position.x}
                      y={doorway.position.y}
                    >
                      <Group rotation={doorwayRotation[doorway.orientation]}>
                        <Line
                          points={[-24, 0, 24, 0]}
                          stroke={surfaceStyle.roomBase}
                          strokeWidth={24}
                          lineCap="round"
                        />
                        <Line
                          points={[-22, 0, 22, 0]}
                          stroke={stroke}
                          strokeWidth={2.2}
                          lineCap="round"
                        />
                        {doorway.transitionType === 'door' ? (
                          <>
                            <Line
                              points={[-18, 0, 0, -18]}
                              stroke={stroke}
                              strokeWidth={2.2}
                              lineCap="round"
                            />
                            <Arc
                              x={-18}
                              y={0}
                              innerRadius={17}
                              outerRadius={18}
                              angle={90}
                              rotation={270}
                              stroke={stroke}
                              strokeWidth={1.3}
                            />
                          </>
                        ) : doorway.transitionType === 'gate' ? (
                          <Line
                            points={[-12, -8, -12, 8, 0, -8, 0, 8, 12, -8, 12, 8]}
                            stroke={stroke}
                            strokeWidth={1.7}
                            lineCap="round"
                            lineJoin="round"
                          />
                        ) : (
                          <Line
                            points={[-14, 0, 14, 0]}
                            stroke={stroke}
                            strokeWidth={1.8}
                            dash={[4, 4]}
                            lineCap="round"
                          />
                        )}
                      </Group>
                      {linked && doorway.transitionType !== 'door' ? (
                        <Group x={badgeOffset.x} y={badgeOffset.y}>
                          <Circle
                            radius={12}
                            fill="rgba(26, 30, 35, 0.92)"
                            stroke={isSelected ? selectionStroke : doorway.color}
                            strokeWidth={2}
                            shadowBlur={highlightedTransitionId === linked.id ? 12 : 0}
                            shadowColor={doorway.color}
                          />
                          <CanvasVectorIcon iconId={transitionIcon[doorway.transitionType]} size={14} x={0} y={0} />
                        </Group>
                      ) : null}
                      {map.view.showDoorLabels ? (
                        <Text
                          x={labelPosition.x}
                          y={labelPosition.y}
                          text={doorway.label}
                          fontFamily="IBM Plex Mono"
                          fontSize={11}
                          fill="#f5efe6"
                        />
                      ) : null}
                    </Group>
                  );
                })
              : null}

            {layerVisibleForPreset(map, 'transitions')
              ? map.transitions.map((transition) => {
                  if (transition.doorwayId && map.doorways.some((entry) => entry.id === transition.doorwayId)) {
                    return null;
                  }
                  const isSelected = selection.kind === 'transition' && selection.ids.includes(transition.id);
                  const isLinked = Boolean(transition.destinationMapId);
                  return (
                    <Group
                      key={transition.id}
                      x={transition.position.x}
                      y={transition.position.y}
                      onClick={handleEntitySelection('transition', transition.id, {
                        destinationMapId: transition.destinationMapId,
                        destinationAnchorId: transition.destinationAnchorId,
                      })}
                    >
                      <Circle
                        radius={14}
                        fill="rgba(26, 30, 35, 0.94)"
                        stroke={isSelected ? selectionStroke : transition.color}
                        strokeWidth={2.5}
                        shadowBlur={highlightedTransitionId === transition.id || isLinked ? 18 : 10}
                        shadowColor={transition.color}
                        opacity={transition.certainty === 'confirmed' ? 1 : 0.72}
                      />
                      <CanvasVectorIcon iconId={transitionIcon[transition.transitionType]} size={14} x={0} y={0} />
                    </Group>
                  );
                })
              : null}

            {layerVisibleForPreset(map, 'overlay')
              ? map.routeOverlays.map((route) => (
                  <Line
                    key={route.id}
                    points={route.points.flatMap((point) => [point.x, point.y])}
                    stroke={route.color}
                    strokeWidth={route.width}
                    opacity={route.opacity}
                    dash={route.state === 'confirmed' ? undefined : [16, 10]}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))
              : null}
            {layerVisibleForPreset(map, 'terrain')
              ? map.sketches.map((stroke) => (
                  <Line
                    key={stroke.id}
                    points={stroke.points.flatMap((point) => [point.x, point.y])}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    opacity={stroke.opacity}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))
              : null}
            {layerVisibleForPreset(map, 'icons')
              ? map.markers.map((entry) => (
                  <Group
                    draggable={editorMode !== 'navigate' && activeTool === 'select'}
                    key={entry.id}
                    onClick={handleEntitySelection('marker', entry.id)}
                    onDragEnd={(event) => moveEntity('marker', entry.id, { x: event.target.x(), y: event.target.y() })}
                    x={entry.position.x}
                    y={entry.position.y}
                  >
                    <Circle
                      radius={entry.size * 0.82}
                      fill="rgba(26, 30, 35, 0.94)"
                      stroke={selection.kind === 'marker' && selection.ids.includes(entry.id) ? selectionStroke : entry.color}
                      strokeWidth={3}
                    />
                    <CanvasVectorIcon iconId={entry.iconId} size={entry.size} x={0} y={0} />
                    {entry.labelVisible ? (
                      <Text x={18} y={-8} text={entry.label} fontSize={14} fontFamily="Space Grotesk" fill="#f2e8dc" />
                    ) : null}
                  </Group>
                ))
              : null}
            {layerVisibleForPreset(map, 'notes')
              ? map.notesBoard.map((entry) => (
                  <Group
                    draggable={editorMode !== 'navigate' && activeTool === 'select'}
                    key={entry.id}
                    onClick={handleEntitySelection('note', entry.id)}
                    onDragEnd={(event) => moveEntity('note', entry.id, { x: event.target.x(), y: event.target.y() })}
                    x={entry.position.x}
                    y={entry.position.y}
                  >
                    <Rect
                      width={240}
                      height={entry.collapsed ? 44 : 124}
                      cornerRadius={18}
                      fill="#3a3228"
                      opacity={0.96}
                      stroke={selection.kind === 'note' && selection.ids.includes(entry.id) ? selectionStroke : 'rgba(200, 170, 130, 0.25)'}
                      strokeWidth={2.4}
                    />
                    <Text x={16} y={14} text={entry.title} fontFamily="Space Grotesk" fontSize={16} fill="#ddd4c8" />
                    {!entry.collapsed ? (
                      <Text x={16} y={42} width={208} height={70} text={entry.body} fontFamily="Inter Tight" fontSize={13} fill="#b0a494" />
                    ) : null}
                  </Group>
                ))
              : null}
            {layerVisibleForPreset(map, 'labels')
              ? map.anchors.map((entry) => (
                  <Group
                    draggable={editorMode !== 'navigate' && activeTool === 'select'}
                    key={entry.id}
                    onClick={handleEntitySelection('anchor', entry.id)}
                    onDragEnd={(event) => moveEntity('anchor', entry.id, { x: event.target.x(), y: event.target.y() })}
                    x={entry.position.x}
                    y={entry.position.y}
                  >
                    <Circle radius={8} fill={entry.color} stroke="#fff4eb" strokeWidth={2} />
                    <Text x={12} y={-7} text={entry.name} fontSize={12} fontFamily="IBM Plex Mono" fill="#f4e6db" />
                  </Group>
                ))
              : null}
            {draftRect ? (
              <Rect
                x={Math.min(draftRect.start.x, draftRect.current.x)}
                y={Math.min(draftRect.start.y, draftRect.current.y)}
                width={Math.abs(draftRect.current.x - draftRect.start.x)}
                height={Math.abs(draftRect.current.y - draftRect.start.y)}
                dash={[16, 8]}
                stroke={selectionStroke}
                strokeWidth={3}
                fill="rgba(185, 149, 86, 0.12)"
                cornerRadius={24}
              />
            ) : null}
            {draftPath.length > 1 ? (
              <>
                {draftKind === 'corridor' ? (
                  <>
                    <Line
                      points={draftPath.flatMap((point) => [point.x, point.y])}
                      stroke={wallTone}
                      strokeWidth={toolSettings.corridorWidth + 18}
                      opacity={0.55}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Line
                      points={draftPath.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorFill}
                      strokeWidth={Math.max(16, toolSettings.corridorWidth - 10)}
                      opacity={0.78}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </>
                ) : (
                  <Line
                    points={draftPath.flatMap((point) => [point.x, point.y])}
                    stroke={draftKind === 'wall' ? wallTone : selectionStroke}
                    strokeWidth={draftKind === 'wall' ? 16 : 8}
                    opacity={draftKind === 'wall' ? 0.72 : 0.82}
                    lineCap="round"
                    lineJoin="round"
                    dash={draftKind === 'route' ? [16, 10] : undefined}
                  />
                )}
              </>
            ) : null}
            {(editorMode === 'graph' || map.view.showLegacyGraph) && map.rooms.length ? (
              <Group opacity={0.2}>
                {map.paths.map((path) => (
                  <Line
                    key={path.id}
                    points={path.points.flatMap((point) => [point.x, point.y])}
                    stroke="#f2ccd0"
                    strokeWidth={3}
                    dash={path.state === 'uncertain' ? [12, 8] : undefined}
                  />
                ))}
                {map.rooms.map((room) => (
                  <Rect
                    key={room.id}
                    x={room.position.x}
                    y={room.position.y}
                    width={room.size.width}
                    height={room.size.height}
                    cornerRadius={16}
                    stroke="#f2ccd0"
                    strokeWidth={2}
                    fill="transparent"
                  />
                ))}
              </Group>
            ) : null}
          </Layer>
        </Stage>

        {map.view.showToolHints ? (
          <div className="canvas-hint-overlay">
            <span className="section-eyebrow">Tool Hint</span>
            <strong>{currentHint}</strong>
          </div>
        ) : null}

        <div className="canvas-controls-overlay">
          <button aria-label="Zoom out canvas" data-testid="zoom-out-button" onClick={() => applyZoom(clamp(map.view.zoom / 1.12, 0.32, 3))} type="button">-</button>
          <button aria-label="Zoom in canvas" data-testid="zoom-in-button" onClick={() => applyZoom(clamp(map.view.zoom * 1.12, 0.32, 3))} type="button">+</button>
          <button aria-label="Fit map to canvas" data-testid="fit-map-button" onClick={() => fitToMap()} type="button">Fit</button>
          {selection.kind !== 'none' ? (
            <button aria-label="Fit selection to canvas" data-testid="fit-selection-button" onClick={() => fitSelection()} type="button">Sel</button>
          ) : null}
          <button aria-label={map.view.showGrid ? 'Hide grid' : 'Show grid'} data-testid="toggle-grid-button" onClick={() => updateMapView({ showGrid: !map.view.showGrid })} type="button">
            {map.view.showGrid ? 'Grid' : 'No Grid'}
          </button>
          <select
            aria-label="Grid snap size"
            data-testid="grid-size-select"
            value={map.view.gridSize}
            onChange={(e) => updateMapView({ gridSize: Number(e.target.value) })}
            style={{ background: 'rgba(0,0,0,0.5)', color: '#ccc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75em', cursor: 'pointer' }}
          >
            <option value={16}>16px</option>
            <option value={24}>24px</option>
            <option value={32}>32px</option>
            <option value={48}>48px</option>
            <option value={64}>64px</option>
            <option value={96}>96px</option>
          </select>
        </div>

        {showHotspots ? (
          <div className="canvas-hotspots">
            {map.transitions.map((transition) => {
              const x = transition.position.x * map.view.zoom + map.view.pan.x;
              const y = transition.position.y * map.view.zoom + map.view.pan.y;
              return (
                <button
                  key={transition.id}
                  aria-label={
                    editorMode === 'navigate' && transition.destinationMapId
                      ? `Travel via ${transition.label}`
                      : `Select ${transition.label}`
                  }
                  className="canvas-hotspot"
                  data-testid={`transition-hotspot-${transition.id}`}
                  onClick={() =>
                    handleEntitySelection('transition', transition.id, {
                      destinationMapId: transition.destinationMapId,
                      destinationAnchorId: transition.destinationAnchorId,
                    })()
                  }
                  style={{
                    left: `${x - 22}px`,
                    top: `${y - 22}px`,
                    width: '44px',
                    height: '44px',
                  }}
                  type="button"
                >
                  <span className="sr-only">{transition.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {map.view.showMinimap ? <MiniNavigator map={map} /> : null}
      </div>
    );
  },
);
