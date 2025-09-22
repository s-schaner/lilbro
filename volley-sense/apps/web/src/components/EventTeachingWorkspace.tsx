import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Square,
  BezierCurve,
  Dot,
  Eye,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  Loader2,
  Target,
  Rows2,
  Scan,
  Lightbulb,
  Wand2
} from 'lucide-react';
import { nanoid } from 'nanoid';

import {
  Annotation,
  BallTag,
  ContactTag,
  CourtZoneTag,
  EventExample,
  GazeTag,
  HandTag,
  Keypoint,
  Player,
  Rect,
  StanceTag,
  Tag,
  TrainerTemplate,
  TrainingJob,
  VlmAssistResponse
} from '@lib/types';
import {
  createEventExample,
  fetchTrainingStatus,
  requestTraining,
  requestVlmAssist
} from '@lib/api';

const TOOLTIP = {
  box: 'Draw rectangular region',
  lasso: 'Freehand polygon selection',
  keypoint: 'Drop keypoint onto frame',
  gaze: 'Drag an arrow to capture gaze vector'
} as const;

type Tool = keyof typeof TOOLTIP;

const STANCE_VALUES: StanceTag['value'][] = ['neutral', 'split', 'approach', 'jump'];
const CONTACT_VALUES: ContactTag['value'][] = ['serve', 'reception', 'set', 'attack', 'block', 'dig', 'tip'];
const HAND_STATES: HandTag['state'][] = ['platform', 'open', 'closed'];

type Props = {
  open: boolean;
  timestamp: number;
  duration: number;
  videoSrc: string | null;
  players: Player[];
  onClose: () => void;
  onCreateDefinition: (
    payload: { name: string; template: TrainerTemplate; threshold: number }
  ) => Promise<void | { id: string }> | void | { id: string };
  onNotify: (message: string) => void;
};

type AnnotationDraft = Annotation;

