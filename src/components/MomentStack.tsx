'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import MomentCard from '@/components/MomentCard';
import type { Moment } from '@/lib/types';
import type { PublicUser } from '@/lib/users';

const STORAGE_KEY = 'meow:cleared-moments';
const MAX_CLEARED = 400;
const SWIPE_MS = 280;

interface MomentStackProps {
  moments: Moment[];
  loaded: boolean;
  currentUser: string;
  users: PublicUser[];
  onDelete?: (id: string) => void;
}

interface DragState {
  x: number;
  y: number;
}

interface FlyingState {
  x: number;
  y: number;
  dir: 1 | -1;
}

function readCleared(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter((id): id is string => typeof id === 'string')
      );
    }
  } catch {
    // Corrupt storage or blocked storage: start with an empty pile.
  }
  return new Set();
}

export default function MomentStack({
  moments,
  loaded,
  currentUser,
  users,
  onDelete,
}: MomentStackProps) {
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [clearedReady, setClearedReady] = useState(false);
  const [drag, setDrag] = useState<DragState>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<FlyingState | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
  } | null>(null);
  const flyingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const widthRef = useRef(320);

  // Cleared cards are remembered per device so the pile doesn't reset on reload.
  useEffect(() => {
    setCleared(readCleared());
    setClearedReady(true);
  }, []);

  useEffect(() => {
    if (!clearedReady) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...cleared].slice(-MAX_CLEARED))
      );
    } catch {
      // Storage can be unavailable (private mode); clearing still works in-session.
    }
  }, [cleared, clearedReady]);

  // Oldest moment first: whatever was shared first sits on top of the pile.
  const ordered = useMemo(
    () => [...moments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [moments]
  );
  const visible = useMemo(
    () => ordered.filter((moment) => !cleared.has(moment.id)),
    [ordered, cleared]
  );
  const top = visible[0];
  const topId = top?.id;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Reset gesture visuals whenever a different card becomes the top card.
  useEffect(() => {
    flyingRef.current = false;
    setDrag({ x: 0, y: 0 });
    setDragging(false);
    setFlying(null);
  }, [topId]);

  const dismiss = useCallback((id: string) => {
    setCleared((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const flingOut = useCallback(
    (dir: 1 | -1, startY = 0) => {
      if (!top || flyingRef.current) return;
      flyingRef.current = true;
      setDragging(false);
      setFlying({ x: dir * (window.innerWidth + 200), y: startY, dir });

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setFlying(null);
        setDrag({ x: 0, y: 0 });
        dismiss(top.id);
      }, SWIPE_MS);
    },
    [top, dismiss]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!top || flyingRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('audio, button, a, input, select, textarea')) return;

    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    widthRef.current =
      stackRef.current?.getBoundingClientRect().width || 320;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    setDrag({
      x: event.clientX - pointer.startX,
      y: event.clientY - pointer.startY,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const threshold = Math.max(72, widthRef.current * 0.28);

    if (Math.abs(dx) >= threshold) {
      flingOut(dx > 0 ? 1 : -1, Math.max(-80, Math.min(80, dy * 0.3)));
      return;
    }

    setDragging(false);
    setDrag({ x: 0, y: 0 });
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    setDragging(false);
    setDrag({ x: 0, y: 0 });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      flingOut(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      flingOut(1);
    }
  };

  const resetCleared = () => setCleared(new Set());

  if (!loaded || !clearedReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center pb-24">
        <div className="aspect-[3/4] w-[min(78vw,40.5vh,360px)] animate-pulse
          rounded-[28px] bg-white/70 shadow-xl" />
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center pb-24 text-center
        animate-fade-in">
        <span className="mb-4 block text-6xl">💌</span>
        <h2 className="mb-2 text-xl font-semibold text-gray-600">
          No moments yet
        </h2>
        <p className="max-w-xs text-gray-400">
          Share your first photo or voice message!
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center pb-24 text-center
        animate-fade-in">
        <span className="mb-4 block text-6xl">✨</span>
        <h2 className="mb-2 text-xl font-semibold text-gray-600">
          All caught up
        </h2>
        <p className="max-w-xs text-gray-400">
          You&apos;ve cleared every moment. New ones will land right here.
        </p>
        {cleared.size > 0 && (
          <button
            type="button"
            onClick={resetCleared}
            className="mt-5 text-xs text-warm-pink underline underline-offset-4"
          >
            Show cleared moments again
          </button>
        )}
      </div>
    );
  }

  const threshold = Math.max(72, widthRef.current * 0.28);
  const badgeProgress = Math.min(Math.abs(drag.x) / threshold, 1);

  const topStyle: CSSProperties = flying
    ? {
        transform: `translate3d(${flying.x}px, ${flying.y}px, 0) rotate(${
          flying.dir * 22
        }deg)`,
        opacity: 0.35,
        transition: `transform ${SWIPE_MS}ms cubic-bezier(0.3, 0, 0.3, 1), opacity ${SWIPE_MS}ms ease-out`,
        zIndex: 30,
      }
    : {
        transform: `translate3d(${drag.x}px, ${drag.y * 0.35}px, 0) rotate(${
          drag.x * 0.05
        }deg) scale(${dragging ? 1.02 : 1})`,
        transition: dragging
          ? 'none'
          : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        zIndex: 30,
      };

  const backStyle = (depth: number): CSSProperties => ({
    transform: `translate3d(0, ${depth * 18}px, 0) scale(${
      1 - depth * 0.05
    }) rotate(${depth % 2 === 0 ? 2 : -2}deg)`,
    transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 30 - depth,
    opacity: depth === 2 ? 0.9 : 1,
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-between">
      <div className="relative flex min-h-0 w-full flex-1 items-center
        justify-center pb-6">
        <div
          ref={stackRef}
          className="relative aspect-[3/4] w-[min(78vw,40.5vh,360px)]"
        >
          {visible.slice(0, 3).map((moment, index) => {
            if (index === 0) {
              return (
                <div
                  key={moment.id}
                  role="group"
                  aria-label={`Moment from ${
                    users.find((user) => user.id === moment.from)?.name ??
                    moment.from
                  }. Swipe left or right, or press an arrow key, to clear.`}
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onKeyDown={onKeyDown}
                  className="absolute inset-0 cursor-grab outline-none
                    focus-visible:ring-4 focus-visible:ring-warm-pink/40
                    active:cursor-grabbing"
                  style={topStyle}
                >
                  <MomentCard
                    moment={moment}
                    currentUser={currentUser}
                    users={users}
                    onDelete={onDelete}
                  />

                  {!flying && Math.abs(drag.x) > 10 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-5
                        flex justify-center"
                    >
                      <span
                        className="rounded-full border border-white/70 bg-black/30
                          px-4 py-1.5 text-2xl backdrop-blur"
                        style={{
                          opacity: badgeProgress * 0.95,
                          transform: `rotate(${
                            drag.x > 0 ? -10 : 10
                          }deg) scale(${0.85 + badgeProgress * 0.15})`,
                        }}
                      >
                        {drag.x > 0 ? '💖' : '👋'}
                      </span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={moment.id}
                aria-hidden="true"
                inert
                className="pointer-events-none absolute inset-0"
                style={backStyle(index)}
              >
                <MomentCard
                  moment={moment}
                  currentUser={currentUser}
                  users={users}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full shrink-0 pb-20 landscape:pb-6">
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => flingOut(-1)}
            disabled={!!flying}
            aria-label="Clear the top moment to the left"
            className="grid h-11 w-11 place-items-center rounded-full border
              border-gray-200 bg-white/80 text-lg text-gray-400 shadow-sm
              transition active:scale-90 disabled:opacity-40"
          >
            ←
          </button>

          <div className="min-w-[7.5rem] text-center">
            <p className="text-sm font-semibold text-gray-500">
              {visible.length} {visible.length === 1 ? 'moment' : 'moments'}
            </p>
            <p className="text-[11px] text-gray-400">
              Swipe left or right to clear
            </p>
          </div>

          <button
            type="button"
            onClick={() => flingOut(1)}
            disabled={!!flying}
            aria-label="Clear the top moment to the right"
            className="grid h-11 w-11 place-items-center rounded-full border
              border-gray-200 bg-white/80 text-lg text-gray-400 shadow-sm
              transition active:scale-90 disabled:opacity-40"
          >
            →
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'moment' : 'moments'} left in
          the pile.
        </p>
      </div>
    </div>
  );
}
