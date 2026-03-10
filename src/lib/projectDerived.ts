import { builtInIconLibrary, findBuiltInIcon, iconCategories } from '../data/iconLibrary';
import type { MapRecord, ProjectRecord, ReviewItem, SearchResult } from '../models/types';
import { includesFuzzy, unique } from './utils';

export interface ProjectStats {
  mapCount: number;
  roomCount: number;
  transitionCount: number;
  unlinkedTransitionCount: number;
  unresolvedNoteCount: number;
  uncollectedLootCount: number;
  uncertainRouteCount: number;
  completionAverage: number;
}

export const getProjectStats = (project: ProjectRecord): ProjectStats => {
  const maps = project.maps;
  const roomCount = maps.reduce((sum, map) => sum + map.floorRooms.length, 0);
  const transitionCount = maps.reduce((sum, map) => sum + map.transitions.length, 0);
  const unlinkedTransitionCount = maps.reduce(
    (sum, map) =>
      sum +
      map.transitions.filter(
        (transition) =>
          !transition.destinationMapId &&
          !transition.intentionallyUnpaired &&
          transition.transitionState !== 'disabled',
      ).length,
    0,
  );
  const unresolvedNoteCount = maps.reduce(
    (sum, map) => sum + map.notesBoard.filter((note) => !note.completed && note.state !== 'resolved').length,
    0,
  );
  const uncollectedLootCount = maps.reduce(
    (sum, map) =>
      sum +
      map.markers.filter(
        (marker) =>
          ['loot', 'key', 'chest'].includes(marker.markerType) &&
          marker.state !== 'collected' &&
          marker.markerState !== 'completed',
      ).length,
    0,
  );
  const uncertainRouteCount = maps.reduce(
    (sum, map) =>
      sum +
      map.corridors.filter((corridor) => ['uncertain', 'hidden', 'temporary'].includes(corridor.state)).length +
      map.routeOverlays.filter((route) => route.state !== 'confirmed').length +
      map.transitions.filter((transition) => transition.certainty !== 'confirmed').length,
    0,
  );
  const completionAverage = Math.round(
    maps.reduce((sum, map) => sum + map.completion, 0) / Math.max(1, maps.length),
  );

  return {
    mapCount: maps.length,
    roomCount,
    transitionCount,
    unlinkedTransitionCount,
    unresolvedNoteCount,
    uncollectedLootCount,
    uncertainRouteCount,
    completionAverage,
  };
};

export const getReviewItems = (project: ProjectRecord): ReviewItem[] => {
  const items: ReviewItem[] = [];

  for (const map of project.maps) {
    for (const transition of map.transitions) {
      if (!transition.destinationMapId && !transition.intentionallyUnpaired) {
        items.push({
          id: `${transition.id}_review_unlinked`,
          mapId: map.id,
          mapName: map.name,
          category: 'unlinked_transitions',
          title: transition.label,
          subtitle: 'Transition has no destination map.',
          severity: transition.transitionState === 'locked' ? 'medium' : 'high',
          entityId: transition.id,
        });
      }

      if (transition.certainty !== 'confirmed') {
        items.push({
          id: `${transition.id}_review_uncertain`,
          mapId: map.id,
          mapName: map.name,
          category: 'uncertain_routes',
          title: transition.label,
          subtitle: `Marked as ${transition.certainty}.`,
          severity: 'medium',
          entityId: transition.id,
        });
      }
    }

    for (const route of map.routeOverlays) {
      if (route.state !== 'confirmed') {
        items.push({
          id: `${route.id}_review_route`,
          mapId: map.id,
          mapName: map.name,
          category: 'uncertain_routes',
          title: route.label ?? 'Marked route',
          subtitle: 'Route overlay is still speculative.',
          severity: 'low',
          entityId: route.id,
        });
      }
    }

    for (const note of map.notesBoard) {
      if (note.category === 'revisit_later' || note.priority === 'critical' || note.state === 'blocked') {
        items.push({
          id: `${note.id}_review_revisit`,
          mapId: map.id,
          mapName: map.name,
          category: 'revisit_queue',
          title: note.title,
          subtitle: note.body,
          severity: note.priority === 'critical' ? 'high' : 'medium',
          entityId: note.id,
        });
      }
    }

    for (const room of map.floorRooms) {
      const related = map.corridors.filter((corridor) => corridor.connectedRoomIds.includes(room.id));
      if (related.length === 0 && map.floorRooms.length > 1) {
        items.push({
          id: `${room.id}_review_disconnected`,
          mapId: map.id,
          mapName: map.name,
          category: 'disconnected_nodes',
          title: room.label,
          subtitle: 'Room has no corridor connections.',
          severity: 'low',
          entityId: room.id,
        });
      }
    }

    if (!map.transitions.some((transition) => transition.destinationMapId) && !map.variantOfMapId && project.maps.length > 1) {
      items.push({
        id: `${map.id}_review_map_gap`,
        mapId: map.id,
        mapName: map.name,
        category: 'map_link_gaps',
        title: map.name,
        subtitle: 'Map has no outgoing linked transitions.',
        severity: 'medium',
      });
    }
  }

  return items;
};

