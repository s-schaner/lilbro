import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

export interface VideoViewportHandle {
  captureStill: () => string | null;
}

interface VideoViewportProps {
  src?: string;
  poster?: string;
}

export const VideoViewport = forwardRef<VideoViewportHandle, VideoViewportProps>(({ src, poster }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      captureStill: () => {
        const video = videoRef.current;
        const captureCanvas = captureCanvasRef.current;
        if (!video || !captureCanvas) return null;
        if (!video.videoWidth || !video.videoHeight) return null;

        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const context = captureCanvas.getContext('2d');
        if (!context) return null;

        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
        return dataUrl && dataUrl.length > 0 ? dataUrl : null;
      },
    }),
    [],
  );

  const hasSource = useMemo(() => Boolean(src), [src]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        className="h-full w-full object-contain"
      >
        Your browser does not support the video tag.
      </video>
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      {!hasSource && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-sm text-slate-400">Upload a clip to begin video analysis.</div>
        </div>
      )}
      <canvas ref={captureCanvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
});

VideoViewport.displayName = 'VideoViewport';
