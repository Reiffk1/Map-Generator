import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { SvgMapIcon, builtInIconLibrary } from '../../data/iconLibrary';
import type { MapRecord, ProjectRecord } from '../../models/types';
import { useAppStore } from '../../store/useAppStore';

export function IconPickerModal({
  project,
  map,
}: {
  project: ProjectRecord;
  map: MapRecord;
}) {
  const open = useAppStore((state) => state.iconPickerOpen);
  const setOpen = useAppStore((state) => state.setIconPickerOpen);
  const selection = useAppStore((state) => state.selection);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const [query, setQuery] = useState('');

  const selectedMarker =
    selection.kind === 'marker' ? map.markers.find((marker) => marker.id === selection.ids[0]) : undefined;

  const icons = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return builtInIconLibrary;

    return builtInIconLibrary.filter(
      (icon) =>
        icon.label.toLowerCase().includes(normalized) ||
        icon.keywords.some((keyword) => keyword.includes(normalized)),
    );
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="icon-picker-modal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <span className="section-eyebrow">Icon Library</span>
                <h3>Pick a map symbol</h3>
              </div>
            </div>
            <input
              autoFocus
              className="command-palette__input"
              placeholder="Search built-in symbols"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="icon-grid is-modal">
              {icons.map((icon) => (
                <button
                  key={icon.id}
                  className={`icon-grid__item ${selectedMarker?.iconId === icon.id ? 'is-active' : ''}`}
                  onClick={() => {
                    if (selectedMarker) {
                      updateEntity('marker', selectedMarker.id, { iconId: icon.id });
                    }
                    setOpen(false);
                  }}
                  type="button"
                >
                  <SvgMapIcon iconId={icon.id} size={22} />
                  <span>{icon.label}</span>
                </button>
              ))}
            </div>
            {project.uploadedIcons.length ? (
              <div className="uploaded-icons-strip">
                {project.uploadedIcons.map((icon) => (
                  <button
                    key={icon.id}
                    className={`icon-grid__item ${selectedMarker?.iconId === icon.id ? 'is-active' : ''}`}
                    onClick={() => {
                      if (selectedMarker) {
                        updateEntity('marker', selectedMarker.id, { iconId: icon.id });
                      }
                      setOpen(false);
                    }}
                    type="button"
                  >
                    <img alt="" src={icon.src} width={22} height={22} />
                    <span>{icon.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
