# Repo Guidance

- Primary 2D editor file: `src/components/canvas/MapCanvas.tsx`
- Primary 3D preview file: `src/components/canvas/MapThreePreview.tsx`
- Floorplan snapping and generated wall rebuild logic: `src/lib/floorplan.ts`
- App state and map sync logic: `src/store/useAppStore.ts`
- Shell and workspace layout: `src/app/AppShell.tsx`

# Validation

- `npm run lint`
- `npm run build`
- `npm run test:e2e`

# Geometry Notes

- Generated room wall segment ids may include suffixes such as `roomId_n__0` and `roomId_n__1`.
- Erase and ownership logic must continue to treat those generated segments as belonging to the source room.