export const getSearchResults = (project: ProjectRecord, query: string): SearchResult[] => {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];

  for (const map of project.maps) {
    if (includesFuzzy(map.name, query) || includesFuzzy(map.region, query)) {
      results.push({
        id: map.id,
        kind: 'map',
        title: map.name,
        subtitle: `${map.region} / ${map.floor}`,
        tags: [map.style, map.floor],
      });
    }

    for (const room of map.floorRooms) {
      if (
        includesFuzzy(room.label, query) ||
        includesFuzzy(room.subtitle ?? '', query) ||
        room.tags.some((tag) => includesFuzzy(tag, query))
      ) {
        results.push({
          id: room.id,
          mapId: map.id,
          mapName: map.name,
          kind: 'floor_room',
          title: room.label,
          subtitle: room.subtitle,
          tags: room.tags,
        });
      }
    }

    for (const doorway of map.doorways) {
      if (
        includesFuzzy(doorway.label, query) ||
        includesFuzzy(doorway.transitionType, query) ||
        doorway.tags.some((tag) => includesFuzzy(tag, query))
      ) {
        results.push({
          id: doorway.id,
          mapId: map.id,
          mapName: map.name,
          kind: 'doorway',
          title: doorway.label,
          subtitle: doorway.transitionType,
          tags: doorway.tags,
        });
      }
    }

    for (const marker of map.markers) {
      const icon = findBuiltInIcon(marker.iconId);
      if (
        includesFuzzy(marker.label, query) ||
        includesFuzzy(icon.label, query) ||
        marker.tags.some((tag) => includesFuzzy(tag, query))
      ) {
        results.push({
          id: marker.id,
          mapId: map.id,
          mapName: map.name,
          kind: 'marker',
          title: marker.label,
          subtitle: icon.label,
          tags: marker.tags,
        });
      }
    }

    for (const note of map.notesBoard) {
      if (
        includesFuzzy(note.title, query) ||
        includesFuzzy(note.body, query) ||
        note.tags.some((tag) => includesFuzzy(tag, query))
      ) {
        results.push({
          id: note.id,
          mapId: map.id,
          mapName: map.name,
          kind: 'note',
          title: note.title,
          subtitle: note.body,
          tags: note.tags,
        });
      }
    }

    for (const transition of map.transitions) {
      if (
        includesFuzzy(transition.label, query) ||
        transition.tags.some((tag) => includesFuzzy(tag, query)) ||
        includesFuzzy(transition.transitionType, query)
      ) {
        results.push({
          id: transition.id,
          mapId: map.id,
          mapName: map.name,
          kind: 'transition',
          title: transition.label,
          subtitle: transition.transitionType,
          tags: transition.tags,
        });
      }
    }
  }

  return results.slice(0, 60);
};

export const getLegendForMap = (map: MapRecord) =>
  unique(map.markers.map((marker) => marker.iconId))
    .map((iconId) => findBuiltInIcon(iconId))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

export const getIconCategoryCounts = () =>
  iconCategories.map((category) => ({
    category,
    count: builtInIconLibrary.filter((icon) => icon.category === category).length,
  }));
