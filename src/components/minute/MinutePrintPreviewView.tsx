import React, { useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import logoSrc from '@/logo/logo-2.png';
import type { MeetingMinute } from '@/src/types/minute';
import { exportMinuteToDocx } from '@/src/lib/minuteDocxExport';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

export interface MinutePrintPreviewViewHandle {
  handlePrint: () => void;
  handleExportDocx: () => Promise<void>;
}

export interface MinutePrintPreviewViewProps {
  minute: MeetingMinute;
  className?: string;
  hideLogo?: boolean;
  hideWatermark?: boolean;
  onToggleHideLogo?: (hide: boolean) => void;
  onToggleHideWatermark?: (hide: boolean) => void;
}

export const MinutePrintPreviewView = forwardRef<
  MinutePrintPreviewViewHandle,
  MinutePrintPreviewViewProps
>(function MinutePrintPreviewView(
  {
    minute,
    className = '',
    hideLogo: hideLogoProp,
    hideWatermark: hideWatermarkProp,
    onToggleHideLogo,
    onToggleHideWatermark,
  },
  ref
) {
  const [localHideLogo, setLocalHideLogo] = useState(false);
  const [localHideWatermark, setLocalHideWatermark] = useState(false);

  const isLogoHidden = hideLogoProp !== undefined ? hideLogoProp : localHideLogo;
  const isWatermarkHidden = hideWatermarkProp !== undefined ? hideWatermarkProp : localHideWatermark;

  const toggleHideLogo = (val: boolean) => {
    setLocalHideLogo(val);
    onToggleHideLogo?.(val);
  };

  const toggleHideWatermark = (val: boolean) => {
    setLocalHideWatermark(val);
    onToggleHideWatermark?.(val);
  };

  const handlePrint = useCallback(() => {
    const sheetEl = document.getElementById('minute-print-sheet');
    if (!sheetEl) {
      window.print();
      return;
    }

    // Convert logoSrc to absolute URL so iframe and print environments always resolve it
    const absoluteLogoSrc = new URL(logoSrc, window.location.href).href;

    // Create a hidden iframe for isolated, pixel-perfect printing
    const iframe = document.createElement('iframe');
    iframe.id = 'minute-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      window.print();
      return;
    }

    // Collect all stylesheets and style blocks from document.head so Tailwind classes & fonts match exactly
    const styles = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join('\n');

    // Clone the sheet element
    const clone = sheetEl.cloneNode(true) as HTMLElement;
    // Replace any relative logo src with absolute
    clone.querySelectorAll('img').forEach((img) => {
      if (img.getAttribute('src') === logoSrc || img.src.includes('logo-2.png')) {
        img.src = absoluteLogoSrc;
      }
    });

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${(minute.title || 'Meeting Minute').replace(/</g, '&lt;')} - Print</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait !important;
              margin: 12mm 14mm !important;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #111827 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            .no-print, .print\\:hidden {
              display: none !important;
            }
            #minute-print-sheet {
              box-shadow: none !important;
              border: none !important;
              max-width: 100% !important;
              width: 100% !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body class="bg-white text-neutral-900">
          ${clone.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error, falling back to window.print', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    };

    // Wait for images to finish loading inside iframe before triggering print
    const imgs = iframeDoc.images;
    if (imgs.length > 0) {
      let loaded = 0;
      const onImgReady = () => {
        loaded++;
        if (loaded >= imgs.length) {
          setTimeout(triggerPrint, 100);
        }
      };
      for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) {
          onImgReady();
        } else {
          imgs[i].onload = onImgReady;
          imgs[i].onerror = onImgReady;
        }
      }
      setTimeout(triggerPrint, 600);
    } else {
      setTimeout(triggerPrint, 150);
    }
  }, [minute.title]);

  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const handleExportDocx = useCallback(async () => {
    setIsExportingDocx(true);
    try {
      await exportMinuteToDocx(minute, { hideLogo: isLogoHidden });
    } finally {
      setIsExportingDocx(false);
    }
  }, [minute, isLogoHidden]);

  useImperativeHandle(
    ref,
    () => ({
      handlePrint,
      handleExportDocx,
    }),
    [handlePrint, handleExportDocx]
  );

  return (
    <div className={`w-full py-4 px-2 sm:px-4 flex flex-col items-center ${className}`}>
      {/* On-screen Print Customization Toolbar (Hidden on print) */}
      <div className="no-print w-full max-w-[210mm] mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            Print & Export:
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200 select-none hover:text-foreground">
            <input
              type="checkbox"
              checked={isLogoHidden}
              onChange={(e) => toggleHideLogo(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span>Hide Logo</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200 select-none hover:text-foreground">
            <input
              type="checkbox"
              checked={isWatermarkHidden}
              onChange={(e) => toggleHideWatermark(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span>Hide Watermark</span>
          </label>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5 hidden sm:block" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportDocx}
            disabled={isExportingDocx}
            className="h-7 px-2.5 text-[11px] gap-1.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-foreground shadow-2xs font-medium"
          >
            {isExportingDocx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            )}
            <span>{isExportingDocx ? 'Exporting Word...' : 'Export Word (.docx)'}</span>
          </Button>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
          A4 Portrait • Offline Word (.docx) Editable
        </div>
      </div>

      {/* Main A4 Document Sheet */}
      <div
        id="minute-print-sheet"
        className="w-full max-w-[210mm] bg-white text-neutral-900 shadow-2xl rounded-sm border border-neutral-300 p-8 sm:p-12 relative overflow-hidden print:p-0 print:border-none print:shadow-none print:max-w-none"
        style={{ minHeight: '297mm' }}
      >
        {/* Center Watermark (35% Opacity) */}
        {!isWatermarkHidden && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
            aria-hidden="true"
          >
            <img
              src={logoSrc}
              alt="Watermark"
              className="w-[340px] max-w-[70%] object-contain"
              style={{ opacity: 0.35 }}
            />
          </div>
        )}

        {/* Printable Content Section */}
        <div className="relative z-10 space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3 mb-4">
            <div className="flex items-center gap-3.5">
              {!isLogoHidden && (
                <img
                  src={logoSrc}
                  alt="Company Logo"
                  className="h-11 w-auto max-w-[220px] object-contain shrink-0"
                />
              )}
              <div className={cn(!isLogoHidden ? 'border-l-2 border-neutral-300 pl-3' : '')}>
                <h2 className="text-xs font-extrabold uppercase tracking-tight text-neutral-900">
                  Executive Meeting Minutes
                </h2>
                <p className="text-[10px] text-neutral-500 font-medium">
                  Official Corporate Record &amp; Resolutions
                </p>
              </div>
            </div>
            <div className="text-right text-[10px] text-neutral-700 space-y-0.5">
              <span className="inline-block font-bold text-neutral-900 uppercase bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                {minute.meetingType} MEETING
              </span>
              <p className="pt-0.5">
                Date: <span className="font-semibold">{minute.date}</span>
              </p>
              {minute.time && (
                <p>
                  Time: <span className="font-semibold">{minute.time}</span>
                </p>
              )}
            </div>
          </div>

          {/* Title & Metadata Strip */}
          <div className="space-y-3">
            <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              {minute.title}
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-neutral-50 p-2.5 rounded border border-neutral-200 text-[10px]">
              <div>
                <span className="block font-semibold text-neutral-500 uppercase text-[9px]">
                  Chair Person
                </span>
                <span className="font-bold text-neutral-900">
                  {minute.chairPerson || 'HR Admin'}
                </span>
              </div>
              <div>
                <span className="block font-semibold text-neutral-500 uppercase text-[9px]">
                  Meeting Type
                </span>
                <span className="font-bold text-neutral-900">{minute.meetingType}</span>
              </div>
              <div>
                <span className="block font-semibold text-neutral-500 uppercase text-[9px]">
                  Location
                </span>
                <span className="font-bold text-neutral-900">{minute.location || 'Head Office'}</span>
              </div>
              <div>
                <span className="block font-semibold text-neutral-500 uppercase text-[9px]">
                  Status
                </span>
                <span className="font-bold text-neutral-900 uppercase">
                  {minute.status || 'Finalized'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendees Present */}
          <div className="space-y-1.5 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1">
              Attendees Present
            </h3>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {minute.attendees && minute.attendees.length > 0 ? (
                minute.attendees.map((att, idx) => (
                  <span
                    key={idx}
                    className="bg-neutral-100 text-neutral-800 text-[10px] px-2 py-0.5 rounded border border-neutral-300"
                  >
                    {att}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-neutral-500 italic">No attendees recorded.</span>
              )}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-1.5 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1">
              Executive Briefing &amp; Summary
            </h3>
            <p className="text-[11px] leading-relaxed text-neutral-800 whitespace-pre-line pt-0.5">
              {minute.executiveSummary || 'No executive summary recorded for this meeting.'}
            </p>
          </div>

          {/* Key Decisions */}
          {minute.keyDecisions && minute.keyDecisions.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1">
                Key Decisions &amp; Resolutions
              </h3>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-800 pt-0.5">
                {minute.keyDecisions.map((dec, idx) => (
                  <li key={idx} className="leading-snug">
                    {dec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items / Deliverables */}
          {minute.actionItems && minute.actionItems.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1">
                Action Items &amp; Deliverables
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-neutral-300 text-[10px] mt-1">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-800 font-bold">
                      <th className="border border-neutral-300 p-1.5 w-8 text-center">#</th>
                      <th className="border border-neutral-300 p-1.5">Action Item / Task</th>
                      <th className="border border-neutral-300 p-1.5 w-32">Assignee</th>
                      <th className="border border-neutral-300 p-1.5 w-24">Due Date</th>
                      <th className="border border-neutral-300 p-1.5 w-20 text-center">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minute.actionItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-neutral-50">
                        <td className="border border-neutral-300 p-1.5 text-center font-medium">
                          {idx + 1}
                        </td>
                        <td className="border border-neutral-300 p-1.5">{item.description}</td>
                        <td className="border border-neutral-300 p-1.5 font-medium">
                          {item.assigneeName || 'Unassigned'}
                        </td>
                        <td className="border border-neutral-300 p-1.5">{item.dueDate || '—'}</td>
                        <td className="border border-neutral-300 p-1.5 text-center uppercase text-[9px] font-semibold">
                          {item.priority}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Agenda Topics */}
          {minute.agendaTopics && minute.agendaTopics.length > 0 && (
            <div className="space-y-2 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1">
                Agenda &amp; Topic Discussions
              </h3>
              <div className="space-y-2.5 pt-1">
                {minute.agendaTopics.map((top, idx) => (
                  <div key={top.id || idx} className="space-y-0.5">
                    <h4 className="text-[11px] font-bold text-neutral-900">
                      {idx + 1}. {top.topic}
                    </h4>
                    {top.discussion && (
                      <p className="text-[10px] text-neutral-700 leading-relaxed pl-3">
                        {top.discussion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sign-off / Signature Lines */}
          <div className="pt-8 mt-6 border-t border-neutral-200 grid grid-cols-2 gap-8 text-[11px] text-neutral-700 break-inside-avoid">
            <div className="space-y-1">
              <div className="border-b border-neutral-800 h-10 mb-2 w-full max-w-[220px]" />
              <p className="font-bold text-neutral-900">Prepared &amp; Recorded By</p>
              <p className="text-[10px] text-neutral-500">Secretariat / Admin</p>
            </div>
            <div className="space-y-1 text-right">
              <div className="border-b border-neutral-800 h-10 mb-2 w-full max-w-[220px] ml-auto" />
              <p className="font-bold text-neutral-900">Approved &amp; Adopted By</p>
              <p className="text-[10px] text-neutral-500">
                {minute.chairPerson || 'Chairperson / Presiding Officer'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default MinutePrintPreviewView;
