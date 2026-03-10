import type { MapRecord, ProjectRecord, RoutePlan, RoutePlanStep, TransitionRecord } from '../models/types';

interface RouteNode {
  mapId: string;
  viaTransitionId?: string;
  previous?: RouteNode;
}

const getMapById = (project: ProjectRecord, mapId: string) =>
  project.maps.find((map) => map.id === mapId);

const getTransitionLabel = (map: MapRecord, transitionId?: string) =>
  map.transitions.find((transition) => transition.id === transitionId)?.label;

export const findDoorPairSuggestions = (
  project: ProjectRecord,
  target: TransitionRecord,
) => {
  const normalizedTarget = target.label.toLowerCase();

  return project.maps
    .flatMap((map) =>
      map.transitions
        .filter((transition) => transition.id !== target.id && !transition.destinationMapId)
        .map((transition) => ({
          mapId: map.id,
          mapName: map.name,
          transition,
          score:
            Number(transition.transitionType === target.transitionType) * 3 +
            Number(transition.label.toLowerCase().includes(normalizedTarget)) * 4 +
            Number(normalizedTarget.includes(transition.label.toLowerCase())) * 2 +
            transition.tags.filter((tag) => target.tags.includes(tag)).length,
        })),
    )
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};

export const buildRoutePlan = (
  project: ProjectRecord,
  startMapId?: string,
  endMapId?: string,
): RoutePlan | null => {
  if (!startMapId || !endMapId) return null;

  if (startMapId === endMapId) {
    const startMap = getMapById(project, startMapId);
    if (!startMap) return null;
    return {
      summary: `Already on ${startMap.name}.`,
      steps: [{ mapId: startMap.id, mapName: startMap.name, label: 'Current map' }],
    };
  }

  const queue: RouteNode[] = [{ mapId: startMapId }];
  const visited = new Set<string>([startMapId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentMap = getMapById(project, current.mapId);
    if (!currentMap) continue;

    for (const transition of currentMap.transitions) {
      if (!transition.destinationMapId || visited.has(transition.destinationMapId)) continue;

      const nextNode: RouteNode = {
        mapId: transition.destinationMapId,
        viaTransitionId: transition.id,
        previous: current,
      };

      if (transition.destinationMapId === endMapId) {
        const chain: RouteNode[] = [];
        let pointer: RouteNode | undefined = nextNode;
        while (pointer) {
          chain.unshift(pointer);
          pointer = pointer.previous;
        }

        const steps: RoutePlanStep[] = chain.map((node) => {
          const map = getMapById(project, node.mapId)!;
          const previousMap = node.previous ? getMapById(project, node.previous.mapId) : undefined;
          const transitionLabel = previousMap
            ? getTransitionLabel(previousMap, node.viaTransitionId)
            : undefined;

          return {
            mapId: map.id,
            mapName: map.name,
            transitionId: node.viaTransitionId,
            label: transitionLabel
              ? `Take ${transitionLabel} to ${map.name}`
              : `Start on ${map.name}`,
          };
        });

        return {
          summary: `Route found across ${steps.length} map${steps.length === 1 ? '' : 's'}.`,
          steps,
        };
      }

      visited.add(transition.destinationMapId);
      queue.push(nextNode);
    }
  }

  return {
    summary: 'No confirmed route found between those maps yet.',
    steps: [],
  };
};
