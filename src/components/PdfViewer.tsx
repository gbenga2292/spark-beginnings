import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

// Configure the PDF.js worker – this is required by react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  /** A data URI (data:application/pdf;base64,...) or a URL to the PDF */
  src: string;
  className?: string;
}

export function PdfViewer({ src, className = '' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const ro = new ResizeObserver(([entry]) => {
        setContainerWidth(entry.contentRect.width);
      });
      ro.observe(node);
      setContainerWidth(node.clientWidth);
    }
  }, []);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onLoadError = () => {
    setError(true);
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <p className="text-sm font-medium">Could not render PDF.</p>
        <p className="text-xs">Try downloading the file instead.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col items-center gap-0 w-full h-full ${className}`}>
      {/* Loading overlay */}
      {loading && (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          <p className="text-xs font-medium">Loading PDF…</p>
        </div>
      )}

      {/* PDF Document */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-slate-100 dark:bg-slate-950">
        <Document
          file={src}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={null}
          className="flex flex-col items-center py-4 gap-4"
        >
          {/* Render all pages for single-page PDFs, or current page only for multi-page */}
          {numPages > 0 && (
            <Page
              key={pageNumber}
              pageNumber={pageNumber}
              width={Math.max(containerWidth - 32, 200)}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg rounded"
            />
          )}
        </Document>
      </div>

      {/* Page controls – only shown for multi-page PDFs */}
      {numPages > 1 && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 w-full justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 tabular-nums">
            Page {pageNumber} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
