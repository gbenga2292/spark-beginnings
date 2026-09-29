import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import logoSrc from '@/logo/logo-2.png';
import type { MeetingMinute } from '@/src/types/minute';

export interface MinutePrintPreviewViewHandle {
  handlePrint: () => void;
}

export interface MinutePrintPreviewViewProps {
  minute: MeetingMinute;
  className?: string;
}

export const MinutePrintPreviewView = forwardRef<
  MinutePrintPreviewViewHandle,
  MinutePrintPreviewViewProps
>(function MinutePrintPreviewView({ minute, className = '' }, ref) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const printArea = printAreaRef.current;
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${minute.title || 'Meeting Minute'} - Print</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 14mm 16mm;
            }
            .print-page {
              position: relative;
              width: 100%;
              min-height: 100%;
              background: #ffffff;
            }
            .watermark-container {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 360px;
              max-width: 70%;
              opacity: 0.5 !important;
              pointer-events: none;
              z-index: 0;
            }
            .watermark-img {
              width: 100%;
              height: auto;
              opacity: 0.5 !important;
              filter: grayscale(15%);
            }
            .content-wrapper {
              position: relative;
              z-index: 1;
            }
            .header-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 18px;
            }
            .brand-left {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .top-logo {
              height: 52px;
              width: auto;
              object-fit: contain;
            }
            .company-name {
              font-size: 14px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
            }
            .company-sub {
              font-size: 10px;
              color: #4b5563;
              font-weight: 500;
              margin-top: 1px;
            }
            .header-meta {
              text-align: right;
              font-size: 10px;
              color: #374151;
              line-height: 1.4;
            }
            .meeting-badge {
              display: inline-block;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 2px 8px;
              border-radius: 4px;
              margin-bottom: 3px;
            }
            .title-section {
              margin-bottom: 16px;
            }
            .meeting-title {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 8px;
              line-height: 1.25;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 10px;
            }
            .meta-item strong {
              display: block;
              color: #64748b;
              font-size: 9px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .section {
              margin-top: 14px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .section-content {
              font-size: 10.5px;
              line-height: 1.6;
              color: #1f2937;
            }
            .tag-list {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
            }
            .tag {
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              padding: 2px 7px;
              border-radius: 4px;
              font-size: 10px;
            }
            .bullet-list {
              margin-left: 16px;
              font-size: 10.5px;
              line-height: 1.6;
            }
            .bullet-list li {
              margin-bottom: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
              text-align: left;
            }
            th {
              background: #f8fafc;
              font-weight: 700;
              color: #334155;
            }
            .priority-badge {
              text-transform: uppercase;
              font-size: 8.5px;
              font-weight: 700;
              padding: 1px 5px;
              border-radius: 3px;
              background: #f1f5f9;
            }
            .signoff-section {
              margin-top: 28px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              padding-top: 14px;
              border-top: 1px dashed #cbd5e1;
            }
            .sig-box {
              font-size: 10px;
              color: #334155;
            }
            .sig-line {
              border-bottom: 1px solid #0f172a;
              height: 36px;
              margin-bottom: 6px;
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            <div class="watermark-container">
              <img src="${logoSrc}" alt="DCEL Watermark" class="watermark-img" />
            </div>
            <div class="content-wrapper">
              ${printArea.innerHTML}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [minute]);

  useImperativeHandle(
    ref,
    () => ({
      handlePrint,
    }),
    [handlePrint]
  );

  return (
    <div className={`w-full py-6 px-2 sm:px-4 flex justify-center ${className}`}>
      <div
        className="w-full max-w-[210mm] bg-white text-neutral-900 shadow-2xl rounded-sm border border-neutral-300 p-8 sm:p-12 relative overflow-hidden"
        style={{ minHeight: '297mm' }}
      >
        {/* Center Watermark (50% Opacity) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
          aria-hidden="true"
        >
          <img
            src={logoSrc}
            alt="Watermark"
            className="w-[340px] max-w-[70%] object-contain"
            style={{ opacity: 0.5 }}
          />
        </div>

        {/* Printable Content Section */}
        <div ref={printAreaRef} className="relative z-10 space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3 mb-4">
            <div className="flex items-center gap-3.5">
              <img
                src={logoSrc}
                alt="Company Logo"
                className="h-11 w-auto max-w-[220px] object-contain shrink-0"
              />
              <div className="border-l-2 border-neutral-300 pl-3">
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

          {/* Attendees & Absentees */}
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


        </div>
      </div>
    </div>
  );
});

export default MinutePrintPreviewView;
