import {
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
  ash: {
    stage: '#1a1e23',
    backdrop: '#ddd6c8',
    roomBase: '#ebe3d4',
    roomInset: '#f6f1e8',
    corridorFill: '#d1c7b7',
    corridorEdge: '#a99d8b',
    corridorCenter: 'rgba(80, 71, 60, 0.18)',
    wallHighlight: 'rgba(255, 248, 236, 0.22)',
    label: '#312b25',
    labelMuted: '#72685b',
    grid: 'rgba(85, 77, 68, 0.14)',
  },
  parchment: {
    stage: '#181b20',
    backdrop: '#e7dfd1',
    roomBase: '#f3ece0',
    roomInset: '#fbf7f0',
    corridorFill: '#ddd3c1',
    corridorEdge: '#b1a48f',
    corridorCenter: 'rgba(88, 74, 56, 0.18)',
    wallHighlight: 'rgba(255, 252, 245, 0.24)',
    label: '#2f2922',
    labelMuted: '#776b5c',
    grid: 'rgba(102, 92, 77, 0.12)',
  },
  slate: {
    stage: '#15181c',
    backdrop: '#d6d4ce',
    roomBase: '#e4e0d7',
    roomInset: '#efebe3',
    corridorFill: '#c6c2b8',
    corridorEdge: '#9a9386',
    corridorCenter: 'rgba(68, 63, 56, 0.18)',
    wallHighlight: 'rgba(255, 255, 255, 0.18)',
    label: '#292620',
    labelMuted: '#666056',
    grid: 'rgba(73, 67, 60, 0.11)',
  },
};

