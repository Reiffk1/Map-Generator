import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { tutorialSteps } from '../../lib/tutorial';
import { selectActiveMap, useAppStore } from '../../store/useAppStore';
import { Button, GhostButton } from '../ui/primitives';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialChecklistItem {
  label: string;
  detail: string;
  done: boolean;
}

const pluralize = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;
const formatSelection = (kind: string) => kind.replace(/_/g, ' ');

export function OnboardingModal() {
  const onboarding = useAppStore((state) => state.onboarding);
  const map = useAppStore(selectActiveMap);
  const editorMode = useAppStore((state) => state.editorMode);
  const activeTool = useAppStore((state) => state.activeTool);
  const toolSettings = useAppStore((state) => state.toolSettings);
  const selection = useAppStore((state) => state.selection);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const bottomPanelTab = useAppStore((state) => state.bottomPanelTab);
  const showLeftSidebar = useAppStore((state) => state.showLeftSidebar);
  const showRightSidebar = useAppStore((state) => state.showRightSidebar);
  const showBottomPanel = useAppStore((state) => state.showBottomPanel);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const createMap = useAppStore((state) => state.createMap);
  const addFloorRoom = useAppStore((state) => state.addFloorRoom);
  const addCorridor = useAppStore((state) => state.addCorridor);
  const addDoorwayAt = useAppStore((state) => state.addDoorwayAt);
  const addNoteAt = useAppStore((state) => state.addNoteAt);
  const openMap = useAppStore((state) => state.openMap);
  const seedTutorialLinkTarget = useAppStore((state) => state.seedTutorialLinkTarget);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const nextOnboardingStep = useAppStore((state) => state.nextOnboardingStep);
  const dismissOnboarding = useAppStore((state) => state.dismissOnboarding);
  const [viewportVersion, setViewportVersion] = useState(0);

  const step = tutorialSteps[Math.min(onboarding.step, tutorialSteps.length - 1)];
  const cardPlacementClass = `tutorial-card tutorial-card--${step.cardPlacement ?? 'bottom-right'}`;
  const highlight: HighlightRect | null = (() => {
    void viewportVersion;
    if (!onboarding.show || !step || typeof document === 'undefined') return null;
    const element = document.querySelector(step.selector) as HTMLElement | null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top - 10,
      left: rect.left - 10,
      width: rect.width + 20,
      height: rect.height + 20,
    };
  })();

  const revealTarget = () => {
    if (step.id === 'create-map' && !showLeftSidebar) toggleSidebar('left');
    if (step.id === 'link-door' && !showRightSidebar) toggleSidebar('right');
    if (step.id === 'review' && !showBottomPanel) toggleSidebar('bottom');

    window.setTimeout(() => {
      const element = document.querySelector(step.selector) as HTMLElement | null;
      element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      setViewportVersion((value) => value + 1);
    }, 120);
  };

  useEffect(() => {
    if (!onboarding.show) return;
    const update = () => setViewportVersion((value) => value + 1);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [onboarding.show]);

  useEffect(() => {
    if (!onboarding.show) return;
    revealTarget();
  }, [onboarding.show, onboarding.step, showBottomPanel, showLeftSidebar, showRightSidebar]);

  const runStepAction = () => {
    switch (step.actionId) {
      case 'create-map':
        createMap();
        break;
      case 'equip-room':
        setEditorMode('floorplan');
        setActiveTool('floorRoom');
        break;
      case 'equip-corridor':
        setEditorMode('floorplan');
        setActiveTool('corridor');
        break;
      case 'equip-door':
        setEditorMode('portal');
        setActiveTool('doorway');
        setInspectorTab('links');
        break;
      case 'seed-link-target':
        seedTutorialLinkTarget();
        setInspectorTab('links');
        break;
      case 'equip-note':
        setEditorMode('ink');
        setActiveTool('note');
        setInspectorTab('notes');
        break;
      case 'switch-navigate':
        setEditorMode('navigate');
        setActiveTool('select');
        break;
      case 'open-review':
        if (!showBottomPanel) toggleSidebar('bottom');
        setBottomPanelTab('review');
        break;
      default:
        break;
    }
  };

  const linkedTransitionCount = map.transitions.filter((entry) => entry.destinationMapId).length;
  const stepChecklist: TutorialChecklistItem[] = (() => {
    switch (step.id) {
      case 'create-map':
        return [
          {
            label: 'Explorer is visible',
            detail: 'The New Map button lives in the left project column.',
            done: showLeftSidebar,
          },
          {
            label: 'Current canvas stays on a blank practice map',
            detail: `Current map: ${map.name}. The tutorial works best on a fresh floorplan.`,
            done: map.style === 'floorplan',
          },
        ];
      case 'draw-room':
        return [
          {
            label: 'Room tool is active',
            detail: `Active tool: ${activeTool}.`,
            done: activeTool === 'floorRoom',
          },
          {
            label: 'Room placement mode is ready',
            detail: `Current placement: ${toolSettings.roomPlacement === 'stamp' ? 'Stamp once' : 'Click-drag rectangle'}.`,
            done: activeTool === 'floorRoom',
          },
          {
            label: 'Add at least one room',
            detail: `${pluralize(map.floorRooms.length, 'room')} on this map.`,
            done: map.floorRooms.length > 0,
          },
        ];
      case 'draw-corridor':
        return [
          {
            label: 'Corridor tool is active',
            detail: `Active tool: ${activeTool}.`,
            done: activeTool === 'corridor',
          },
          {
            label: 'Start from an existing room edge',
            detail: `${pluralize(map.floorRooms.length, 'room')} already mapped.`,
            done: map.floorRooms.length > 0,
          },
          {
            label: 'Add a corridor',
            detail: `${pluralize(map.corridors.length, 'corridor')} on this map.`,
            done: map.corridors.length > 0,
          },
        ];
      case 'place-door':
        return [
          {
            label: 'Door tool is active',
            detail: `Active tool: ${activeTool}.`,
            done: activeTool === 'doorway',
          },
          {
            label: 'A corridor or room edge is available',
            detail: `${pluralize(map.corridors.length, 'corridor')} and ${pluralize(map.floorRooms.length, 'room')} on this map.`,
            done: map.corridors.length > 0 || map.floorRooms.length > 0,
          },
          {
            label: 'Add a doorway',
            detail: `${pluralize(map.doorways.length, 'doorway')} placed.`,
            done: map.doorways.length > 0,
          },
        ];
      case 'link-door':
        return [
          {
            label: 'Links inspector is visible',
            detail: `Right sidebar is ${showRightSidebar ? 'open' : 'hidden'} and the ${inspectorTab} tab is active.`,
            done: showRightSidebar && inspectorTab === 'links',
          },
          {
            label: 'Door or transition is selected',
            detail: selection.kind === 'none' ? 'Select the door you just placed.' : `Selected: ${formatSelection(selection.kind)}.`,
            done: selection.kind === 'doorway' || selection.kind === 'transition',
          },
          {
            label: 'Complete the map link',
            detail: `${pluralize(linkedTransitionCount, 'linked transition')} ready.`,
            done: linkedTransitionCount > 0,
          },
        ];
      case 'add-note':
        return [
          {
            label: 'Note tool is active',
            detail: `Active tool: ${activeTool}.`,
            done: activeTool === 'note',
          },
          {
            label: 'Notes panel is visible',
            detail: `Inspector tab: ${inspectorTab}.`,
            done: inspectorTab === 'notes',
          },
          {
            label: 'Drop a note on the map',
            detail: `${pluralize(map.notesBoard.length, 'note')} on this map.`,
            done: map.notesBoard.length > 0,
          },
        ];
      case 'navigate-mode':
        return [
          {
            label: 'Navigate mode is active',
            detail: `Current mode: ${editorMode}.`,
            done: editorMode === 'navigate',
          },
          {
            label: 'Linked exits are ready to travel',
            detail: `${pluralize(linkedTransitionCount, 'linked transition')} on this map.`,
            done: linkedTransitionCount > 0,
          },
        ];
      case 'travel':
        return [
          {
            label: 'Navigate mode stays active',
            detail: `Current mode: ${editorMode}.`,
            done: editorMode === 'navigate',
          },
          {
            label: 'Canvas hotspot is available',
            detail: `${pluralize(linkedTransitionCount, 'linked transition')} can be used as a travel hotspot.`,
            done: linkedTransitionCount > 0,
          },
          {
            label: 'Step completes when you change maps',
            detail: `Current map: ${map.name}.`,
            done: false,
          },
        ];
      case 'review':
        return [
          {
            label: 'Bottom drawer is visible',
            detail: `Drawer is ${showBottomPanel ? 'open' : 'hidden'}.`,
            done: showBottomPanel,
          },
          {
            label: 'Review tab is active',
            detail: `Current drawer tab: ${bottomPanelTab}.`,
            done: bottomPanelTab === 'review',
          },
        ];
      default:
        return [];
    }
  })();

  const liveGuidance = (() => {
    switch (step.id) {
      case 'create-map':
        return 'Start in the explorer. The tutorial will keep everything aligned around a clean practice map.';
      case 'draw-room':
        return activeTool === 'floorRoom'
          ? toolSettings.roomPlacement === 'stamp'
            ? 'Click once on the canvas to stamp a chamber block.'
            : 'Click-drag on the canvas to outline a room footprint.'
          : 'Use the action button to switch into the room tool first.';
      case 'draw-corridor':
        return activeTool === 'corridor'
          ? 'Drag from the room edge into open space. The corridor will snap into the floorplan.'
          : 'Switch into the corridor tool, then drag on the canvas.';
      case 'place-door':
        return activeTool === 'doorway'
          ? 'Click directly on a room wall or corridor edge. The doorway will snap into place.'
          : 'Switch into the door tool first, then place it on the floorplan.';
      case 'link-door':
        return linkedTransitionCount > 0
          ? 'The doorway is linked. The next step is to switch into Navigate mode and travel through it.'
          : 'Create the tutorial destination map, then pair the selected doorway from the Links inspector.';
      case 'add-note':
        return activeTool === 'note'
          ? 'Drop a note near the room or corridor you want to annotate.'
          : 'Switch into the note tool, then click the canvas to add a field note.';
      case 'navigate-mode':
        return editorMode === 'navigate'
          ? 'The editor is now safe for travel. Click a linked hotspot on the canvas.'
          : 'Switch into Navigate mode so doorway hotspots become travel controls.';
      case 'travel':
        return 'Click the glowing hotspot on the map itself. The walkthrough advances when the active map changes.';
      case 'review':
        return 'Use the bottom drawer to keep open tasks and route gaps visible while you map.';
      default:
        return step.body;
    }
  })();

  const tutorialHelper = (() => {
    if (step.id === 'draw-room' && map.floorRooms.length === 0) {
      return {
        label: 'Stamp Sample Room',
        onClick: () => addFloorRoom({ x: 336, y: 240, width: 240, height: 168 }),
      };
    }

    if (step.id === 'draw-corridor' && map.corridors.length === 0 && map.floorRooms.length > 0) {
      const room = map.floorRooms[0];
      const y = room.bounds.y + room.bounds.height / 2;
      return {
        label: 'Lay Sample Corridor',
        onClick: () =>
          addCorridor([
            { x: room.bounds.x + room.bounds.width, y },
            { x: room.bounds.x + room.bounds.width + 144, y },
          ]),
      };
    }

    if (step.id === 'place-door' && map.doorways.length === 0) {
      if (map.corridors.length > 0) {
        const corridor = map.corridors[0];
        const position = corridor.points[corridor.points.length - 1];
        return {
          label: 'Add Sample Door',
          onClick: () => addDoorwayAt(position, 'north'),
        };
      }

      if (map.floorRooms.length > 0) {
        const room = map.floorRooms[0];
        return {
          label: 'Add Sample Door',
          onClick: () =>
            addDoorwayAt(
              { x: room.bounds.x + room.bounds.width, y: room.bounds.y + room.bounds.height / 2 },
              'east',
            ),
        };
      }
    }

    if (step.id === 'add-note' && map.notesBoard.length === 0) {
      const room = map.floorRooms[0];
      return {
        label: 'Drop Sample Note',
        onClick: () =>
          addNoteAt(
            room
              ? { x: room.bounds.x + room.bounds.width / 2 + 36, y: room.bounds.y + room.bounds.height / 2 + 44 }
              : { x: 520, y: 340 },
          ),
      };
    }

    if (step.id === 'travel') {
      const linkedTransition = map.transitions.find((entry) => entry.destinationMapId);
      if (!linkedTransition?.destinationMapId) return null;
      return {
        label: 'Travel Linked Exit',
        onClick: () =>
          openMap(linkedTransition.destinationMapId!, {
            anchorId: linkedTransition.destinationAnchorId,
            highlightedTransitionId: linkedTransition.id,
          }),
      };
    }

    return null;
  })();

  const skipStep = () => {
    if (onboarding.step >= tutorialSteps.length - 1) {
      dismissOnboarding(true);
      return;
    }
    nextOnboardingStep();
  };

  return (
    <AnimatePresence>
      {onboarding.show ? (
        <motion.div
          className="tutorial-backdrop"
          data-testid="tutorial-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {highlight ? (
            <motion.div
              animate={{
                top: highlight.top,
                left: highlight.left,
                width: highlight.width,
                height: highlight.height,
              }}
              className="tutorial-highlight"
              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            />
          ) : null}

          <motion.div
            className={cardPlacementClass}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
          >
            <span className="section-eyebrow">Guided Walkthrough</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <div className="tutorial-live-callout">
              <strong>{highlight ? 'Current next action' : 'Target hidden'}</strong>
              <p>
                {highlight
                  ? liveGuidance
                  : 'The walkthrough target is off-screen or hidden right now. Use Reveal Target and the tutorial will bring the right panel or control back into view.'}
              </p>
            </div>
            <div className="tutorial-checklist">
              {stepChecklist.map((item) => (
                <div className={`tutorial-checklist__item ${item.done ? 'is-done' : 'is-pending'}`} key={item.label}>
                  <span>{item.done ? 'Done' : 'Next'}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="tutorial-progress">
              <strong>Step {Math.min(onboarding.step + 1, tutorialSteps.length)} / {tutorialSteps.length}</strong>
              <small>
                {step.expectedTrigger
                  ? 'Complete the highlighted action to advance automatically, or skip ahead if you already know this step.'
                  : 'Use the action button to keep the walkthrough moving.'}
              </small>
            </div>
            <div className="tutorial-actions">
              {step.actionId ? (
                <GhostButton data-testid="tutorial-action" onClick={runStepAction}>
                  {step.actionLabel}
                </GhostButton>
              ) : null}
              {tutorialHelper ? (
                <GhostButton data-testid="tutorial-helper-action" onClick={tutorialHelper.onClick}>
                  {tutorialHelper.label}
                </GhostButton>
              ) : null}
              <GhostButton data-testid="tutorial-reveal-target" onClick={revealTarget}>Reveal Target</GhostButton>
              <GhostButton data-testid="tutorial-skip-step" onClick={skipStep}>Skip Step</GhostButton>
              <Button data-testid="tutorial-dismiss" onClick={() => dismissOnboarding(false)}>Dismiss Tour</Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
