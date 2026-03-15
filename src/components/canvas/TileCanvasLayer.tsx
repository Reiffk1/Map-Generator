import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import Konva from 'konva';

import type { TileGrid } from '../../models/tilemap';
import type { LoadedAssetPack, TileLayerName } from '../../models/tilemap';
import {
  createRenderCache,
  invalidateAll,
  invalidateChunkAt,
  renderTileGrid,
  type TileRenderCache,
} from '../../lib/tilemap/render';
import { loadAssetPack } from '../../lib/assets/assetPacks';

interface Props {
  grid: TileGrid;
  packId: string;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

interface GridSnapshot {
  width: number;
  height: number;
  tileSizePx: TileGrid['tileSizePx'];
  layers: Record<TileLayerName, Uint16Array>;
}

const layerNames: TileLayerName[] = ['terrain', 'floor', 'walls', 'doors', 'decor', 'fog'];

function cloneGridSnapshot(grid: TileGrid): GridSnapshot {
  return {
    width: grid.width,
    height: grid.height,
    tileSizePx: grid.tileSizePx,
    layers: {
      terrain: new Uint16Array(grid.layers.terrain.data),
      floor: new Uint16Array(grid.layers.floor.data),
      walls: new Uint16Array(grid.layers.walls.data),
      doors: new Uint16Array(grid.layers.doors.data),
      decor: new Uint16Array(grid.layers.decor.data),
      fog: new Uint16Array(grid.layers.fog.data),
    },
  };
}

function invalidateChangedChunks(cache: TileRenderCache, previous: GridSnapshot | null, next: TileGrid) {
  if (
    !previous ||
    previous.width !== next.width ||
    previous.height !== next.height ||
    previous.tileSizePx !== next.tileSizePx
  ) {
    invalidateAll(cache);
    return;
  }

  let changedTiles = 0;
  const largeChangeThreshold = Math.max(64, Math.floor((next.width * next.height) / 10));

  for (const layerName of layerNames) {
    const before = previous.layers[layerName];
    const after = next.layers[layerName].data;
    for (let index = 0; index < after.length; index += 1) {
      if (before[index] === after[index]) continue;
      const tileX = index % next.width;
      const tileY = Math.floor(index / next.width);
      invalidateChunkAt(cache, tileX, tileY);
      changedTiles += 1;
      if (changedTiles >= largeChangeThreshold) {
        invalidateAll(cache);
        return;
      }
    }
  }
}

export function TileCanvasLayer({
  grid,
  packId,
  viewportWidth,
  viewportHeight,
  zoom,
  panX,
  panY,
}: Props) {
  const imageNode = useMemo(
    () => (typeof document === 'undefined' ? null : document.createElement('canvas')),
    [],
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(imageNode);
  const cacheRef = useRef<TileRenderCache>(createRenderCache());
  const previousGridRef = useRef<GridSnapshot | null>(null);
  const [pack, setPack] = useState<LoadedAssetPack | null>(null);
  const konvaRef = useRef<Konva.Image | null>(null);

  useEffect(() => {
    loadAssetPack(packId).then(setPack).catch(console.error);
  }, [packId]);

  useEffect(() => {
    invalidateChangedChunks(cacheRef.current, previousGridRef.current, grid);
    previousGridRef.current = cloneGridSnapshot(grid);
  }, [grid, pack]);

  useEffect(() => {
    invalidateAll(cacheRef.current);
  }, [packId]);

  useEffect(() => {
    if (!viewportWidth || !viewportHeight) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixelW = Math.ceil(grid.width * grid.tileSizePx);
    const pixelH = Math.ceil(grid.height * grid.tileSizePx);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    const vpX = Math.max(0, -panX / zoom);
    const vpY = Math.max(0, -panY / zoom);

    renderTileGrid(canvas, grid, cacheRef.current, pack, {
      x: vpX,
      y: vpY,
      width: viewportWidth / zoom,
      height: viewportHeight / zoom,
      zoom: 1,
    }, true);

    if (konvaRef.current) {
      konvaRef.current.image(canvas);
      konvaRef.current.getLayer()?.batchDraw();
    }
  }, [grid, pack, viewportWidth, viewportHeight, zoom, panX, panY]);

  return (
    <KonvaImage
      ref={konvaRef}
      image={imageNode ?? undefined}
      x={0}
      y={0}
      width={grid.width * grid.tileSizePx}
      height={grid.height * grid.tileSizePx}
      listening={false}
    />
  );
}
