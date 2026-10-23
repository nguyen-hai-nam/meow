'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceRecorderProps {
  onRecord: (blob: Blob) => void;
  onClose: () => void;
}

/**
 * Safari (iOS) cannot record WebM. It records MP4/AAC instead, so we probe for
 * the best format the browser actually supports instead of hardcoding one.
 */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickMimeType(): string | null {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return null;
  }
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

export default function VoiceRecorder({ onRecord, onClose }: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const setPreviewUrl = (url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  };

  // Release the microphone and blob URL if the sheet is closed mid-recording.
  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);

    if (!recordingSupported()) {
      setError("Voice recording isn't supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
          : 'Could not access your microphone.'
      );
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      try {
        // Some browsers reject the codec string but accept a bare container.
        recorder = new MediaRecorder(stream);
      } catch {
        stopStream();
        setError("Voice recording isn't supported in this browser.");
        return;
      }
    }

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearTimer();
      setIsRecording(false);

      const blobType = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];

      stopStream();
      mediaRecorderRef.current = null;

      if (blob.size === 0) {
        setError('That recording came out empty. Please try again.');
        return;
      }

      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };

    recorder.onerror = () => {
      clearTimer();
      setIsRecording(false);
      stopStream();
      mediaRecorderRef.current = null;
      setError('Recording failed. Please try again.');
    };

    try {
      recorder.start();
    } catch {
      stopStream();
      mediaRecorderRef.current = null;
      setError("Voice recording isn't supported in this browser.");
      return;
    }

    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
    clearTimer();
  };

  const confirmRecording = () => {
    if (recordedBlob) onRecord(recordedBlob);
  };

  const retake = () => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setDuration(0);
  };

  const handleClose = () => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // Detach first so closing doesn't try to update unmounted state.
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    setPreviewUrl(null);
    onClose();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-linear-to-b from-purple-900 to-indigo-950 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        aria-label="Close voice recorder"
        className="absolute top-4 left-4 text-white text-lg p-2"
      >
        ✕
      </button>

      {error ? (
        <div className="text-center text-white px-8">
          <span className="text-4xl mb-4 block">🎙️</span>
          <p>{error}</p>
          <button onClick={handleClose} className="mt-4 text-warm-pink underline">
            Go back
          </button>
        </div>
      ) : !recordedBlob ? (
        // Recording UI
        <div className="flex flex-col items-center">
          <div className="text-6xl mb-8">{isRecording ? '🔴' : '🎙️'}</div>
          <p className="text-white/70 text-sm mb-2">
            {isRecording ? 'Recording...' : 'Tap to start recording'}
          </p>
          <p className="text-white text-4xl font-mono mb-12">
            {formatTime(duration)}
          </p>

          {!isRecording ? (
            <button
              onClick={startRecording}
              aria-label="Start recording"
              className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center
                shadow-lg shadow-pink-500/30 transform transition-all active:scale-95"
            >
              <span className="text-3xl">🎙️</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              aria-label="Stop recording"
              className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center
                recording-pulse transform transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xs bg-white" />
            </button>
          )}
        </div>
      ) : (
        // Preview UI
        <div className="flex flex-col items-center px-8 w-full max-w-sm">
          <div className="text-6xl mb-6">🎧</div>
          <p className="text-white/70 text-sm mb-4">Preview your message</p>
          <p className="text-white text-2xl font-mono mb-6">
            {formatTime(duration)}
          </p>

          {audioUrl && (
            <audio controls src={audioUrl} className="w-full mb-8 rounded-lg" />
          )}

          <div className="flex gap-4">
            <button
              onClick={retake}
              className="px-6 py-3 rounded-full bg-white/20 text-white font-semibold"
            >
              Retake
            </button>
            <button
              onClick={confirmRecording}
              className="px-8 py-3 rounded-full gradient-primary text-white font-semibold"
            >
              Send ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