const wallPalette: Record<MapRecord['view']['wallStyle'], string> = {
  stone: '#3e342c',
  brick: '#574137',
  ruin: '#6b6257',
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

export interface MapCanvasHandle {
  toDataUrl: () => string | undefined;
  fitToMap: () => void;
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
    const fittedMapsRef = useRef<Set<string>>(new Set());
    const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
    const [backgroundImage] = useImage(map.background?.src ?? '', 'anonymous');
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

    const fitToMap = () => {
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
      });
    };

    useImperativeHandle(ref, () => ({
      toDataUrl: () => stageRef.current?.toDataURL({ pixelRatio: 2 }),
      fitToMap,
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
      if (map.view.zoom !== 1 || map.view.pan.x !== 0 || map.view.pan.y !== 0) {
        fittedMapsRef.current.add(map.id);
        return;
      }
      fitToMap();
      fittedMapsRef.current.add(map.id);
    }, [map.id, map.view.pan.x, map.view.pan.y, map.view.zoom, size.height, size.width]);

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
      if (activeTool === 'erase') return 'Click a selected canvas entity to remove it.';
      if (editorMode === 'navigate') return 'Use linked doorway hotspots to jump between maps.';
      return 'Select, pan, inspect, and annotate the active floorplan.';
    }, [activeTool, editorMode, toolSettings.roomPlacement]);

    const showHotspots = activeTool === 'select' || editorMode === 'navigate';
    const surfaceStyle = surfacePalette[map.view.floorSurfaceStyle];
    const wallTone = wallPalette[map.view.wallStyle];

    const doorwayStroke = (doorway: MapRecord['doorways'][number], isSelected: boolean) => {
      if (isSelected) return selectionStroke;
      if (doorway.doorwayState === 'locked') return '#a66e4d';
      if (doorway.doorwayState === 'hidden' || doorway.doorwayState === 'suspected') return '#8e6e80';
      return wallTone;
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
              stroke="rgba(72, 60, 45, 0.18)"
              strokeWidth={3}
              shadowBlur={24}
              shadowColor="rgba(0, 0, 0, 0.18)"
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
          </Layer>

          <Layer>
            {layerVisibleForPreset(map, 'paths')
              ? map.corridors.map((corridor) => {
                  const isSelected = selection.kind === 'corridor' && selection.ids.includes(corridor.id);
                  return (
                  <Group key={corridor.id} onClick={handleEntitySelection('corridor', corridor.id)}>
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
                      strokeWidth={corridor.width + 22}
                      lineCap="round"
                      lineJoin="round"
                      opacity={0.96}
                    />
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorEdge}
                      strokeWidth={corridor.width + 10}
                      lineCap="round"
                      lineJoin="round"
                      opacity={0.65}
                    />
                    <Line
                      points={corridor.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.corridorFill}
                      strokeWidth={Math.max(16, corridor.width - 8)}
                      lineCap="round"
                      lineJoin="round"
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
                  return (
                    <Group
                      draggable={editorMode !== 'navigate' && activeTool === 'select'}
                      key={room.id}
                      onClick={handleEntitySelection('floor_room', room.id)}
                      onDragEnd={(event) => moveEntity('floor_room', room.id, { x: event.target.x(), y: event.target.y() })}
                      x={room.bounds.x}
                      y={room.bounds.y}
                    >
                      <Rect
                        width={room.bounds.width}
                        height={room.bounds.height}
                        cornerRadius={room.roomShape === 'octagon' ? 36 : 24}
                        fill={surfaceStyle.roomBase}
                        stroke={isSelected ? selectionStroke : wallTone}
                        strokeWidth={isSelected ? 4 : 3.4}
                        shadowBlur={isSelected ? 22 : 12}
                        shadowColor="rgba(0,0,0,0.18)"
                        opacity={entityOpacity(room.state)}
                      />
                      <Rect
                        x={8}
                        y={8}
                        width={room.bounds.width - 16}
                        height={room.bounds.height - 16}
                        cornerRadius={room.roomShape === 'octagon' ? 30 : 18}
                        fill={room.color}
                        opacity={0.36}
                      />
                      <Rect
                        x={8}
                        y={8}
                        width={room.bounds.width - 16}
                        height={room.bounds.height - 16}
                        cornerRadius={room.roomShape === 'octagon' ? 30 : 18}
                        stroke={isSelected ? selectionStroke : surfaceStyle.roomInset}
                        strokeWidth={isSelected ? 3 : 2}
                        opacity={0.78}
                      />
                      <Text x={18} y={16} text={room.label} fontFamily="Space Grotesk" fontSize={22} fontStyle="700" fill={surfaceStyle.label} />
                      {room.subtitle ? (
                        <Text x={18} y={46} text={room.subtitle} fontFamily="Inter Tight" fontSize={13} fill={surfaceStyle.labelMuted} />
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
                      stroke={wallTone}
                      strokeWidth={wall.thickness}
                      lineCap="round"
                      lineJoin="round"
                      onClick={() => {
                        if (activeTool === 'erase') deleteEntity('wall', wall.id);
                      }}
                    />
                    <Line
                      points={wall.points.flatMap((point) => [point.x, point.y])}
                      stroke={surfaceStyle.wallHighlight}
                      strokeWidth={Math.max(2, wall.thickness * 0.16)}
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
                          stroke={surfaceStyle.backdrop}
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
                      fill="#e5d5a4"
                      opacity={0.96}
                      stroke={selection.kind === 'note' && selection.ids.includes(entry.id) ? selectionStroke : 'rgba(58, 47, 29, 0.72)'}
                      strokeWidth={2.4}
                    />
                    <Text x={16} y={14} text={entry.title} fontFamily="Space Grotesk" fontSize={16} fill="#352d1f" />
                    {!entry.collapsed ? (
                      <Text x={16} y={42} width={208} height={70} text={entry.body} fontFamily="Inter Tight" fontSize={13} fill="#4a3f2e" />
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

        <div className="canvas-header-overlay">
          <div>
            <strong>{map.name}</strong>
            <span>{map.region} / {map.floor} / {map.style === 'graph' ? 'Route Graph' : map.style}</span>
          </div>
          <div className="canvas-chip-strip">
            <span data-testid="map-room-count">{map.floorRooms.length} rooms</span>
            <span data-testid="map-corridor-count">{map.corridors.length} corridors</span>
            <span data-testid="map-door-count">{map.doorways.length} links</span>
            <span>{Math.round(map.view.zoom * 100)}%</span>
          </div>
        </div>

        {map.view.showToolHints ? (
          <div className="canvas-hint-overlay">
            <span className="section-eyebrow">Tool Hint</span>
            <strong>{currentHint}</strong>
          </div>
        ) : null}

        <div className="canvas-controls-overlay">
          <button aria-label="Zoom out canvas" data-testid="zoom-out-button" onClick={() => applyZoom(clamp(map.view.zoom / 1.12, 0.32, 3))} type="button">-</button>
          <button aria-label="Zoom in canvas" data-testid="zoom-in-button" onClick={() => applyZoom(clamp(map.view.zoom * 1.12, 0.32, 3))} type="button">+</button>
          <button aria-label="Fit map to canvas" data-testid="fit-map-button" onClick={fitToMap} type="button">Fit</button>
          <button aria-label={map.view.showGrid ? 'Hide grid' : 'Show grid'} data-testid="toggle-grid-button" onClick={() => updateMapView({ showGrid: !map.view.showGrid })} type="button">
            {map.view.showGrid ? 'Grid' : 'No Grid'}
          </button>
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
