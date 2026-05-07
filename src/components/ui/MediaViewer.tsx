import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Play, FileVideo } from 'lucide-react';

export interface MediaItem {
  id?: number;
  url: string;
  file_type: 'image' | 'video';
  file_name?: string;
}

interface MediaViewerProps {
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function MediaViewer({ items, initialIndex = 0, onClose }: MediaViewerProps) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(() => setCurrent(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const item = items[current];
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/70 text-sm font-semibold tabular-nums">
          {current + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={item.url}
            download={item.file_name || 'media'}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main media area */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {item.file_type === 'image' ? (
          <img
            key={item.url}
            src={item.url}
            alt={item.file_name || 'media'}
            className="max-w-full max-h-full object-contain select-none animate-in fade-in duration-200"
            draggable={false}
          />
        ) : (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full animate-in fade-in duration-200"
          />
        )}

        {/* Prev / Next */}
        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-all active:scale-90"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-all active:scale-90"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Filename */}
      {item.file_name && (
        <div
          className="flex-shrink-0 px-4 py-1 text-center bg-gradient-to-t from-black/60 to-transparent"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-white/50 text-xs truncate">{item.file_name}</p>
        </div>
      )}

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div
          className="flex-shrink-0 flex gap-1.5 px-4 py-3 bg-black/80 overflow-x-auto scrollbar-hide"
          onClick={e => e.stopPropagation()}
        >
          {items.map((m, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === current ? 'border-white scale-105 shadow-lg' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              {m.file_type === 'image' ? (
                <img src={m.url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white fill-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
