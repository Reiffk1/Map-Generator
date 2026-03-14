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

const roomWallIds = (roomId: string) => [`${roomId}_n`, `${roomId}_e`, `${roomId}_s`, `${roomId}_w`];
const roomSidePattern = /^(.*)_(n|e|s|w)(?:__\d+)?$/;

const roomDistanceToPoint = (room: FloorRoom, point: Point) => {
  const dx = Math.max(room.bounds.x - point.x, 0, point.x - (room.bounds.x + room.bounds.width));
  const dy = Math.max(room.bounds.y - point.y, 0, point.y - (room.bounds.y + room.bounds.height));
  return Math.sqrt(dx * dx + dy * dy);
};

const snapPointToRoomEdge = (
  point: Point,
  room: FloorRoom,
): { position: Point; orientation: DoorwayOrientation } => {
  const left = Math.abs(point.x - room.bounds.x);
  const right = Math.abs(point.x - (room.bounds.x + room.bounds.width));
  const top = Math.abs(point.y - room.bounds.y);
  const bottom = Math.abs(point.y - (room.bounds.y + room.bounds.height));
  const closest = Math.min(left, right, top, bottom);

  if (closest === top) {
    return {
      position: {
        x: clamp(point.x, room.bounds.x + 24, room.bounds.x + room.bounds.width - 24),
        y: room.bounds.y,
      },
      orientation: 'north',
    };
  }

  if (closest === bottom) {
    return {
      position: {
        x: clamp(point.x, room.bounds.x + 24, room.bounds.x + room.bounds.width - 24),
        y: room.bounds.y + room.bounds.height,
      },
      orientation: 'south',
    };
  }

  if (closest === left) {
    return {
      position: {
        x: room.bounds.x,
        y: clamp(point.y, room.bounds.y + 24, room.bounds.y + room.bounds.height - 24),
      },
      orientation: 'west',
    };
  }

  return {
    position: {
      x: room.bounds.x + room.bounds.width,
      y: clamp(point.y, room.bounds.y + 24, room.bounds.y + room.bounds.height - 24),
    },
    orientation: 'east',
  };
};

const projectPointToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator === 0) return { point: start, distance: distanceBetween(point, start) };

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator, 0, 1);
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return { point: projected, distance: distanceBetween(point, projected) };
};

