import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

interface TaskPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function TaskPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: TaskPaginationProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const navBtn = (
    onClick: () => void,
    disabled: boolean,
    title: string,
    icon: React.ReactNode,
    variant: 'ghost' | 'outline' = 'ghost'
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${variant === 'outline'
          ? 'border border-border/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
        }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-3 py-3 bg-card border border-border/60 rounded-xl shadow-sm text-xs mt-4">
      {/* Left: count + page size */}
      <div className="flex items-center gap-2 text-muted-foreground font-medium">
        <span>
          Showing{' '}
          <strong className="text-foreground font-semibold">{startItem}–{endItem}</strong>
          {' '}of{' '}
          <strong className="text-foreground font-semibold">{totalItems}</strong>
          {' '}tasks
        </span>

        <div className="flex items-center gap-1.5 ml-2 border-l border-border/60 pl-3" ref={dropdownRef}>
          <span className="text-[11px]">Per page:</span>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(p => !p)}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border/60 bg-muted/30 hover:bg-muted text-xs font-semibold transition-colors"
            >
              {pageSize}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[60px]">
                {pageSizeOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { onPageSizeChange(opt); onPageChange(1); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors
                      ${pageSize === opt ? 'font-bold text-primary bg-primary/10' : 'text-foreground'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: page controls */}
      <div className="flex items-center gap-1">
        {navBtn(() => onPageChange(1), currentPage <= 1, 'First page', <ChevronsLeft className="w-4 h-4" />)}
        {navBtn(() => onPageChange(currentPage - 1), currentPage <= 1, 'Previous page', <ChevronLeft className="w-4 h-4" />, 'outline')}

        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors
                  ${currentPage === p
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
              >
                {p}
              </button>
            ) : (
              <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground font-bold">…</span>
            )
          )}
        </div>

        {navBtn(() => onPageChange(currentPage + 1), currentPage >= totalPages, 'Next page', <ChevronRight className="w-4 h-4" />, 'outline')}
        {navBtn(() => onPageChange(totalPages), currentPage >= totalPages, 'Last page', <ChevronsRight className="w-4 h-4" />)}
      </div>
    </div>
  );
}
