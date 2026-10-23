'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callbacksRef = useRef({ onCapture, onClose });
  const sentRef = useRef(false);
  const capturingRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callbacks available to the animation timer without making
  // it re-run whenever the parent re-renders (the feed polls every 5s).
  useEffect(() => {
    callbacksRef.current = { onCapture, onClose };
  });

  // The <video> only mounts after the stream exists, so attach it here.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop the tracks if the component is unmounted for any reason.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);
    } catch {
      setError('Could not access camera. Please allow camera permissions.');
    }
  }, []);

  const handleStart = useCallback(() => {
    startCamera(facingMode);
  }, [startCamera, facingMode]);

  const flipCamera = () => {
    if (capturing) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const finishCapture = useCallback(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const send = (blob: Blob | null) => {
      if (blob) callbacksRef.current.onCapture(blob);
      callbacksRef.current.onClose();
    };

    const canvas = canvasRef.current;
    if (!canvas) {
      send(null);
      return;
    }
    canvas.toBlob(send, 'image/jpeg', 0.9);
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (capturingRef.current || capturing || !video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Crop the centre square: exactly what the framed preview shows.
    const sourceSize = Math.min(videoWidth, videoHeight);
    const outputSize = Math.min(sourceSize, 1440);

    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    capturingRef.current = true;

    ctx.drawImage(
      video,
      (videoWidth - sourceSize) / 2,
      (videoHeight - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    sentRef.current = false;
    setCapturing(canvas.toDataURL('image/jpeg', 0.9));

    // Freeze the preview behind the shrinking snapshot.
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [capturing]);

  // Fallback in case `animationend` never fires (e.g. reduced motion).
  useEffect(() => {
    if (!capturing) return;
    const timeout = window.setTimeout(finishCapture, 900);
    return () => window.clearTimeout(timeout);
  }, [capturing, finishCapture]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="safe-top">
        <div className="flex items-center justify-between p-4">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close camera"
            className="rounded-full bg-white/10 p-2.5 text-lg leading-none
              backdrop-blur transition-colors hover:bg-white/20"
          >
            ✕
          </button>

          {stream && !capturing && (
            <button
              type="button"
              onClick={flipCamera}
              aria-label="Flip camera"
              className="rounded-full bg-white/10 p-2.5 text-lg leading-none
                backdrop-blur transition-colors hover:bg-white/20"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="relative aspect-square w-full max-w-[min(360px,58vh)]">
          {/* Brand frame */}
          <div
            aria-hidden="true"
            className="absolute -inset-[3px] rounded-[32px] gradient-primary
              opacity-90"
          />

          <div className="relative h-full w-full overflow-hidden rounded-[29px]
            bg-black ring-1 ring-white/10">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="mb-3 text-4xl">😿</span>
                <p className="text-sm text-white/80">{error}</p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="mt-4 text-sm text-warm-pink underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-5">
                <span className="text-6xl">📸</span>
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-full gradient-primary px-7 py-3 text-sm
                    font-semibold transition-transform active:scale-95"
                >
                  Open Camera
                </button>
              </div>
            )}

            {capturing && (
              <>
                {/* The frozen photo shrinks away like a screenshot preview. */}
                <img
                  src={capturing}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full
                    rounded-[29px] object-cover animate-capture-shrink"
                  onAnimationEnd={finishCapture}
                />
                <div className="pointer-events-none absolute inset-0 bg-white
                  animate-capture-flash" />
              </>
            )}

            {/* Viewfinder corners */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 h-7 w-7
                rounded-tl-lg border-l-2 border-t-2 border-white/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-3 h-7 w-7
                rounded-tr-lg border-r-2 border-t-2 border-white/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-3 h-7 w-7
                rounded-bl-lg border-b-2 border-l-2 border-white/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 right-3 h-7 w-7
                rounded-br-lg border-b-2 border-r-2 border-white/70"
            />
          </div>
        </div>
      </div>

      <div className="safe-bottom">
        <div className="flex items-center justify-center px-6 pb-6 pt-4">
          {stream ? (
            <button
              type="button"
              onClick={takePhoto}
              disabled={!!capturing}
              aria-label="Take photo"
              className="h-20 w-20 rounded-full border-4 border-white/90 p-1.5
                transition-transform active:scale-90 disabled:opacity-60"
            >
              <span className="block h-full w-full rounded-full bg-white" />
            </button>
          ) : (
            <p className="text-xs text-white/40">
              Square photos · what you see is what gets sent
            </p>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
