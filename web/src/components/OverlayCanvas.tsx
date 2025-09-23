import React, { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import { OverlayTool } from '../hooks/useOverlayTool';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Poly {
  pts: [number, number][];
}

export interface AnnotationInput {
  frame_t: number;
  rect?: Rect;
  poly?: Poly;
  jersey?: number;
  label?: string;
  notes?: string;
}

export interface AnnotationRecord extends AnnotationInput {
  id: string;
  created_at?: string;
}

export interface CalibrationData {
  frame_t: number;
  image_size: [number, number];
  image_points: [number, number][];
  court_template: string;
  court_points: [number, number][];
  net_points: [number, number][];
  net_court_points?: [number, number][];
  homography: number[][];
  homography_inv: number[][];
}

interface OverlayCanvasProps {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  mode: OverlayTool;
  uploadId?: string | null;
  annotations: AnnotationRecord[];
  onCreate: (payload: AnnotationInput) => Promise<AnnotationRecord | null>;
  calibration?: CalibrationData | null;
  pixelToCourt?: ((x: number, y: number) => [number, number] | null) | null;
  courtToPixel?: ((u: number, v: number) => [number, number] | null) | null;
}

interface LayoutMetrics {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

interface DraftRect {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

const COURT_LINES: [number, number][][] = [
  [
    [0, 0],
    [18, 0],
  ],
  [
    [18, 0],
    [18, 9],
  ],
  [
    [18, 9],
    [0, 9],
  ],
  [
    [0, 9],
    [0, 0],
  ],
  [
    [0, 4.5],
    [18, 4.5],
  ],
  [
    [0, 1.5],
    [18, 1.5],
  ],
  [
    [0, 7.5],
    [18, 7.5],
  ],
  [
    [6, 0],
    [6, 9],
  ],
  [
    [12, 0],
    [12, 9],
  ],
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const applyMatrix = (matrix: number[][], x: number, y: number): [number, number] | null => {
  if (!matrix || matrix.length !== 3 || matrix[0].length !== 3) return null;
  const [m0, m1, m2] = matrix;
  const denom = m2[0] * x + m2[1] * y + m2[2];
  if (Math.abs(denom) < 1e-6) return null;
  const px = (m0[0] * x + m0[1] * y + m0[2]) / denom;
  const py = (m1[0] * x + m1[1] * y + m1[2]) / denom;
  return [px, py];
};

const formatZoneLabel = (u: number, v: number): string => {
  const horizontal = u < 6 ? 'Left' : u < 12 ? 'Center' : 'Right';
  const depth = v < 4.5 ? 'Near' : 'Far';
  return `${depth} ${horizontal}`;
};

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  videoRef,
  mode,
  uploadId,
  annotations,
  onCreate,
  calibration,
  pixelToCourt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<LayoutMetrics | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [jersey, setJersey] = useState('');
  const [label, setLabel] = useState<'serve' | 'set' | 'attack' | 'block' | 'dig' | 'custom'>('serve');
  const [customLabel, setCustomLabel] = useState('');
  const [previewZone, setPreviewZone] = useState<string | null>(null);

  const syncLayout = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!container || !canvas || !video) return;

    const containerRect = container.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();

    const metrics: LayoutMetrics = {
      videoWidth: video.videoWidth || 0,
      videoHeight: video.videoHeight || 0,
      displayWidth: videoRect.width,
      displayHeight: videoRect.height,
      offsetX: videoRect.left - containerRect.left,
      offsetY: videoRect.top - containerRect.top,
    };

    setLayout(metrics);
    canvas.width = Math.round(containerRect.width);
    canvas.height = Math.round(containerRect.height);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const handleMetadata = () => syncLayout();
    const handleResize = () => syncLayout();
    const handleTimeUpdate = () => syncLayout();

    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    window.addEventListener('resize', handleResize);

    syncLayout();

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('resize', handleResize);
    };
  }, [videoRef, syncLayout]);

  const clearDraft = useCallback(() => {
    setIsDrawing(false);
    setDraftRect(null);
    setPreviewZone(null);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearDraft();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearDraft]);

  const imageToDisplay = useCallback(
    (x: number, y: number) => {
      if (!layout || !layout.videoWidth || !layout.videoHeight) return null;
      const px = layout.offsetX + (x / layout.videoWidth) * layout.displayWidth;
      const py = layout.offsetY + (y / layout.videoHeight) * layout.displayHeight;
      return { x: px, y: py };
    },
    [layout],
  );

  const normalizedToImage = useCallback(
    (rect: Rect) => {
      if (!layout || !layout.videoWidth || !layout.videoHeight) return null;
      return {
        x: rect.x * layout.videoWidth,
        y: rect.y * layout.videoHeight,
        w: rect.w * layout.videoWidth,
        h: rect.h * layout.videoHeight,
      };
    },
    [layout],
  );

  const getImageCoords = useCallback(
    (event: PointerEvent) => {
      const container = containerRef.current;
      const currentLayout = layout;
      if (!container || !currentLayout) return null;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const relX = x - currentLayout.offsetX;
      const relY = y - currentLayout.offsetY;

      if (
        relX < 0 ||
        relY < 0 ||
        relX > currentLayout.displayWidth ||
        relY > currentLayout.displayHeight
      ) {
        return null;
      }

      const imageX = (relX / (currentLayout.displayWidth || 1)) * currentLayout.videoWidth;
      const imageY = (relY / (currentLayout.displayHeight || 1)) * currentLayout.videoHeight;
      return { x: imageX, y: imageY };
    },
    [layout],
  );

  const renderOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!layout || !layout.videoWidth || !layout.videoHeight) {
      return;
    }

    const drawRect = (rect: Rect, color: string) => {
      const imgRect = normalizedToImage(rect);
      if (!imgRect) return;
      const start = imageToDisplay(imgRect.x, imgRect.y);
      if (!start) return;
      const end = imageToDisplay(imgRect.x + imgRect.w, imgRect.y + imgRect.h);
      if (!end) return;
      context.save();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      context.restore();
    };

    const drawPoly = (poly: Poly, color: string) => {
      const points = poly.pts
        .map(([nx, ny]) => {
          const x = nx * layout.videoWidth;
          const y = ny * layout.videoHeight;
          return imageToDisplay(x, y);
        })
        .filter(Boolean) as { x: number; y: number }[];
      if (points.length < 2) return;
      context.save();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        context.lineTo(points[i].x, points[i].y);
      }
      context.closePath();
      context.stroke();
      context.restore();
    };

    if (calibration) {
      context.save();
      context.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      context.lineWidth = 1.5;

      for (const [[ux0, uy0], [ux1, uy1]] of COURT_LINES) {
        const startCourt = applyMatrix(calibration.homography_inv, ux0, uy0);
        const endCourt = applyMatrix(calibration.homography_inv, ux1, uy1);
        if (!startCourt || !endCourt) continue;
        const start = imageToDisplay(startCourt[0], startCourt[1]);
        const end = imageToDisplay(endCourt[0], endCourt[1]);
        if (!start || !end) continue;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }

      if (calibration.net_points?.length === 2) {
        const [n0, n1] = calibration.net_points;
        const start = imageToDisplay(n0[0], n0[1]);
        const end = imageToDisplay(n1[0], n1[1]);
        if (start && end) {
          context.strokeStyle = 'rgba(56, 189, 248, 0.6)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
      }
      context.restore();
    }

    for (const annotation of annotations) {
      if (annotation.rect) {
        drawRect(annotation.rect, 'rgba(16, 185, 129, 0.85)');
      }
      if (annotation.poly) {
        drawPoly(annotation.poly, 'rgba(250, 204, 21, 0.85)');
      }
    }

    if (draftRect) {
      const start = imageToDisplay(draftRect.start.x, draftRect.start.y);
      const current = imageToDisplay(draftRect.current.x, draftRect.current.y);
      if (start && current) {
        context.save();
        context.strokeStyle = 'rgba(59, 130, 246, 0.9)';
        context.setLineDash([6, 3]);
        context.strokeRect(start.x, start.y, current.x - start.x, current.y - start.y);
        context.restore();
      }
    }
  }, [annotations, calibration, draftRect, imageToDisplay, layout, normalizedToImage]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (mode !== 'box') return;
      if (!uploadId) {
        setError('Annotations require an active upload.');
        return;
      }
      const coords = getImageCoords(event.nativeEvent);
      if (!coords) {
        return;
      }
      setError(null);
      setIsDrawing(true);
      setDraftRect({ start: coords, current: coords });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [getImageCoords, mode, uploadId],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawing || !draftRect) return;
      const coords = getImageCoords(event.nativeEvent);
      if (!coords) return;
      setDraftRect((prev) => (prev ? { start: prev.start, current: coords } : prev));
      const transform = pixelToCourt
        ? pixelToCourt
        : calibration
        ? (px: number, py: number) => applyMatrix(calibration.homography, px, py)
        : null;
      if (transform && layout) {
        const centerX = (draftRect.start.x + coords.x) / 2;
        const centerY = (draftRect.start.y + coords.y) / 2;
        const court = transform(centerX, centerY);
        if (court) {
          setPreviewZone(formatZoneLabel(court[0], court[1]));
        }
      }
    },
    [calibration, draftRect, getImageCoords, isDrawing, layout, pixelToCourt],
  );

  const finishRect = useCallback(
    async (endPoint: { x: number; y: number } | null) => {
      if (!draftRect || !layout || !layout.videoWidth || !layout.videoHeight) {
        clearDraft();
        return;
      }
      const end = endPoint ?? draftRect.current;
      const x0 = clamp(Math.min(draftRect.start.x, end.x), 0, layout.videoWidth);
      const y0 = clamp(Math.min(draftRect.start.y, end.y), 0, layout.videoHeight);
      const x1 = clamp(Math.max(draftRect.start.x, end.x), 0, layout.videoWidth);
      const y1 = clamp(Math.max(draftRect.start.y, end.y), 0, layout.videoHeight);

      const width = x1 - x0;
      const height = y1 - y0;

      if (width < 4 || height < 4) {
        clearDraft();
        return;
      }

      const normalized: Rect = {
        x: x0 / layout.videoWidth,
        y: y0 / layout.videoHeight,
        w: width / layout.videoWidth,
        h: height / layout.videoHeight,
      };

      const labelValue = label === 'custom' ? customLabel.trim() : label;
      const jerseyValue = jersey.trim();
      const notesValue = notes.trim();

      const payload: AnnotationInput = {
        frame_t: videoRef.current?.currentTime ?? 0,
        rect: normalized,
        label: labelValue ? labelValue : undefined,
        jersey: jerseyValue ? Number(jerseyValue) : undefined,
        notes: notesValue ? notesValue : undefined,
      };

      try {
        await onCreate(payload);
        const transform = pixelToCourt
          ? pixelToCourt
          : calibration
          ? (px: number, py: number) => applyMatrix(calibration.homography, px, py)
          : null;
        if (transform) {
          const centerX = x0 + width / 2;
          const centerY = y0 + height / 2;
          const court = transform(centerX, centerY);
          if (court) {
            setPreviewZone(formatZoneLabel(court[0], court[1]));
          } else {
            setPreviewZone(null);
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        clearDraft();
      }
    },
    [calibration, clearDraft, customLabel, jersey, label, layout, notes, onCreate, videoRef],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawing) return;
      const coords = getImageCoords(event.nativeEvent);
      setIsDrawing(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      finishRect(coords);
    },
    [finishRect, getImageCoords, isDrawing],
  );

  const handlePointerLeave = useCallback(() => {
    if (isDrawing) {
      finishRect(null);
    }
  }, [finishRect, isDrawing]);

  const disableInteraction = mode === 'lasso';

  const currentZone = previewZone;

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto absolute inset-0"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{ cursor: mode === 'box' ? 'crosshair' : 'default' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-transparent" />
      <div className="pointer-events-auto absolute bottom-4 left-4 w-72 rounded-lg border border-slate-700/60 bg-slate-900/90 p-4 text-xs shadow-lg backdrop-blur">
        <div className="flex items-center justify-between text-slate-300">
          <span className="font-semibold uppercase tracking-wide">Annotation Tags</span>
          <span className="text-[10px] uppercase text-slate-500">{mode.toUpperCase()}</span>
        </div>
        {!uploadId && (
          <p className="mt-2 text-[11px] text-amber-400">
            Upload a clip to enable saving annotations.
          </p>
        )}
        {disableInteraction && (
          <p className="mt-2 text-[11px] text-slate-400">Lasso tool coming soon.</p>
        )}
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase text-slate-500">Jersey #</span>
            <input
              type="number"
              value={jersey}
              onChange={(event) => setJersey(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase text-slate-500">Label</span>
            <select
              value={label}
              onChange={(event) => setLabel(event.target.value as typeof label)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
            >
              <option value="serve">Serve</option>
              <option value="set">Set</option>
              <option value="attack">Attack</option>
              <option value="block">Block</option>
              <option value="dig">Dig</option>
              <option value="custom">Custom…</option>
            </select>
            {label === 'custom' && (
              <input
                type="text"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Custom label"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
              />
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase text-slate-500">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
            />
          </label>
        </div>
        {currentZone && (
          <div className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
            Court zone: {currentZone}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