type AssistState = {
  pose: boolean;
  boxes: boolean;
  trail: boolean;
  net: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DEFAULT_ASSIST: AssistState = {
  pose: true,
  boxes: true,
  trail: true,
  net: true
};

const fpsDefault = 30;

const buildRect = (startX: number, startY: number, endX: number, endY: number): Rect => {
  const x = clamp(Math.min(startX, endX), 0, 1);
  const y = clamp(Math.min(startY, endY), 0, 1);
  const w = clamp(Math.abs(endX - startX), 0.001, 1);
  const h = clamp(Math.abs(endY - startY), 0.001, 1);
  return { x, y, w, h };
};

const useAnimation = (
  playing: boolean,
  onAdvance: () => void,
  deps: readonly unknown[]
) => {
  useEffect(() => {
    if (!playing) {
      return;
    }
    let frameId: number;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 1000 / fpsDefault) {
        onAdvance();
        last = now;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ...deps]);
};

const EventTeachingWorkspace = ({
  open,
  timestamp,
  duration,
  videoSrc,
  players,
  onClose,
  onCreateDefinition,
  onNotify
}: Props) => {
  const [tool, setTool] = useState<Tool>('box');
  const [assist, setAssist] = useState<AssistState>(DEFAULT_ASSIST);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [fps, setFps] = useState(fpsDefault);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [keyFrame, setKeyFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(0);
  const [annotations, setAnnotations] = useState<AnnotationDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingLasso, setPendingLasso] = useState<[number, number][]>([]);
  const [gazeOrigin, setGazeOrigin] = useState<[number, number] | null>(null);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<TrainerTemplate>('Contact');
  const [threshold, setThreshold] = useState(0.7);
  const [team, setTeam] = useState<'home' | 'away' | ''>('');
  const [playerInput, setPlayerInput] = useState('');
  const [notes, setNotes] = useState('');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [focus, setFocus] = useState('Blocking footwork and hand placement');
  const [hints, setHints] = useState('left pin blocker, opponent swing');
  const [confidence, setConfidence] = useState(0.75);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null);
  const [vlmResult, setVlmResult] = useState<VlmAssistResponse | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const totalFrames = useMemo(() => {
    const span = Math.max(clipEnd - clipStart, 0.1);
    return Math.max(1, Math.round(span * fps));
  }, [clipEnd, clipStart, fps]);

  const maxFrameIndex = totalFrames - 1;

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedId) ?? null,
    [annotations, selectedId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const start = Math.max(timestamp - 1.5, 0);
    const end = Math.min(duration || timestamp + 1.5, timestamp + 1.5);
    setClipStart(Number(start.toFixed(2)));
    setClipEnd(Number(Math.max(end, start + 0.5).toFixed(2)));
    const primaryFrame = Math.round((timestamp - start) * fps);
    setKeyFrame(clamp(primaryFrame, 0, maxFrameIndex));
    setCurrentFrame(clamp(primaryFrame, 0, maxFrameIndex));
    setEndFrame(clamp(primaryFrame + Math.round(0.75 * fps), 0, maxFrameIndex));
    setAnnotations([]);
    setSelectedId(null);
    setPendingLasso([]);
    setPlaying(false);
    setAssist(DEFAULT_ASSIST);
    setVlmResult(null);
  }, [open, timestamp, duration, fps, maxFrameIndex]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!open) {
        return;
      }
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === 'ArrowRight') {
        setCurrentFrame((frame) => Math.min(frame + 1, maxFrameIndex));
      }
      if (event.key === 'ArrowLeft') {
        setCurrentFrame((frame) => Math.max(frame - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, maxFrameIndex, onClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const time = clipStart + currentFrame / fps;
    if (!Number.isNaN(time)) {
      video.currentTime = time;
    }
  }, [clipStart, currentFrame, fps]);

  useAnimation(
    playing,
    () => {
      setCurrentFrame((frame) => {
        if (frame >= maxFrameIndex) {
          setPlaying(false);
          return frame;
        }
        return Math.min(frame + 1, maxFrameIndex);
      });
    },
    [maxFrameIndex]
  );

  useEffect(() => {
    if (!trainingJob || trainingJob.status === 'completed') {
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const updated = await fetchTrainingStatus(trainingJob.job_id);
        setTrainingJob(updated);
        if (updated.status === 'completed') {
          onNotify('Training job finished. Updated precision and recall metrics ready.');
        }
      } catch (error) {
        console.error(error);
        onNotify('Unable to poll training status.');
        window.clearInterval(interval);
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [trainingJob, onNotify]);

  const annotationList = useMemo(
    () =>
      annotations.map((annotation) => ({
        id: annotation.id,
        frame: annotation.frame,
        jersey: annotation.jersey ?? undefined,
        hasGaze: annotation.tags.some((tag) => tag.kind === 'gaze'),
        label: `Region ${annotation.id.slice(-4)}`
      })),
    [annotations]
  );

  const handlePointerDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) {
      return;
    }
    const rect = overlayRef.current.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    if (tool === 'box') {
      setPendingLasso([]);
      const id = nanoid();
      const region = buildRect(x, y, x, y);
      const annotation: AnnotationDraft = {
        id,
        frame: currentFrame,
        region,
        tags: [],
        keypoints: []
      };
      setAnnotations((prev) => [...prev, annotation]);
      setSelectedId(id);
      const handleMove = (moveEvent: MouseEvent) => {
        const mx = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
        const my = clamp((moveEvent.clientY - rect.top) / rect.height, 0, 1);
        setAnnotations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, region: buildRect(x, y, mx, my) } : item))
        );
      };
      const handleUp = (upEvent: MouseEvent) => {
        const ux = clamp((upEvent.clientX - rect.left) / rect.width, 0, 1);
        const uy = clamp((upEvent.clientY - rect.top) / rect.height, 0, 1);
        setAnnotations((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, region: buildRect(x, y, ux, uy), frame: currentFrame } : item
          )
        );
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    if (tool === 'lasso') {
      setPendingLasso((prev) => [...prev, [x, y]]);
    }
    if (tool === 'keypoint') {
      if (selectedAnnotation) {
        const keypoint: Keypoint = { x, y };
        setAnnotations((prev) =>
          prev.map((item) =>
            item.id === selectedAnnotation.id
              ? { ...item, keypoints: [...(item.keypoints ?? []), keypoint] }
              : item
          )
        );
      } else {
        const id = nanoid();
        const annotation: AnnotationDraft = {
          id,
          frame: currentFrame,
          region: buildRect(x, y, x + 0.01, y + 0.01),
          tags: [],
          keypoints: [{ x, y }]
        };
        setAnnotations((prev) => [...prev, annotation]);
        setSelectedId(id);
      }
    }
    if (tool === 'gaze') {
      setGazeOrigin([x, y]);
    }
  };

  const handlePointerUp = (event: MouseEvent<HTMLDivElement>) => {
    if (tool !== 'gaze' || !gazeOrigin || !selectedAnnotation) {
      return;
    }
    if (!overlayRef.current) {
      return;
    }
    const rect = overlayRef.current.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const vec: GazeTag['vec'] = [Number((x - gazeOrigin[0]).toFixed(2)), Number((y - gazeOrigin[1]).toFixed(2))];
    const gazeTag: GazeTag = { kind: 'gaze', vec };
    setAnnotations((prev) =>
      prev.map((annotation) =>
        annotation.id === selectedAnnotation.id
          ? {
              ...annotation,
              tags: [...annotation.tags.filter((tag) => tag.kind !== 'gaze'), gazeTag]
            }
          : annotation
      )
    );
    setGazeOrigin(null);
  };

  const handleCompleteLasso = () => {
    if (pendingLasso.length < 3) {
      setPendingLasso([]);
      return;
    }
    const id = nanoid();
    const annotation: AnnotationDraft = {
      id,
      frame: currentFrame,
      region: { pts: pendingLasso.map(([px, py]) => [Number(px.toFixed(3)), Number(py.toFixed(3))]) },
      tags: [],
      keypoints: []
    };
    setAnnotations((prev) => [...prev, annotation]);
    setSelectedId(id);
    setPendingLasso([]);
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const upsertTag = <T extends Tag>(kind: T['kind'], factory: () => T) => {
    if (!selectedAnnotation) {
      return;
    }
    setAnnotations((prev) =>
      prev.map((annotation) =>
        annotation.id === selectedAnnotation.id
          ? {
              ...annotation,
              tags: [...annotation.tags.filter((tag) => tag.kind !== kind), factory()]
            }
          : annotation
      )
    );
  };

  const clearTag = (kind: Tag['kind']) => {
    if (!selectedAnnotation) {
      return;
    }
    setAnnotations((prev) =>
      prev.map((annotation) =>
        annotation.id === selectedAnnotation.id
          ? {
              ...annotation,
              tags: annotation.tags.filter((tag) => tag.kind !== kind)
            }
          : annotation
      )
    );
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!annotations.length) {
      onNotify('Add at least one annotation before saving.');
      return;
    }
    if (!name.trim()) {
      onNotify('Provide a descriptive name for the event.');
      return;
    }
    setSaving(true);
    try {
      const clip = {
        startT: clipStart,
        endT: clipEnd,
        fps,
        src: videoSrc ?? 'proxy.mp4'
      };
      const examplePayload: Omit<EventExample, 'id'> & { id?: string } = {
        name,
        clip,
        keyFrame,
        endFrame,
        annotations,
        naturalLanguage,
        template,
        team: team || undefined,
        confidence
      };
      const example = await createEventExample(examplePayload);
      const definitionResult = await onCreateDefinition({ name, template, threshold });
      onNotify('Example saved. Shadow training kicked off.');
      if (definitionResult && 'id' in definitionResult && definitionResult.id) {
        const job = await requestTraining({ event_id: definitionResult.id, example_ids: [example.id] });
        setTrainingJob(job);
      }
      setAnnotations([]);
      setSelectedId(null);
      setPendingLasso([]);
    } catch (error) {
      console.error(error);
      onNotify('Unable to persist training example.');
    } finally {
      setSaving(false);
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleAssist = async () => {
    const image = captureFrame();
    if (!image) {
      onNotify('Unable to capture frame for assist.');
      return;
    }
    try {
      const payload = await requestVlmAssist({
        focus,
        hints: hints
          .split(',')
          .map((hint) => hint.trim())
          .filter(Boolean),
        image_b64: image
      });
      setVlmResult(payload);
      onNotify('Vision-language assist ready. Apply fields from the Insights card.');
    } catch (error) {
      console.error(error);
      onNotify('Assist call failed. Check VLM endpoint health.');
    }
  };

  const applyAssistToSelection = () => {
    if (!vlmResult || !selectedAnnotation) {
      return;
    }
    setAnnotations((prev) =>
      prev.map((annotation) => {
        if (annotation.id !== selectedAnnotation.id) {
          return annotation;
        }
        const updatedTags: Tag[] = annotation.tags.filter(
          (tag) => !['stance', 'hand', 'courtZone', 'ball', 'contact'].includes(tag.kind)
        );
        const stanceValue = STANCE_VALUES.find((value) => value === vlmResult.stance);
        if (stanceValue) {
          updatedTags.push({ kind: 'stance', value: stanceValue });
        }
        const handState = HAND_STATES.find((value) => value === vlmResult.hand_state);
        if (handState) {
          const handTag: HandTag = {
            kind: 'hand',
            side: 'L',
            state: handState,
            aboveTape: typeof vlmResult.above_tape === 'boolean' ? vlmResult.above_tape : undefined
          };
          updatedTags.push(handTag);
        }
        if (typeof vlmResult.court_zone === 'number' && vlmResult.court_zone >= 1 && vlmResult.court_zone <= 6) {
          const courtTag: CourtZoneTag = {
            kind: 'courtZone',
            zone: vlmResult.court_zone as CourtZoneTag['zone'],
            row: 'front'
          };
          updatedTags.push(courtTag);
        }
        const contactValue = CONTACT_VALUES.find((value) => value === vlmResult.contact_type);
        if (contactValue) {
          updatedTags.push({ kind: 'contact', value: contactValue });
        }
        const ballTag: BallTag = {
          kind: 'ball',
          prox: 'near',
          side: 'ours',
          aboveTape: vlmResult.above_tape ?? undefined
        };
        updatedTags.push(ballTag);
        return {
          ...annotation,
          tags: updatedTags
        };
      })
    );
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Teach New Event</h2>
            <p className="text-xs text-slate-400">
              Annotate the micro-sequence and pair with trainer metadata. Clips auto-center on {timestamp.toFixed(1)}s.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Close
          </button>
        </header>
        <form className="flex flex-1 overflow-hidden" onSubmit={handleSave}>
          <div className="flex flex-[2] flex-col border-r border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              {(['box', 'lasso', 'keypoint', 'gaze'] as Tool[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTool(option)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                    tool === option
                      ? 'border-primary-500 bg-primary-500/20 text-primary-200'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500'
                  )}
                  title={TOOLTIP[option]}
                >
                  {option === 'box' && <Square className="h-4 w-4" />}
                  {option === 'lasso' && <BezierCurve className="h-4 w-4" />}
                  {option === 'keypoint' && <Dot className="h-4 w-4" />}
                  {option === 'gaze' && <Eye className="h-4 w-4" />}
                  {option}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-300">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={assist.pose}
                    onChange={(event) => setAssist((prev) => ({ ...prev, pose: event.target.checked }))}
                  />
                  Pose
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={assist.boxes}
                    onChange={(event) => setAssist((prev) => ({ ...prev, boxes: event.target.checked }))}
                  />
                  Player boxes
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={assist.trail}
                    onChange={(event) => setAssist((prev) => ({ ...prev, trail: event.target.checked }))}
                  />
                  Ball trail
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={assist.net}
                    onChange={(event) => setAssist((prev) => ({ ...prev, net: event.target.checked }))}
                  />
                  Net
                </label>
              </div>
            </div>
            <div className="relative flex-1">
              <div
                ref={overlayRef}
                className="relative h-full w-full cursor-crosshair overflow-hidden"
                onMouseDown={handlePointerDown}
                onMouseUp={handlePointerUp}
                onDoubleClick={handleCompleteLasso}
              >
                {videoSrc ? (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    muted
                    className="h-full w-full object-cover"
                    playsInline
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-sm text-slate-300">
                    No proxy stream loaded yet.
                  </div>
                )}
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000">
                  {annotations.map((annotation) => {
                    if ('pts' in annotation.region) {
                      const path = annotation.region.pts
                        .map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px * 1000} ${py * 1000}`)
                        .join(' ');
                      return (
                        <path
                          key={annotation.id}
                          d={`${path} Z`}
                          stroke={selectedId === annotation.id ? '#38bdf8' : '#cbd5f5'}
                          strokeWidth={selectedId === annotation.id ? 3 : 2}
                          fill="rgba(56, 189, 248, 0.2)"
                        />
                      );
                    }
                    const { x, y, w, h } = annotation.region as Rect;
                    return (
                      <rect
                        key={annotation.id}
                        x={x * 1000}
                        y={y * 1000}
                        width={w * 1000}
                        height={h * 1000}
                        stroke={selectedId === annotation.id ? '#38bdf8' : '#cbd5f5'}
                        strokeWidth={selectedId === annotation.id ? 3 : 2}
                        fill="rgba(56, 189, 248, 0.18)"
                      />
                    );
                  })}
                  {annotations.flatMap((annotation) =>
                    (annotation.keypoints ?? []).map((point, index) => (
                      <circle
                        key={`${annotation.id}-kp-${index}`}
                        cx={point.x * 1000}
                        cy={point.y * 1000}
                        r={6}
                        fill="#facc15"
                        stroke="#1e293b"
                        strokeWidth={2}
                      />
                    ))
                  )}
                  {pendingLasso.length ? (
                    <polyline
                      points={pendingLasso.map(([px, py]) => `${px * 1000},${py * 1000}`).join(' ')}
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="none"
                    />
                  ) : null}
                  {assist.net ? (
                    <line x1={0} y1={520} x2={1000} y2={520} stroke="#ec4899" strokeDasharray="8 6" strokeWidth={2} />
                  ) : null}
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-3 text-xs">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-slate-500"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? 'Pause' : 'Play'}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentFrame((frame) => Math.max(frame - 1, 0))}
                  className="rounded-lg border border-slate-700 p-1 text-slate-200 hover:border-slate-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentFrame((frame) => Math.min(frame + 1, maxFrameIndex))}
                  className="rounded-lg border border-slate-700 p-1 text-slate-200 hover:border-slate-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={maxFrameIndex}
                step={1}
                value={currentFrame}
                onChange={(event) => setCurrentFrame(Number(event.target.value))}
                className="w-full accent-primary-500"
              />
              <span className="tabular-nums text-slate-300">Frame {currentFrame}</span>
            </div>
          </div>
          <aside className="flex w-[360px] flex-col overflow-y-auto bg-slate-950/50">
            <section className="border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Clip controls</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <label className="flex flex-col gap-1">
                  Start (s)
                  <input
                    type="number"
                    value={clipStart}
                    onChange={(event) => setClipStart(Number(event.target.value))}
                    step={0.1}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  End (s)
                  <input
                    type="number"
                    value={clipEnd}
                    onChange={(event) => setClipEnd(Math.max(Number(event.target.value), clipStart + 0.1))}
                    step={0.1}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  FPS
                  <input
                    type="number"
                    value={fps}
                    onChange={(event) => setFps(Math.max(Number(event.target.value), 5))}
                    step={1}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Key frame
                  <input
                    type="number"
                    value={keyFrame}
                    min={0}
                    max={maxFrameIndex}
                    onChange={(event) => setKeyFrame(clamp(Number(event.target.value), 0, maxFrameIndex))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  End frame
                  <input
                    type="number"
                    value={endFrame}
                    min={keyFrame}
                    max={maxFrameIndex}
                    onChange={(event) => setEndFrame(clamp(Number(event.target.value), keyFrame, maxFrameIndex))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </label>
              </div>
            </section>
            <section className="border-b border-slate-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Regions</h3>
                <span className="text-[11px] text-slate-400">{annotations.length} annotated</span>
              </div>
              <div className="mt-2 space-y-2">
                {annotationList.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => setSelectedId(annotation.id)}
                    className={clsx(
                      'w-full rounded-lg border px-3 py-2 text-left text-xs transition',
                      selectedId === annotation.id
                        ? 'border-primary-500 bg-primary-500/10 text-primary-100'
                        : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{annotation.label}</span>
                      <span className="text-[10px] text-slate-400">Frame {annotation.frame}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      {annotation.jersey ? <span>#{annotation.jersey}</span> : null}
                      {annotation.hasGaze ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Eye className="h-3 w-3" /> Gaze
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center text-rose-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteAnnotation(annotation.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </button>
                ))}
                {pendingLasso.length ? (
                  <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    Lasso capturing… double click to close ({pendingLasso.length} pts)
                  </div>
                ) : null}
              </div>
            </section>
            <section className="border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold">Properties</h3>
              {selectedAnnotation ? (
                <div className="mt-3 space-y-3 text-xs text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Frame</span>
                    <input
                      type="number"
                      value={selectedAnnotation.frame}
                      min={0}
                      max={maxFrameIndex}
                      onChange={(event) =>
                        setAnnotations((prev) =>
                          prev.map((annotation) =>
                            annotation.id === selectedAnnotation.id
                              ? { ...annotation, frame: clamp(Number(event.target.value), 0, maxFrameIndex) }
                              : annotation
                          )
                        )
                      }
                      className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Jersey</span>
                    <input
                      list="trainer-jerseys"
                      value={selectedAnnotation.jersey ?? ''}
                      onChange={(event) =>
                        setAnnotations((prev) =>
                          prev.map((annotation) =>
                            annotation.id === selectedAnnotation.id
                              ? { ...annotation, jersey: event.target.value ? Number(event.target.value) : undefined }
                              : annotation
                          )
                        )
                      }
                      className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right"
                    />
                    <datalist id="trainer-jerseys">
                      {players.map((player) => (
                        <option key={player.jersey} value={player.jersey}>
                          #{player.jersey} {player.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Tag stance</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {STANCE_VALUES.map((stance) => (
                        <button
                          key={stance}
                          type="button"
                          onClick={() => upsertTag('stance', () => ({ kind: 'stance', value: stance }))}
                          className={clsx(
                            'rounded-full px-2 py-1 text-[10px] uppercase',
                            selectedAnnotation.tags.some(
                              (tag) => tag.kind === 'stance' && tag.value === stance
                            )
                              ? 'bg-primary-500/30 text-primary-100'
                              : 'bg-slate-800 text-slate-300'
                          )}
                        >
                          {stance}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Contact</span>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {CONTACT_VALUES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => upsertTag('contact', () => ({ kind: 'contact', value }))}
                          className={clsx(
                            'rounded-full px-2 py-1 text-[10px] uppercase',
                            selectedAnnotation.tags.some(
                              (tag) => tag.kind === 'contact' && tag.value === value
                            )
                              ? 'bg-emerald-500/30 text-emerald-100'
                              : 'bg-slate-800 text-slate-300'
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Court zone</span>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={
                          selectedAnnotation.tags.find((tag) => tag.kind === 'courtZone')?.zone ?? ''
                        }
                        onChange={(event) => {
                          const zone = clamp(Number(event.target.value), 1, 6) as CourtZoneTag['zone'];
                          upsertTag('courtZone', () => ({ kind: 'courtZone', zone, row: 'front' }));
                        }}
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center"
                      />
                      <select
                        value={
                          selectedAnnotation.tags.find((tag) => tag.kind === 'courtZone')?.row ?? 'front'
                        }
                        onChange={(event) =>
                          upsertTag('courtZone', () => ({
                            kind: 'courtZone',
                            zone:
                              selectedAnnotation.tags.find((tag) => tag.kind === 'courtZone')?.zone || 4,
                            row: event.target.value as 'front' | 'back'
                          }))
                        }
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Collision risk</span>
                    <select
                      value={
                        selectedAnnotation.tags.find((tag) => tag.kind === 'collision')?.severity ?? ''
                      }
                      onChange={(event) => {
                        const severity = event.target.value as 'low' | 'med' | 'high' | '';
                        if (!severity) {
                          clearTag('collision');
                          return;
                        }
                        upsertTag('collision', () => ({ kind: 'collision', severity }));
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                    >
                      <option value="">None</option>
                      <option value="low">Low</option>
                      <option value="med">Med</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Ball proximity</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          upsertTag('ball', () => ({ kind: 'ball', prox: 'near', side: 'ours', aboveTape: true }))
                        }
                        className={clsx(
                          'rounded-full px-2 py-1',
                          selectedAnnotation.tags.some(
                            (tag) => tag.kind === 'ball' && tag.prox === 'near'
                          )
                            ? 'bg-sky-500/30 text-sky-100'
                            : 'bg-slate-800 text-slate-300'
                        )}
                      >
                        Near
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          upsertTag('ball', () => ({ kind: 'ball', prox: 'far', side: 'theirs', aboveTape: false }))
                        }
                        className={clsx(
                          'rounded-full px-2 py-1',
                          selectedAnnotation.tags.some(
                            (tag) => tag.kind === 'ball' && tag.prox === 'far'
                          )
                            ? 'bg-sky-500/30 text-sky-100'
                            : 'bg-slate-800 text-slate-300'
                        )}
                      >
                        Far
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Select a region to adjust stance, contact type, court zone, and ball proximity tags.
                </p>
              )}
            </section>
            <section className="border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold">Metadata</h3>
              <div className="mt-2 space-y-2 text-xs text-slate-200">
                <label className="block text-xs">
                  Event name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Collision at antenna"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                    required
                  />
                </label>
                <label className="block text-xs">
                  Template
                  <select
                    value={template}
                    onChange={(event) => setTemplate(event.target.value as TrainerTemplate)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  >
                    <option value="Contact">Contact</option>
                    <option value="Injury Risk">Injury Risk</option>
                    <option value="Formation">Formation</option>
                    <option value="General">General</option>
                  </select>
                </label>
                <label className="block text-xs">
                  Confidence slider
                  <input
                    type="range"
                    min={0.1}
                    max={0.99}
                    step={0.01}
                    value={threshold}
                    onChange={(event) => setThreshold(Number(event.target.value))}
                    className="mt-1 w-full accent-primary-500"
                  />
                  <span className="text-[11px] text-slate-400">{Math.round(threshold * 100)}% shadow threshold</span>
                </label>
                <label className="block text-xs">
                  Expected model confidence
                  <input
                    type="range"
                    min={0.1}
                    max={0.99}
                    step={0.01}
                    value={confidence}
                    onChange={(event) => setConfidence(Number(event.target.value))}
                    className="mt-1 w-full accent-emerald-500"
                  />
                  <span className="text-[11px] text-slate-400">{Math.round(confidence * 100)}% training label</span>
                </label>
                <label className="block text-xs">
                  Team perspective
                  <select
                    value={team}
                    onChange={(event) => setTeam(event.target.value as 'home' | 'away' | '')}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  >
                    <option value="">Neutral</option>
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </label>
                <label className="block text-xs">
                  Players tagged
                  <input
                    value={playerInput}
                    onChange={(event) => setPlayerInput(event.target.value)}
                    placeholder="12, 7"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Explain why this cue matters."
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  Natural language description
                  <textarea
                    value={naturalLanguage}
                    onChange={(event) => setNaturalLanguage(event.target.value)}
                    placeholder="Outside blocker collides with libero near antenna."
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  />
                </label>
              </div>
            </section>
            <section className="border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold">vLLM assist</h3>
              <div className="mt-2 space-y-2 text-xs text-slate-200">
                <label className="block text-xs">
                  Focus prompt
                  <input
                    value={focus}
                    onChange={(event) => setFocus(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  Hints
                  <input
                    value={hints}
                    onChange={(event) => setHints(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAssist}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-primary-500"
                  >
                    <Sparkles className="h-4 w-4" /> Run Assist
                  </button>
                  <button
                    type="button"
                    onClick={applyAssistToSelection}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-primary-500"
                    disabled={!vlmResult || !selectedAnnotation}
                  >
                    <Wand2 className="h-4 w-4" /> Apply
                  </button>
                </div>
                {vlmResult ? (
                  <div className="rounded-lg border border-primary-500/40 bg-primary-500/10 p-3 text-[11px] text-primary-100">
                    <p>Stance: {vlmResult.stance ?? '–'}</p>
                    <p>Hand: {vlmResult.hand_state ?? '–'}</p>
                    <p>Zone: {vlmResult.court_zone ?? '–'} | Above tape: {String(vlmResult.above_tape ?? 'unknown')}</p>
                    <p>Confidence: {(vlmResult.confidence * 100).toFixed(0)}%</p>
                    <ul className="mt-2 space-y-1 text-[10px] text-slate-200">
                      {vlmResult.notes.map((note) => (
                        <li key={note} className="flex items-start gap-1">
                          <Lightbulb className="mt-0.5 h-3 w-3 text-amber-300" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
            <section className="px-4 py-4">
              <div className="space-y-3 text-xs text-slate-200">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <Target className="h-3 w-3" /> Micro-sequence summary
                  </div>
                  <p className="mt-2 text-slate-300">
                    Key frame: {keyFrame} • End frame: {endFrame} • Players tagged: {playerInput || 'none'}
                  </p>
                </div>
                {trainingJob ? (
                  <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide">
                      <Scan className="h-3 w-3" /> Training status
                    </div>
                    <p className="mt-1 text-sm font-semibold capitalize">{trainingJob.status}</p>
                    {trainingJob.message ? (
                      <p className="text-[11px] text-emerald-200/80">{trainingJob.message}</p>
                    ) : null}
                    {trainingJob.metrics ? (
                      <p className="text-[11px] text-emerald-200/90">
                        F1 {trainingJob.metrics.f1?.toFixed(2)} • Precision {trainingJob.metrics.precision?.toFixed(2)} • Recall {trainingJob.metrics.recall?.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-200/70">Measuring rules graph against shallow classifier…</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300">
                    <Rows2 className="mr-2 inline h-3 w-3" /> Save example to trigger hybrid training.
                  </div>
                )}
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-primary-500/30 transition hover:bg-primary-500/90 disabled:opacity-70"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Save example & shadow test
                </button>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default EventTeachingWorkspace;
