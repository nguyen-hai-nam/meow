'use client';

import { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions.');
    }
  }, [stream]);

  const handleStart = useCallback(() => {
    startCamera(facingMode);
  }, [startCamera, facingMode]);

  const flipCamera = () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    stream?.getTracks().forEach((t) => t.stop());
  };

  const confirmPhoto = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      'image/jpeg',
      0.85
    );
  };

  const retake = () => {
    setCaptured(null);
    startCamera(facingMode);
  };

  const handleClose = () => {
    stream?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center">
        <button onClick={handleClose} className="text-white text-lg p-2">
          ✕
        </button>
        {stream && !captured && (
          <button onClick={flipCamera} className="text-white text-lg p-2">
            🔄
          </button>
        )}
      </div>

      {/* Camera View */}
      {!stream && !captured && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <span className="text-6xl mb-6">📸</span>
          <button
            onClick={handleStart}
            className="px-8 py-4 rounded-full gradient-primary text-white font-semibold text-lg
              transform transition-all active:scale-95"
          >
            Open Camera
          </button>
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-white px-8 text-center">
          <span className="text-4xl mb-4">😿</span>
          <p>{error}</p>
          <button onClick={handleClose} className="mt-4 text-warm-pink underline">
            Go back
          </button>
        </div>
      )}

      {stream && !captured && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center safe-bottom">
            <button
              onClick={takePhoto}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20
                active:bg-white/40 transition-all"
            />
          </div>
        </>
      )}

      {captured && (
        <>
          <img src={captured} alt="Captured" className="flex-1 object-contain" />
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center gap-6 safe-bottom">
            <button
              onClick={retake}
              className="px-6 py-3 rounded-full bg-white/20 text-white font-semibold"
            >
              Retake
            </button>
            <button
              onClick={confirmPhoto}
              className="px-8 py-3 rounded-full gradient-primary text-white font-semibold"
            >
              Send ✨
            </button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
