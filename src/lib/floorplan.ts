import type {
  Bounds,
  CorridorSegment,
  DoorwayOrientation,
  DoorwayRecord,
  FloorRoom,
  MapRecord,
  Point,
  WallSegment,
} from '../models/types';
import { clamp, distanceBetween } from './utils';

const ROOM_ATTACH_DISTANCE = 120;
const DOORWAY_ATTACH_DISTANCE = 96;
const WALL_OPENING_TOLERANCE = 6;
const CORRIDOR_ENDPOINT_EPSILON = 2;
const GENERATED_WALL_TAG = 'generated-room-wall';

type RoomWallSide = 'n' | 'e' | 's' | 'w';

type OpeningInterval = {
  start: number;
  end: number;
};

export type RoomBoundarySegment = {
  start: Point;
  end: Point;
  orientation: DoorwayOrientation;
};
type BoundarySegment = RoomBoundarySegment;

type SnapCandidate = {
  position: Point;
  orientation: DoorwayOrientation;
  distance: number;
  attachedRoomId?: string;
};

const roomWallIds = (roomId: string) => [`${roomId}_n`, `${roomId}_e`, `${roomId}_s`, `${roomId}_w`];
const roomSidePattern = /^(.*)_(n|e|s|w)(?:__\d+)?$/;

const cloneBounds = (bounds: Bounds): Bounds => ({
  x: bounds.x,
  y: bounds.y,
  width: bounds.width,
  height: bounds.height,
});

