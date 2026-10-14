'use client';

import { useState } from 'react';

interface Moment {
  id: string;
  type: 'photo' | 'voice';
  from: string;
  caption?: string;
  fileName: string;
  createdAt: string;
}

interface MomentCardProps {
  moment: Moment;
  currentUser: string;
  onDelete?: (id: string) => void;
}

const userMeta: Record<string, { name: string; emoji: string }> = {
  user1: { name: 'Person 1', emoji: '🐱' },
  user2: { name: 'Person 2', emoji: '🐾' },
};

export default function MomentCard({ moment, currentUser, onDelete }: MomentCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const isOwn = moment.from === currentUser;
  const sender = userMeta[moment.from] || { name: moment.from, emoji: '👤' };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`animate-slide-up mb-4 ${
        isOwn ? 'ml-8' : 'mr-8'
      }`}
      onClick={() => isOwn && setShowDelete(!showDelete)}
    >
      <div
        className={`rounded-2xl overflow-hidden shadow-md ${
          isOwn
            ? 'bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100'
            : 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100'
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{sender.emoji}</span>
            <span className="text-sm font-medium text-gray-700">{sender.name}</span>
          </div>
          <span className="text-xs text-gray-400">{timeAgo(moment.createdAt)}</span>
        </div>

        {/* Content */}
        {moment.type === 'photo' ? (
          <div className="px-3 pb-3">
            <img
              src={`/api/uploads/${moment.fileName}`}
              alt="Shared moment"
              className="w-full rounded-xl object-cover max-h-96"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="bg-white/60 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">🎵</span>
              <audio
                controls
                src={`/api/uploads/${moment.fileName}`}
                className="flex-1 h-10"
                preload="metadata"
              />
            </div>
          </div>
        )}

        {/* Caption */}
        {moment.caption && (
          <div className="px-4 pb-3">
            <p className="text-sm text-gray-600">{moment.caption}</p>
          </div>
        )}

        {/* Delete */}
        {showDelete && isOwn && onDelete && (
          <div className="px-4 pb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(moment.id);
              }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete this moment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
