import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import Konva from 'konva';

import type { TileGrid } from '../../models/tilemap';
import type { LoadedAssetPack } from '../../models/tilemap';
import {
  createRenderCache,
  invalidateAll,
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
  const [pack, setPack] = useState<LoadedAssetPack | null>(null);
  const konvaRef = useRef<Konva.Image | null>(null);

  useEffect(() => {
    loadAssetPack(packId).then(setPack).catch(console.error);
  }, [packId]);

  useEffect(() => {
    invalidateAll(cacheRef.current);
  }, [grid, pack]);

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
