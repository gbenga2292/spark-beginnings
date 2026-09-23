import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Download, FileText, AlertCircle, RefreshCw } from 'lucide-react';

interface DocPreviewModalProps {
  url: string;
  name: string;
  caption?: string;
  onClose: () => void;
}

/** Returns the lowercase extension of a filename/URL. */
function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
}

/** File types that Microsoft Office Online can render. */
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];

/** File types browsers render natively (no external service). */
const NATIVE_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm'];

export function DocPreviewModal({ url, name, caption, onClose }: DocPreviewModalProps) {
  const ext = getExt(name || url);
  const isOffice = OFFICE_EXTS.includes(ext);
  const isNative = NATIVE_EXTS.includes(ext);
  const isPdf    = ext === 'pdf';
  const isImage  = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);

  // Microsoft Office Online Viewer — publicly accessible HTTPS URLs only
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  const [loading, setLoading]   = useState(true);
  const [errored, setErrored]   = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape + lock body scroll
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Set a timeout: if Office Viewer hasn't loaded in 20s, show fallback
  useEffect(() => {
    if (!isOffice) return;
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setErrored(true);
    }, 20_000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [iframeKey, isOffice]);

  const handleLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(false);
    setErrored(false);
  };

  const handleError = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(false);
    setErrored(true);
  };

  const handleRetry = () => {
    setErrored(false);
    setLoading(true);
    setIframeKey(k => k + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{caption || name}</p>
              {caption && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{name}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <a
              href={url}
              download={name}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New tab</span>
            </a>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Viewer area ── */}
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 relative flex items-center justify-center">
          {/* Loading spinner */}
          {loading && !errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 z-10 pointer-events-none">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading preview…</p>
              {isOffice && (
                <p className="text-xs text-slate-400">Using Microsoft Office Viewer</p>
              )}
            </div>
          )}

          {/* Error / fallback */}
          {errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400 z-10 px-6">
              <AlertCircle className="h-10 w-10 text-amber-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview unavailable</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs">
                {isOffice
                  ? 'The Office Online viewer couldn\'t load this file. Download it to view locally, or open in a new tab.'
                  : 'Preview failed. Download the file to view it.'}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                {isOffice && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                )}
                <a
                  href={url}
                  download={name}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download file
                </a>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                </a>
              </div>
            </div>
          )}

          {/* ── PDF / Native browser rendering ── */}
          {(isPdf || (isNative && !isImage)) && !errored && (
            <iframe
              key={iframeKey}
              src={url}
              className={`w-full h-full border-0 transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
              title={caption || name}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}

          {/* ── Image — render directly ── */}
          {isImage && !errored && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={url}
                alt={caption || name}
                className={`max-w-full max-h-full object-contain rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={handleLoad}
                onError={handleError}
              />
            </div>
          )}

          {/* ── Office docs — Microsoft Office Online Viewer ── */}
          {isOffice && !errored && (
            <iframe
              key={iframeKey}
              src={officeViewerUrl}
              className={`w-full h-full border-0 transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
              title={caption || name}
              onLoad={handleLoad}
              onError={handleError}
              allow="fullscreen"
            />
          )}

          {/* ── Unknown file type — download prompt ── */}
          {!isPdf && !isNative && !isOffice && !errored && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 z-10">
              <FileText className="h-12 w-12 text-slate-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No preview available</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">This file type can't be previewed in the browser.</p>
              <a
                href={url}
                download={name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white transition-colors mt-2"
              >
                <Download className="h-3.5 w-3.5" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
