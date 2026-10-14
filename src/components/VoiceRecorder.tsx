'use client';

import { useRef, useState, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecord: (blob: Blob) => void;
  onClose: () => void;
}

export default function VoiceRecorder({ onRecord, onClose }: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setError('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const confirmRecording = () => {
    if (recordedBlob) onRecord(recordedBlob);
  };

  const retake = () => {
    setRecordedBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-purple-900 to-indigo-950 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 text-white text-lg p-2"
      >
        ✕
      </button>

      {error ? (
        <div className="text-center text-white px-8">
          <span className="text-4xl mb-4 block">🎙️</span>
          <p>{error}</p>
          <button onClick={onClose} className="mt-4 text-warm-pink underline">
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
              className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center
                shadow-lg shadow-pink-500/30 transform transition-all active:scale-95"
            >
              <span className="text-3xl">🎙️</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center
                recording-pulse transform transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-sm bg-white" />
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
