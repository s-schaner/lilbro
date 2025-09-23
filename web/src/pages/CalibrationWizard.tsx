import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CalibrationData } from '../components/OverlayCanvas';

type WizardStep = 'frame' | 'court' | 'net' | 'confirm';

interface CalibrationWizardProps {
  open: boolean;
  onClose: () => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  uploadId?: string | null;
  apiBase: string;
  onSaved: (payload: CalibrationData) => void;
}

interface Point2D {
  x: number;
  y: number;
}

const COURT_TEMPLATE_POINTS: [number, number][] = [
  [0, 0],
  [18, 0],
  [18, 9],
  [0, 9],
];

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

const CORNER_LABELS = ['Left near', 'Right near', 'Right far', 'Left far'];

export const CalibrationWizard: React.FC<CalibrationWizardProps> = ({
  open,
  onClose,
  videoRef,
  uploadId,
  apiBase,
  onSaved,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [step, setStep] = useState<WizardStep>('frame');
  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [frameTime, setFrameTime] = useState<number>(0);
  const [imageSize, setImageSize] = useState<[number, number] | null>(null);
  const [cornerPoints, setCornerPoints] = useState<Point2D[]>([]);
  const [netPoints, setNetPoints] = useState<Point2D[]>([]);
  const [previewMatrix, setPreviewMatrix] = useState<number[][] | null>(null);
  const [previewInverse, setPreviewInverse] = useState<number[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('frame');
      setError(null);
      setSaving(false);
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('Video metadata not ready. Pause on the desired frame first.');
      return;
    }
    video.pause();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Unable to capture frame for calibration.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setFrameImage(dataUrl);
    setImageSize([canvas.width, canvas.height]);
    setFrameTime(video.currentTime);
    setCornerPoints([]);
    setNetPoints([]);
    setPreviewMatrix(null);
    setPreviewInverse(null);
    setStep('frame');
    setError(null);
  }, [open, videoRef]);

  useEffect(() => {
    if (step === 'confirm' && cornerPoints.length === 4) {
      const matrix = computeHomography(cornerPoints, COURT_TEMPLATE_POINTS);
      const inverse = invert3x3(matrix);
      setPreviewMatrix(matrix);
      setPreviewInverse(inverse);
    } else {
      setPreviewMatrix(null);
      setPreviewInverse(null);
    }
  }, [step, cornerPoints]);

  const handleStageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!imageSize) return;
      const img = imageRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = ((event.clientX - rect.left) / rect.width) * imageSize[0];
      const y = ((event.clientY - rect.top) / rect.height) * imageSize[1];

      if (x < 0 || y < 0 || x > imageSize[0] || y > imageSize[1]) return;

      if (step === 'court' && cornerPoints.length < 4) {
        setCornerPoints((prev) => [...prev, { x, y }]);
      } else if (step === 'net' && netPoints.length < 2) {
        setNetPoints((prev) => [...prev, { x, y }]);
      }
    },
    [cornerPoints.length, imageSize, netPoints.length, step],
  );

  const resetToFrame = useCallback(() => {
    setCornerPoints([]);
    setNetPoints([]);
    setStep('frame');
    setPreviewMatrix(null);
    setPreviewInverse(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!uploadId) {
      setError('Upload ID required to save calibration.');
      return;
    }
    if (!imageSize || cornerPoints.length !== 4 || netPoints.length !== 2) {
      setError('Calibration incomplete.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/calibration/${uploadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_t: frameTime,
          image_size: imageSize,
          image_points: cornerPoints.map(({ x, y }) => [x, y]),
          court_template: 'indoor_fivb_18x9',
          net_points: netPoints.map(({ x, y }) => [x, y]),
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Unable to save calibration');
      }
      const payload = (await response.json()) as CalibrationData;
      onSaved(payload);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [apiBase, cornerPoints, frameTime, imageSize, netPoints, onClose, onSaved, uploadId]);

  if (!open) return null;

  const canAdvanceCourt = cornerPoints.length === 4;
  const canAdvanceNet = netPoints.length === 2;

  const renderMarkers = useMemo(() => {
    if (!imageSize) return null;
    const markers: React.ReactNode[] = [];
    if (cornerPoints.length) {
      markers.push(
        <polyline
          key="court"
          points={cornerPoints
            .map((point) => `${point.x},${point.y}`)
            .concat(cornerPoints.length === 4 ? `${cornerPoints[0].x},${cornerPoints[0].y}` : [])
            .join(' ')}
          fill="none"
          stroke="rgba(56,189,248,0.8)"
          strokeWidth={2}
        />,
      );
      cornerPoints.forEach((point, index) => {
        markers.push(
          <g key={`corner-${index}`}>
            <circle cx={point.x} cy={point.y} r={6} fill="rgba(59,130,246,0.7)" />
            <text x={point.x + 8} y={point.y - 8} fill="white" fontSize={12}>
              {index + 1}
            </text>
          </g>,
        );
      });
    }
    if (netPoints.length) {
      if (netPoints.length === 2) {
        markers.push(
          <line
            key="net-line"
            x1={netPoints[0].x}
            y1={netPoints[0].y}
            x2={netPoints[1].x}
            y2={netPoints[1].y}
            stroke="rgba(250,204,21,0.8)"
            strokeWidth={3}
          />,
        );
      }
      netPoints.forEach((point, index) => {
        markers.push(
          <g key={`net-${index}`}>
            <circle cx={point.x} cy={point.y} r={6} fill="rgba(250,204,21,0.9)" />
            <text x={point.x + 8} y={point.y - 8} fill="white" fontSize={12}>
              N{index + 1}
            </text>
          </g>,
        );
      });
    }
    return (
      <svg
        viewBox={`0 0 ${imageSize[0]} ${imageSize[1]}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {markers}
      </svg>
    );
  }, [cornerPoints, imageSize, netPoints]);

  const renderConfirmOverlay = useMemo(() => {
    if (!imageSize || !previewInverse) return null;
    const segments: React.ReactNode[] = [];
    COURT_LINES.forEach(([[ux0, uy0], [ux1, uy1]], index) => {
      const start = applyMatrix(previewInverse, ux0, uy0);
      const end = applyMatrix(previewInverse, ux1, uy1);
      if (!start || !end) return;
      segments.push(
        <line
          key={`grid-${index}`}
          x1={start[0]}
          y1={start[1]}
          x2={end[0]}
          y2={end[1]}
          stroke="rgba(148,163,184,0.6)"
          strokeWidth={1.5}
        />,
      );
    });
    if (netPoints.length === 2) {
      segments.push(
        <line
          key="net-confirm"
          x1={netPoints[0].x}
          y1={netPoints[0].y}
          x2={netPoints[1].x}
          y2={netPoints[1].y}
          stroke="rgba(56,189,248,0.8)"
          strokeWidth={3}
        />,
      );
    }
    return (
      <svg
        viewBox={`0 0 ${imageSize[0]} ${imageSize[1]}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {segments}
      </svg>
    );
  }, [imageSize, netPoints, previewInverse]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
      <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Court Calibration</h2>
            <p className="text-xs text-slate-400">Align the overlay grid and net with the captured frame.</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
            <StepPill active={step === 'frame'}>Frame</StepPill>
            <StepPill active={step === 'court'}>Corners</StepPill>
            <StepPill active={step === 'net'}>Net</StepPill>
            <StepPill active={step === 'confirm'}>Confirm</StepPill>
          </div>
          <div
            ref={stageRef}
            onClick={handleStageClick}
            className="relative mx-auto mt-4 flex min-h-[360px] w-full max-w-3xl items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
          >
            {frameImage ? (
              <img ref={imageRef} src={frameImage} alt="Calibration frame" className="max-h-[400px] w-full object-contain" />
            ) : (
              <div className="py-32 text-center text-sm text-slate-400">Capture a frame from the video to begin.</div>
            )}
            {renderMarkers}
            {step === 'confirm' && renderConfirmOverlay}
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            {step === 'frame' && (
              <p>Use the paused frame currently visible in the player for calibration. Click “Mark corners” to begin.</p>
            )}
            {step === 'court' && (
              <div>
                <p>Click the four court corners in order: left-near, right-near, right-far, left-far.</p>
                <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  {CORNER_LABELS.map((label, index) => (
                    <li
                      key={label}
                      className={`rounded border px-2 py-1 ${
                        cornerPoints[index]
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
                          : 'border-slate-700 text-slate-500'
                      }`}
                    >
                      {index + 1}. {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step === 'net' && (
              <p>Click two points along the top of the net tape to define the net line.</p>
            )}
            {step === 'confirm' && (
              <p>Review the overlay alignment below. If everything looks correct, save the calibration to enable court overlays.</p>
            )}
          </div>
          {error && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
          )}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-300 hover:border-slate-500"
              onClick={resetToFrame}
            >
              Reset
            </button>
            <div className="flex items-center gap-2">
              {step !== 'frame' && (
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-300 hover:border-slate-500"
                  onClick={() => {
                    if (step === 'court') {
                      setCornerPoints((prev) => prev.slice(0, -1));
                    } else if (step === 'net') {
                      setNetPoints((prev) => prev.slice(0, -1));
                    }
                    setStep(step === 'confirm' ? 'net' : step === 'net' ? 'court' : 'frame');
                  }}
                >
                  Back
                </button>
              )}
              {step === 'frame' && (
                <button
                  type="button"
                  className="rounded-md bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                  onClick={() => setStep('court')}
                >
                  Mark corners
                </button>
              )}
              {step === 'court' && (
                <button
                  type="button"
                  disabled={!canAdvanceCourt}
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                    canAdvanceCourt ? 'bg-brand text-white' : 'bg-slate-800 text-slate-500'
                  }`}
                  onClick={() => setStep('net')}
                >
                  Mark net
                </button>
              )}
              {step === 'net' && (
                <button
                  type="button"
                  disabled={!canAdvanceNet}
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                    canAdvanceNet ? 'bg-brand text-white' : 'bg-slate-800 text-slate-500'
                  }`}
                  onClick={() => setStep('confirm')}
                >
                  Review
                </button>
              )}
              {step === 'confirm' && (
                <button
                  type="button"
                  className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 hover:bg-emerald-400"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save calibration'}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 text-right text-[11px] text-slate-500">
            Frame time: {frameTime.toFixed(2)}s
          </div>
        </div>
      </div>
    </div>
  );
};

const StepPill: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <span
    className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${
      active
        ? 'border-brand/40 bg-brand/20 text-brand-100'
        : 'border-slate-700 bg-slate-800 text-slate-500'
    }`}
  >
    {children}
  </span>
);

function computeHomography(imagePoints: Point2D[], courtPoints: [number, number][]): number[][] {
  if (imagePoints.length !== courtPoints.length || imagePoints.length !== 4) {
    throw new Error('Homography requires four point correspondences.');
  }
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = imagePoints[i];
    const [u, v] = courtPoints[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const solution = solveLinearSystem(a, b);
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solution;
  return [
    [h0, h1, h2],
    [h3, h4, h5],
    [h6, h7, 1],
  ];
}

function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = a.length;
  const m = a[0].length;
  const augmented = a.map((row, index) => [...row, b[index]]);
  for (let col = 0; col < m; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][col]) < 1e-9) {
      continue;
    }
    if (pivot !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivot];
      augmented[pivot] = temp;
    }
    const pivotValue = augmented[col][col];
    for (let j = col; j <= m; j += 1) {
      augmented[col][j] /= pivotValue;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= m; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }
  return augmented.slice(0, m).map((row) => row[m]);
}

function invert3x3(matrix: number[][] | null): number[][] | null {
  if (!matrix) return null;
  const size = 3;
  const augmented = matrix.map((row, index) => {
    const identity = Array(size)
      .fill(0)
      .map((_, idx) => (idx === index ? 1 : 0));
    return [...row, ...identity];
  });
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][col]) < 1e-9) {
      return null;
    }
    if (pivot !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivot];
      augmented[pivot] = temp;
    }
    const pivotValue = augmented[col][col];
    for (let j = col; j < size * 2; j += 1) {
      augmented[col][j] /= pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j < size * 2; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }
  return augmented.map((row) => row.slice(size));
}

function applyMatrix(matrix: number[][], x: number, y: number): [number, number] | null {
  if (!matrix || matrix.length !== 3) return null;
  const denom = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];
  if (Math.abs(denom) < 1e-6) return null;
  const px = (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / denom;
  const py = (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / denom;
  return [px, py];
}