const snapPointToCorridor = (
  point: Point,
  corridors: CorridorSegment[],
): { position: Point; orientation: DoorwayOrientation; distance: number } | null => {
  let best: { position: Point; orientation: DoorwayOrientation; distance: number } | null = null;

  for (const corridor of corridors) {
    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index];
      const end = corridor.points[index + 1];
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

const snapCorridorEndpoint = (point: Point, rooms: FloorRoom[]) => {
  const nearestRoom = [...rooms].sort((left, right) => roomDistanceToPoint(left, point) - roomDistanceToPoint(right, point))[0];
  if (!nearestRoom || roomDistanceToPoint(nearestRoom, point) > ROOM_ATTACH_DISTANCE) {
    return { point, roomId: undefined };
  }

  return { point: snapPointToRoomEdge(point, nearestRoom).position, roomId: nearestRoom.id };
};

export const buildRoomWalls = (layerId: string, room: FloorRoom): WallSegment[] => {
  return buildRoomWallsWithOpenings(layerId, room, [], []);
};

type RoomWallSide = 'n' | 'e' | 's' | 'w';

type OpeningInterval = {
  start: number;
  end: number;
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

const getSideWallRange = (room: FloorRoom, side: RoomWallSide) => {
  const { x, y, width, height } = room.bounds;

  if (side === 'n' || side === 's') {
    return {
      min: x,
      max: x + width,
      fixed: side === 'n' ? y : y + height,
    };
  }

  return {
    min: y,
    max: y + height,
    fixed: side === 'e' ? x + width : x,
  };
};

const getSidePoints = (side: RoomWallSide, fixed: number, start: number, end: number): Point[] => {
  if (side === 'n') return [{ x: start, y: fixed }, { x: end, y: fixed }];
  if (side === 'e') return [{ x: fixed, y: start }, { x: fixed, y: end }];
  if (side === 's') return [{ x: end, y: fixed }, { x: start, y: fixed }];
  return [{ x: fixed, y: end }, { x: fixed, y: start }];
};

const sideForOrientation = (orientation: DoorwayOrientation): RoomWallSide => {
  if (orientation === 'north') return 'n';
  if (orientation === 'east') return 'e';
  if (orientation === 'south') return 's';
  return 'w';
};

const collectDoorOpeningsForSide = (
  room: FloorRoom,
  side: RoomWallSide,
  doorways: DoorwayRecord[],
): OpeningInterval[] => {
  const sideRange = getSideWallRange(room, side);

  return doorways
    .filter((doorway) => doorway.attachedRoomId === room.id && sideForOrientation(doorway.orientation) === side)
    .map((doorway) =>
      clampOpeningToWall(
        side === 'n' || side === 's' ? doorway.position.x : doorway.position.y,
        doorway.width + WALL_OPENING_TOLERANCE,
        sideRange.min,
        sideRange.max,
      ),
    )
    .filter((opening): opening is OpeningInterval => opening !== null);
};

const corridorEndpointOpensSide = (room: FloorRoom, side: RoomWallSide, point: Point) => {
  const { x, y, width, height } = room.bounds;

  if (side === 'n') {
    return Math.abs(point.y - y) <= CORRIDOR_ENDPOINT_EPSILON && point.x >= x - CORRIDOR_ENDPOINT_EPSILON && point.x <= x + width + CORRIDOR_ENDPOINT_EPSILON;
  }
  if (side === 's') {
    return Math.abs(point.y - (y + height)) <= CORRIDOR_ENDPOINT_EPSILON && point.x >= x - CORRIDOR_ENDPOINT_EPSILON && point.x <= x + width + CORRIDOR_ENDPOINT_EPSILON;
  }
  if (side === 'e') {
    return Math.abs(point.x - (x + width)) <= CORRIDOR_ENDPOINT_EPSILON && point.y >= y - CORRIDOR_ENDPOINT_EPSILON && point.y <= y + height + CORRIDOR_ENDPOINT_EPSILON;
  }
  return Math.abs(point.x - x) <= CORRIDOR_ENDPOINT_EPSILON && point.y >= y - CORRIDOR_ENDPOINT_EPSILON && point.y <= y + height + CORRIDOR_ENDPOINT_EPSILON;
};

const collectCorridorOpeningsForSide = (
  room: FloorRoom,
  side: RoomWallSide,
  corridors: CorridorSegment[],
): OpeningInterval[] => {
  const sideRange = getSideWallRange(room, side);
  const openings: OpeningInterval[] = [];

  for (const corridor of corridors) {
    const endpoints = [corridor.points[0], corridor.points[corridor.points.length - 1]].filter(Boolean) as Point[];
    for (const endpoint of endpoints) {
      if (!corridorEndpointOpensSide(room, side, endpoint)) continue;
      const opening = clampOpeningToWall(
        side === 'n' || side === 's' ? endpoint.x : endpoint.y,
        corridor.width,
        sideRange.min,
        sideRange.max,
      );
      if (opening) openings.push(opening);
    }
  }

  return openings;
};

export const buildRoomWallsWithOpenings = (
  layerId: string,
  room: FloorRoom,
  mapDoorways: DoorwayRecord[],
  mapCorridors: CorridorSegment[],
): WallSegment[] => {
  const sides: RoomWallSide[] = ['n', 'e', 's', 'w'];
  const segments: WallSegment[] = [];

  for (const side of sides) {
    const { min, max, fixed } = getSideWallRange(room, side);
    const openings = mergeOpenings([
      ...collectDoorOpeningsForSide(room, side, mapDoorways),
      ...collectCorridorOpeningsForSide(room, side, mapCorridors),
    ]);

    let cursor = min;
    let segmentIndex = 0;

    for (const opening of openings) {
      if (opening.start - cursor > 1) {
        segments.push(
          buildRoomWallSegment(layerId, room, side, segmentIndex, getSidePoints(side, fixed, cursor, opening.start)),
        );
        segmentIndex += 1;
      }
      cursor = Math.max(cursor, opening.end);
    }

    if (max - cursor > 1) {
      segments.push(
        buildRoomWallSegment(layerId, room, side, segmentIndex, getSidePoints(side, fixed, cursor, max)),
      );
    }
  }

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
  mapCorridors: CorridorSegment[],
) => {
  const knownRoomIds = new Set(rooms.map((room) => room.id));
  const generatedIds = new Set(rooms.flatMap((room) => roomWallIds(room.id)));
  const manualWalls = walls.filter((wall) => {
    if (wall.tags.includes(GENERATED_WALL_TAG)) return false;
    if (generatedIds.has(wall.id)) return false;
    return !getGeneratedRoomWallRoomId(wall, knownRoomIds);
  });
  return [...rooms.flatMap((room) => buildRoomWallsWithOpenings(layerId, room, mapDoorways, mapCorridors)), ...manualWalls];
};

export const attachCorridorToFloorplan = (map: MapRecord, points: Point[]) => {
  if (points.length < 2) {
    return { points, connectedRoomIds: [] };
  }

  const nextPoints = [...points];
  const startSnap = snapCorridorEndpoint(nextPoints[0], map.floorRooms);
  const endSnap = snapCorridorEndpoint(nextPoints[nextPoints.length - 1], map.floorRooms);
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

export const snapDoorwayToFloorplan = (
  point: Point,
  map: MapRecord,
): { position: Point; orientation: DoorwayOrientation; attachedRoomId?: string } => {
  const nearestRoom = [...map.floorRooms].sort((left, right) => roomDistanceToPoint(left, point) - roomDistanceToPoint(right, point))[0];
  const roomDistance = nearestRoom ? roomDistanceToPoint(nearestRoom, point) : Number.POSITIVE_INFINITY;
  const corridorSnap = snapPointToCorridor(point, map.corridors);

  if (nearestRoom && roomDistance <= DOORWAY_ATTACH_DISTANCE && (!corridorSnap || roomDistance <= corridorSnap.distance)) {
    const snapped = snapPointToRoomEdge(point, nearestRoom);
    return { ...snapped, attachedRoomId: nearestRoom.id };
  }

  if (corridorSnap && corridorSnap.distance <= DOORWAY_ATTACH_DISTANCE) {
    return { position: corridorSnap.position, orientation: corridorSnap.orientation };
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

  for (const room of map.floorRooms) includeBoundsPoints(points, room.bounds);
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