const boundsKey = (bounds: Bounds) => `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;

const rectContainsPoint = (bounds: Bounds, point: Point) =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

const cleanFootprint = (rects: Bounds[]) => {
  const unique = new Map<string, Bounds>();

  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    unique.set(boundsKey(rect), cloneBounds(rect));
  }

  const normalized = [...unique.values()];
  if (normalized.length <= 1) return normalized;

  const xs = [...new Set(normalized.flatMap((rect) => [rect.x, rect.x + rect.width]))].sort((left, right) => left - right);
  const ys = [...new Set(normalized.flatMap((rect) => [rect.y, rect.y + rect.height]))].sort((left, right) => left - right);
  const inside = Array.from({ length: ys.length - 1 }, (_, yIndex) =>
    Array.from({ length: xs.length - 1 }, (_, xIndex) => {
      const center = {
        x: (xs[xIndex]! + xs[xIndex + 1]!) / 2,
        y: (ys[yIndex]! + ys[yIndex + 1]!) / 2,
      };
      return normalized.some((rect) => rectContainsPoint(rect, center));
    }),
  );
  const visited = inside.map((row) => row.map(() => false));
  const merged: Bounds[] = [];

  for (let yIndex = 0; yIndex < inside.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < inside[yIndex]!.length; xIndex += 1) {
      if (!inside[yIndex]![xIndex] || visited[yIndex]![xIndex]) continue;

      let endX = xIndex + 1;
      while (endX < inside[yIndex]!.length && inside[yIndex]![endX] && !visited[yIndex]![endX]) {
        endX += 1;
      }

      let endY = yIndex + 1;
      let canExtend = true;
      while (endY < inside.length && canExtend) {
        for (let scanX = xIndex; scanX < endX; scanX += 1) {
          if (!inside[endY]![scanX] || visited[endY]![scanX]) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) endY += 1;
      }

      for (let scanY = yIndex; scanY < endY; scanY += 1) {
        for (let scanX = xIndex; scanX < endX; scanX += 1) {
          visited[scanY]![scanX] = true;
        }
      }

      merged.push({
        x: xs[xIndex]!,
        y: ys[yIndex]!,
        width: xs[endX]! - xs[xIndex]!,
        height: ys[endY]! - ys[yIndex]!,
      });
    }
  }

  return merged;
};

export const getRoomFootprint = (room: Pick<FloorRoom, 'bounds' | 'footprint'>): Bounds[] =>
  cleanFootprint(room.footprint?.length ? room.footprint : [room.bounds]);

export const getBoundsForFootprint = (footprint: Bounds[]): Bounds => {
  const rects = cleanFootprint(footprint);
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const getRoomBounds = (room: Pick<FloorRoom, 'bounds' | 'footprint'>): Bounds =>
  getBoundsForFootprint(getRoomFootprint(room));

export const normalizeFloorRoom = (room: FloorRoom): FloorRoom => {
  const footprint = getRoomFootprint(room);
  const bounds = getBoundsForFootprint(footprint);
  return {
    ...room,
    bounds,
    footprint,
    roomShape:
      footprint.length > 1 && room.roomShape !== 'circle'
        ? 'irregular'
        : room.roomShape,
  };
};

export const roomHasIrregularFootprint = (room: Pick<FloorRoom, 'bounds' | 'footprint' | 'roomShape'>) =>
  room.roomShape === 'irregular' || getRoomFootprint(room).length > 1;

export const moveRoomTo = (room: FloorRoom, nextOrigin: Point): FloorRoom => {
  const currentBounds = getRoomBounds(room);
  const dx = nextOrigin.x - currentBounds.x;
  const dy = nextOrigin.y - currentBounds.y;

  return normalizeFloorRoom({
    ...room,
    bounds: {
      x: room.bounds.x + dx,
      y: room.bounds.y + dy,
      width: room.bounds.width,
      height: room.bounds.height,
    },
    footprint: getRoomFootprint(room).map((rect) => ({
      x: rect.x + dx,
      y: rect.y + dy,
      width: rect.width,
      height: rect.height,
    })),
  });
};

export const replaceRoomFootprint = (room: FloorRoom, footprint: Bounds[]): FloorRoom =>
  normalizeFloorRoom({
    ...room,
    footprint: cleanFootprint(footprint),
  });

const projectPointToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator === 0) return { point: start, distance: distanceBetween(point, start) };

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator, 0, 1);
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return { point: projected, distance: distanceBetween(point, projected) };
};

const pointOnSegment = (point: Point, segment: BoundarySegment, epsilon = CORRIDOR_ENDPOINT_EPSILON) =>
  projectPointToSegment(point, segment.start, segment.end).distance <= epsilon;

const buildBoundarySegment = (
  orientation: DoorwayOrientation,
  fixed: number,
  start: number,
  end: number,
): BoundarySegment => {
  if (orientation === 'north') {
    return { start: { x: start, y: fixed }, end: { x: end, y: fixed }, orientation };
  }
  if (orientation === 'south') {
    return { start: { x: end, y: fixed }, end: { x: start, y: fixed }, orientation };
  }
  if (orientation === 'east') {
    return { start: { x: fixed, y: start }, end: { x: fixed, y: end }, orientation };
  }
  return { start: { x: fixed, y: end }, end: { x: fixed, y: start }, orientation };
};

const mergeBoundarySegments = (segments: BoundarySegment[]) => {
  const grouped = new Map<string, OpeningInterval[]>();

  for (const segment of segments) {
    const horizontal = segment.orientation === 'north' || segment.orientation === 'south';
    const fixed = horizontal ? segment.start.y : segment.start.x;
    const start = horizontal
      ? Math.min(segment.start.x, segment.end.x)
      : Math.min(segment.start.y, segment.end.y);
    const end = horizontal
      ? Math.max(segment.start.x, segment.end.x)
      : Math.max(segment.start.y, segment.end.y);
    const key = `${segment.orientation}:${fixed}`;
    const existing = grouped.get(key) ?? [];
    existing.push({ start, end });
    grouped.set(key, existing);
  }

  const merged: BoundarySegment[] = [];
  for (const [key, ranges] of grouped.entries()) {
    const [orientation, fixedRaw] = key.split(':');
    const fixed = Number(fixedRaw);
    const sorted = [...ranges].sort((left, right) => left.start - right.start);
    let current = sorted[0];
    if (!current) continue;

    for (let index = 1; index < sorted.length; index += 1) {
      const next = sorted[index]!;
      if (next.start <= current.end + 1) {
        current.end = Math.max(current.end, next.end);
        continue;
      }
      merged.push(buildBoundarySegment(orientation as DoorwayOrientation, fixed, current.start, current.end));
      current = { ...next };
    }

    merged.push(buildBoundarySegment(orientation as DoorwayOrientation, fixed, current.start, current.end));
  }

  return merged;
};

export const getRoomPerimeterSegments = (room: FloorRoom): BoundarySegment[] => {
  const footprint = getRoomFootprint(room);
  if (footprint.length === 0) return [];

  const xs = [...new Set(footprint.flatMap((rect) => [rect.x, rect.x + rect.width]))].sort((left, right) => left - right);
  const ys = [...new Set(footprint.flatMap((rect) => [rect.y, rect.y + rect.height]))].sort((left, right) => left - right);

  if (xs.length < 2 || ys.length < 2) return [];

  const inside = Array.from({ length: ys.length - 1 }, (_, yIndex) =>
    Array.from({ length: xs.length - 1 }, (_, xIndex) => {
      const center = {
        x: (xs[xIndex]! + xs[xIndex + 1]!) / 2,
        y: (ys[yIndex]! + ys[yIndex + 1]!) / 2,
      };
      return footprint.some((rect) => rectContainsPoint(rect, center));
    }),
  );

  const segments: BoundarySegment[] = [];

  for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
      if (!inside[yIndex]![xIndex]) continue;

      const x1 = xs[xIndex]!;
      const x2 = xs[xIndex + 1]!;
      const y1 = ys[yIndex]!;
      const y2 = ys[yIndex + 1]!;

      if (yIndex === 0 || !inside[yIndex - 1]![xIndex]) {
        segments.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, orientation: 'north' });
      }
      if (xIndex === xs.length - 2 || !inside[yIndex]![xIndex + 1]) {
        segments.push({ start: { x: x2, y: y1 }, end: { x: x2, y: y2 }, orientation: 'east' });
      }
      if (yIndex === ys.length - 2 || !inside[yIndex + 1]![xIndex]) {
        segments.push({ start: { x: x2, y: y2 }, end: { x: x1, y: y2 }, orientation: 'south' });
      }
      if (xIndex === 0 || !inside[yIndex]![xIndex - 1]) {
        segments.push({ start: { x: x1, y: y2 }, end: { x: x1, y: y1 }, orientation: 'west' });
      }
    }
  }

  return mergeBoundarySegments(segments);
};

const roomDistanceToPoint = (room: FloorRoom, point: Point) => {
  const footprint = getRoomFootprint(room);
  if (footprint.some((rect) => rectContainsPoint(rect, point))) return 0;

  const segments = getRoomPerimeterSegments(room);
  if (segments.length === 0) return Number.POSITIVE_INFINITY;

  return Math.min(
    ...segments.map((segment) => projectPointToSegment(point, segment.start, segment.end).distance),
  );
};

const snapPointToRoomEdge = (point: Point, room: FloorRoom): SnapCandidate | null => {
  const perimeter = getRoomPerimeterSegments(room);
  if (perimeter.length === 0) return null;

  let best: SnapCandidate | null = null;

  for (const segment of perimeter) {
    const projection = projectPointToSegment(point, segment.start, segment.end);
    const segmentLength = distanceBetween(segment.start, segment.end);
    let position = projection.point;

    if (segment.orientation === 'north' || segment.orientation === 'south') {
      const padding = segmentLength > 48 ? 24 : 0;
      const min = Math.min(segment.start.x, segment.end.x) + padding;
      const max = Math.max(segment.start.x, segment.end.x) - padding;
      position = {
        x: min <= max ? clamp(projection.point.x, min, max) : projection.point.x,
        y: segment.start.y,
      };
    } else {
      const padding = segmentLength > 48 ? 24 : 0;
      const min = Math.min(segment.start.y, segment.end.y) + padding;
      const max = Math.max(segment.start.y, segment.end.y) - padding;
      position = {
        x: segment.start.x,
        y: min <= max ? clamp(projection.point.y, min, max) : projection.point.y,
      };
    }

    const distance = distanceBetween(point, position);
    if (!best || distance < best.distance) {
      best = {
        position,
        orientation: segment.orientation,
        distance,
        attachedRoomId: room.id,
      };
    }
  }

  return best;
};

const snapPointToCorridor = (
  point: Point,
  corridors: CorridorSegment[],
): SnapCandidate | null => {
  let best: SnapCandidate | null = null;

  for (const corridor of corridors) {
    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index]!;
      const end = corridor.points[index + 1]!;
      const projection = projectPointToSegment(point, start, end);
      const orientation: DoorwayOrientation =
        Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'north' : 'west';

      if (!best || projection.distance < best.distance) {
        best = {
          position: projection.point,
          orientation,
          distance: projection.distance,
        };
      }
    }
  }

  return best;
};

const snapPointToManualWall = (
  point: Point,
  walls: WallSegment[],
): SnapCandidate | null => {
  let best: SnapCandidate | null = null;

  for (const wall of walls) {
    const [start, end] = wall.points;
    if (!start || !end) continue;

    const projection = projectPointToSegment(point, start, end);
    const orientation: DoorwayOrientation =
      Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'north' : 'west';

    if (!best || projection.distance < best.distance) {
      best = {
        position: projection.point,
        orientation,
        distance: projection.distance,
      };
    }
  }

  return best;
};

const snapCorridorEndpoint = (point: Point, rooms: FloorRoom[]) => {
  const nearestRoom = [...rooms].sort((left, right) => roomDistanceToPoint(left, point) - roomDistanceToPoint(right, point))[0];
  const snapped = nearestRoom ? snapPointToRoomEdge(point, nearestRoom) : null;

  if (!snapped || snapped.distance > ROOM_ATTACH_DISTANCE) {
    return { point, roomId: undefined };
  }

  return { point: snapped.position, roomId: nearestRoom.id };
};

export const buildRoomWalls = (layerId: string, room: FloorRoom): WallSegment[] => {
  return buildRoomWallsWithOpenings(layerId, room, []);
};

const buildRoomWallSegment = (
  layerId: string,
  room: FloorRoom,
  side: RoomWallSide,
  index: number,
  points: Point[],
): WallSegment => ({
  id: `${room.id}_${side}__${index}`,
  layerId,
  points,
  thickness: 18,
  color: '#170d10',
  state: 'open',
  tags: [GENERATED_WALL_TAG, `room:${room.id}`, `side:${side}`],
  noteIds: [],
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
});

const clampOpeningToWall = (center: number, width: number, min: number, max: number): OpeningInterval | null => {
  const halfWidth = width / 2;
  const start = clamp(center - halfWidth, min, max);
  const end = clamp(center + halfWidth, min, max);
  if (end - start <= 1) return null;
  return { start, end };
};

const mergeOpenings = (openings: OpeningInterval[]) => {
  if (openings.length === 0) return [];

  const sorted = [...openings].sort((left, right) => left.start - right.start);
  const merged: OpeningInterval[] = [sorted[0]!];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const previous = merged[merged.length - 1]!;
    if (current.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }
    merged.push({ ...current });
  }

  return merged;
};

const sideForOrientation = (orientation: DoorwayOrientation): RoomWallSide => {
  if (orientation === 'north') return 'n';
  if (orientation === 'east') return 'e';
  if (orientation === 'south') return 's';
  return 'w';
};

const collectDoorOpeningsForSegment = (
  room: FloorRoom,
  segment: BoundarySegment,
  doorways: DoorwayRecord[],
) => {
  const horizontal = segment.orientation === 'north' || segment.orientation === 'south';
  const min = horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y);
  const max = horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y);

  return doorways
    .filter((doorway) => doorway.attachedRoomId === room.id && doorway.orientation === segment.orientation)
    .map((doorway) => {
      if (!pointOnSegment(doorway.position, segment, WALL_OPENING_TOLERANCE + 2)) return null;
      return clampOpeningToWall(
        horizontal ? doorway.position.x : doorway.position.y,
        doorway.width + WALL_OPENING_TOLERANCE,
        min,
        max,
      );
    })
    .filter((opening): opening is OpeningInterval => opening !== null);
};

const getSegmentPointsForRange = (
  orientation: DoorwayOrientation,
  fixed: number,
  start: number,
  end: number,
): Point[] => {
  if (orientation === 'north') return [{ x: start, y: fixed }, { x: end, y: fixed }];
  if (orientation === 'south') return [{ x: end, y: fixed }, { x: start, y: fixed }];
  if (orientation === 'east') return [{ x: fixed, y: start }, { x: fixed, y: end }];
  return [{ x: fixed, y: end }, { x: fixed, y: start }];
};

const splitBoundarySegmentByOpenings = (
  layerId: string,
  room: FloorRoom,
  segment: BoundarySegment,
  openings: OpeningInterval[],
  segmentIndex: number,
) => {
  const horizontal = segment.orientation === 'north' || segment.orientation === 'south';
  const min = horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y);
  const max = horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y);
  const fixed = horizontal ? segment.start.y : segment.start.x;

  const side = sideForOrientation(segment.orientation);
  const mergedOpenings = mergeOpenings(openings);
  const walls: WallSegment[] = [];
  let cursor = min;
  let index = segmentIndex;

  for (const opening of mergedOpenings) {
    if (opening.start - cursor > 1) {
      walls.push(
        buildRoomWallSegment(
          layerId,
          room,
          side,
          index,
          getSegmentPointsForRange(segment.orientation, fixed, cursor, opening.start),
        ),
      );
      index += 1;
    }
    cursor = Math.max(cursor, opening.end);
  }

  if (max - cursor > 1) {
    walls.push(
      buildRoomWallSegment(
        layerId,
        room,
        side,
        index,
        getSegmentPointsForRange(segment.orientation, fixed, cursor, max),
      ),
    );
  }

  return walls;
};

export const buildRoomWallsWithOpenings = (
  layerId: string,
  room: FloorRoom,
  mapDoorways: DoorwayRecord[],
): WallSegment[] => {
  const perimeter = getRoomPerimeterSegments(room);
  const segments: WallSegment[] = [];

  perimeter.forEach((segment, segmentIndex) => {
    const openings = collectDoorOpeningsForSegment(room, segment, mapDoorways);
    segments.push(...splitBoundarySegmentByOpenings(layerId, room, segment, openings, segmentIndex * 10));
  });

  return segments;
};

export const getGeneratedRoomWallRoomId = (
  wall: Pick<WallSegment, 'id' | 'tags'>,
  roomIds?: Iterable<string>,
): string | undefined => {
  const taggedRoomId = wall.tags.find((tag) => tag.startsWith('room:'));
  if (wall.tags.includes(GENERATED_WALL_TAG) && taggedRoomId) {
    return taggedRoomId.slice('room:'.length);
  }

  const match = wall.id.match(roomSidePattern);
  if (!match) return undefined;

  const roomId = match[1];
  if (!roomIds) return roomId;

  const knownRoomIds = roomIds instanceof Set ? roomIds : new Set(roomIds);
  return knownRoomIds.has(roomId) ? roomId : undefined;
};

export const rebuildGeneratedWalls = (
  rooms: FloorRoom[],
  walls: WallSegment[],
  layerId: string,
  mapDoorways: DoorwayRecord[],
) => {
  const normalizedRooms = rooms.map(normalizeFloorRoom);
  const knownRoomIds = new Set(normalizedRooms.map((room) => room.id));
  const generatedIds = new Set(normalizedRooms.flatMap((room) => roomWallIds(room.id)));
  const manualWalls = walls.filter((wall) => {
    if (wall.tags.includes(GENERATED_WALL_TAG)) return false;
    if (generatedIds.has(wall.id)) return false;
    return !getGeneratedRoomWallRoomId(wall, knownRoomIds);
  });
  return [...normalizedRooms.flatMap((room) => buildRoomWallsWithOpenings(layerId, room, mapDoorways)), ...manualWalls];
};

export const attachCorridorToFloorplan = (map: MapRecord, points: Point[]) => {
  if (points.length < 2) {
    return { points, connectedRoomIds: [] };
  }

  const nextPoints = [...points];
  const startSnap = snapCorridorEndpoint(nextPoints[0]!, map.floorRooms);
  const endSnap = snapCorridorEndpoint(nextPoints[nextPoints.length - 1]!, map.floorRooms);
  nextPoints[0] = startSnap.point;
  nextPoints[nextPoints.length - 1] = endSnap.point;

  const connectedRoomIds = new Set<string>();
  for (const room of map.floorRooms) {
    const touchesPoint = nextPoints.some((point) => roomDistanceToPoint(room, point) <= ROOM_ATTACH_DISTANCE);
    if (touchesPoint) connectedRoomIds.add(room.id);
  }

  return {
    points: nextPoints,
    connectedRoomIds: [...new Set([startSnap.roomId, endSnap.roomId, ...connectedRoomIds].filter(Boolean))] as string[],
  };
};

interface SnapDoorwayOptions {
  preferredRoomId?: string;
}

export const snapDoorwayToFloorplan = (
  point: Point,
  map: MapRecord,
  options: SnapDoorwayOptions = {},
): { position: Point; orientation: DoorwayOrientation; attachedRoomId?: string } => {
  const preferredRoom = options.preferredRoomId
    ? map.floorRooms.find((room) => room.id === options.preferredRoomId)
    : undefined;
  const preferredRoomSnap = preferredRoom ? snapPointToRoomEdge(point, preferredRoom) : null;

  if (preferredRoomSnap && preferredRoomSnap.distance <= DOORWAY_ATTACH_DISTANCE) {
    return {
      position: preferredRoomSnap.position,
      orientation: preferredRoomSnap.orientation,
      attachedRoomId: preferredRoomSnap.attachedRoomId,
    };
  }

  const nearestRoomSnap = [...map.floorRooms]
    .map((room) => snapPointToRoomEdge(point, room))
    .filter((candidate): candidate is SnapCandidate => candidate !== null)
    .sort((left, right) => left.distance - right.distance)[0];
  const corridorSnap = snapPointToCorridor(point, map.corridors);
  const wallSnap = snapPointToManualWall(
    point,
    map.wallSegments.filter((wall) => !wall.tags.includes(GENERATED_WALL_TAG)),
  );

  const candidates = [nearestRoomSnap, corridorSnap, wallSnap]
    .filter((candidate): candidate is SnapCandidate => candidate != null && candidate.distance <= DOORWAY_ATTACH_DISTANCE)
    .sort((left, right) => left.distance - right.distance);

  const winner = candidates[0];
  if (winner) {
    return {
      position: winner.position,
      orientation: winner.orientation,
      attachedRoomId: winner.attachedRoomId,
    };
  }

  return { position: point, orientation: 'south' };
};

const includeBoundsPoints = (points: Point[], bounds: Bounds) => {
  points.push(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  );
};

export const getMapContentBounds = (map: MapRecord): Bounds => {
  const points: Point[] = [];

  for (const room of map.floorRooms) includeBoundsPoints(points, getRoomBounds(room));
  for (const zone of map.zones) includeBoundsPoints(points, zone.bounds);
  for (const corridor of map.corridors) points.push(...corridor.points);
  for (const doorway of map.doorways) points.push(doorway.position);
  for (const transition of map.transitions) points.push(transition.position);
  for (const marker of map.markers) points.push(marker.position);
  for (const note of map.notesBoard) {
    points.push(note.position, { x: note.position.x + 240, y: note.position.y + 124 });
  }
  for (const route of map.routeOverlays) points.push(...route.points);
  for (const sketch of map.sketches) points.push(...sketch.points);
  for (const anchor of map.anchors) points.push(anchor.position);

  if (points.length === 0) {
    return { x: 0, y: 0, width: 1600, height: 1200 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(480, maxX - minX),
    height: Math.max(360, maxY - minY),
  };
};
