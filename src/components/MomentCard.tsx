'use client';

import type { PublicUser } from '@/lib/users';
import type { Moment } from '@/lib/types';

interface MomentCardProps {
  moment: Moment;
  currentUser: string;
  users: PublicUser[];
  onDelete?: (id: string) => void;
  /** Load the image immediately for the top (visible) card. */
  eager?: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MomentCard({
  moment,
  currentUser,
  users,
  onDelete,
  eager = false,
}: MomentCardProps) {
  const isOwn = moment.from === currentUser;
  const sender = users.find((user) => user.id === moment.from) ?? {
    name: moment.from,
    emoji: '👤',
  };
  const when = timeAgo(moment.createdAt);

  const deleteButton =
    isOwn && onDelete ? (
      <button
        type="button"
        aria-label="Delete this moment"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(moment.id);
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full
          bg-black/25 text-xs text-white/80 backdrop-blur transition-colors
          hover:bg-red-500/80 hover:text-white"
      >
        🗑
      </button>
    ) : null;

  if (moment.type === 'voice') {
    return (
      <div
        className="relative flex h-full w-full select-none flex-col overflow-hidden
          rounded-[28px] bg-linear-to-br from-purple-500 via-indigo-500 to-violet-600
          p-5 text-white shadow-2xl ring-1 ring-white/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full
              bg-white/20 text-lg backdrop-blur">
              {sender.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {sender.name}
              </p>
              <p className="text-[11px] text-white/65">
                {isOwn ? 'You' : 'For you'} · voice
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px]
              text-white/80 backdrop-blur">
              {when}
            </span>
            {deleteButton}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="relative grid h-32 w-32 place-items-center rounded-full
            bg-white/10 ring-1 ring-white/20">
            <span className="text-5xl">🎙️</span>
            <span aria-hidden="true" className="absolute inset-0 rounded-full
              border border-white/25 animate-pulse-soft" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">
            Voice moment
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 p-2 shadow-lg">
          <audio
            controls
            src={`/api/uploads/${moment.fileName}`}
            className="h-10 w-full"
            preload="metadata"
          />
        </div>

        {moment.caption && (
          <p className="mt-3 line-clamp-2 text-sm text-white/85">
            {moment.caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-[28px]
      bg-gray-900 shadow-2xl ring-1 ring-white/40">
      <img
        src={`/api/uploads/${moment.fileName}`}
        alt={`Moment from ${sender.name}`}
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32
        bg-linear-to-b from-black/60 via-black/25 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40
        bg-linear-to-t from-black/70 via-black/30 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between
        gap-2 p-4 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full
            bg-white/20 text-lg backdrop-blur">
            {sender.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight drop-shadow">
              {sender.name}
            </p>
            <p className="text-[11px] text-white/70">
              {isOwn ? 'You' : 'For you'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px]
            text-white/80 backdrop-blur">
            {when}
          </span>
          {deleteButton}
        </div>
      </div>

      {moment.caption && (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="line-clamp-3 text-sm leading-snug text-white/90 drop-shadow">
            {moment.caption}
          </p>
        </div>
      )}
    </div>
  );
}
