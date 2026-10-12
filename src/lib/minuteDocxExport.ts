import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ImageRun,
  Footer,
  PageNumber,
  ShadingType,
} from 'docx';
import logoSrc from '../../logo/logo-2.png';
import type { MeetingMinute } from '../types/minute';
import { toast } from 'sonner';

export interface ExportMinuteDocxOptions {
  hideLogo?: boolean;
}

// Helper: safe logo image loader (works offline in Electron & browser)
async function getLogoBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(logoSrc);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    console.warn('Could not load logo for DOCX export, continuing with text header:', err);
    return null;
  }
}

// Total printable width for A4 with 1080 twip (0.75") margins
const TOTAL_WIDTH_DXA = 9740;

const BORDER_LIGHT = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: 'E2E8F0',
};

const BORDER_NONE = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
};

/**
 * Exports a MeetingMinute object to a fully editable .docx Word document.
 * Works seamlessly offline in both Electron desktop and modern browsers.
 */
export async function exportMinuteToDocx(
  minute: MeetingMinute,
  options: ExportMinuteDocxOptions = {}
): Promise<void> {
  try {
    const logoBytes = options.hideLogo ? null : await getLogoBytes();

    // 1. Header Section Elements
    const children: (Paragraph | Table)[] = [];

    // Header Table (Logo + Title on Left, Meeting Meta on Right)
    const headerLeftParagraphs: Paragraph[] = [];
    if (logoBytes) {
      headerLeftParagraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBytes,
              type: 'png',
              transformation: {
                width: 130,
                height: 38,
              },
            }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    headerLeftParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'EXECUTIVE MEETING MINUTES',
            bold: true,
            size: 20, // 10pt
            color: '0F172A',
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Official Corporate Record & Resolutions',
            italics: true,
            size: 17, // 8.5pt
            color: '64748B',
            font: 'Arial',
          }),
        ],
      })
    );

    const headerRightParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `${(minute.meetingType || 'CORPORATE').toUpperCase()} MEETING`,
            bold: true,
            size: 19, // 9.5pt
            color: '0F766E', // Teal brand color
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'Date: ',
            color: '64748B',
            size: 18,
            font: 'Arial',
          }),
          new TextRun({
            text: minute.date || 'Not specified',
            bold: true,
            color: '0F172A',
            size: 18,
            font: 'Arial',
          }),
        ],
      }),
    ];

    if (minute.time) {
      headerRightParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: 'Time: ',
              color: '64748B',
              size: 18,
              font: 'Arial',
            }),
            new TextRun({
              text: minute.time,
              bold: true,
              color: '0F172A',
              size: 18,
              font: 'Arial',
            }),
          ],
        })
      );
    }

    // Top Header Table
    children.push(
      new Table({
        width: { size: TOTAL_WIDTH_DXA, type: WidthType.DXA },
        borders: {
          top: BORDER_NONE,
          bottom: { style: BorderStyle.SINGLE, size: 2, color: '0F172A' },
          left: BORDER_NONE,
          right: BORDER_NONE,
          insideHorizontal: BORDER_NONE,
          insideVertical: BORDER_NONE,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6000, type: WidthType.DXA },
                borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                margins: { bottom: 120 },
                children: headerLeftParagraphs,
              }),
              new TableCell({
                width: { size: 3740, type: WidthType.DXA },
                borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                margins: { bottom: 120 },
                children: headerRightParagraphs,
              }),
            ],
          }),
        ],
      })
    );

    // Spacing
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: minute.title || 'Executive Meeting Minute',
            bold: true,
            size: 36, // 18pt
            color: '0F172A',
            font: 'Arial',
          }),
        ],
      })
    );

    // 2. Metadata Grid Table (4 columns)
    const metaCellWidth = Math.floor(TOTAL_WIDTH_DXA / 4);
    children.push(
      new Table({
        width: { size: TOTAL_WIDTH_DXA, type: WidthType.DXA },
        borders: {
          top: BORDER_LIGHT,
          bottom: BORDER_LIGHT,
          left: BORDER_LIGHT,
          right: BORDER_LIGHT,
          insideHorizontal: BORDER_LIGHT,
          insideVertical: BORDER_LIGHT,
        },
        rows: [
          new TableRow({
            children: [
              createMetaBox('CHAIR PERSON', minute.chairPerson || 'HR Admin', metaCellWidth),
              createMetaBox('MEETING TYPE', minute.meetingType || 'General', metaCellWidth),
              createMetaBox('LOCATION', minute.location || 'Head Office', metaCellWidth),
              createMetaBox('STATUS', (minute.status || 'Draft').toUpperCase(), metaCellWidth),
            ],
          }),
        ],
      })
    );

    // Extra metadata row if confidentiality is set
    if (minute.confidentiality) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 140 },
          children: [
            new TextRun({
              text: 'Confidentiality Level: ',
              bold: true,
              size: 18,
              color: '64748B',
              font: 'Arial',
            }),
            new TextRun({
              text: minute.confidentiality,
              bold: true,
              size: 18,
              color: '0F766E',
              font: 'Arial',
            }),
          ],
        })
      );
    } else {
      children.push(new Paragraph({ spacing: { after: 140 } }));
    }

    // 3. Attendees Present
    children.push(createSectionHeading('ATTENDEES PRESENT'));
    if (minute.attendees && minute.attendees.length > 0) {
      const attendeeRuns: TextRun[] = [];
      minute.attendees.forEach((att, idx) => {
        attendeeRuns.push(
          new TextRun({
            text: att,
            bold: true,
            color: '1E293B',
            size: 20,
            font: 'Arial',
          })
        );
        if (idx < minute.attendees.length - 1) {
          attendeeRuns.push(
            new TextRun({
              text: '  •  ',
              color: '94A3B8',
              size: 20,
              font: 'Arial',
            })
          );
        }
      });
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 120 },
          children: attendeeRuns,
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
          children: [
            new TextRun({
              text: 'No attendees recorded.',
              italics: true,
              color: '64748B',
              size: 20,
              font: 'Arial',
            }),
          ],
        })
      );
    }

    if (minute.absentees && minute.absentees.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: 'Absentees / Apologies: ',
              bold: true,
              color: '64748B',
              size: 19,
              font: 'Arial',
            }),
            new TextRun({
              text: minute.absentees.join(', '),
              color: '475569',
              size: 19,
              font: 'Arial',
            }),
          ],
        })
      );
    }

    // 4. Executive Briefing & Summary
    children.push(createSectionHeading('EXECUTIVE BRIEFING & SUMMARY'));
    const summaryText = minute.executiveSummary || 'No executive summary recorded for this meeting.';
    summaryText.split('\n').forEach((para) => {
      const trimmed = para.trim();
      if (trimmed) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 100, line: 280 },
            children: [
              new TextRun({
                text: trimmed,
                size: 20, // 10pt
                color: '334155',
                font: 'Arial',
              }),
            ],
          })
        );
      }
    });

    // 5. Key Decisions & Resolutions
    if (minute.keyDecisions && minute.keyDecisions.length > 0) {
      children.push(createSectionHeading('KEY DECISIONS & RESOLUTIONS'));
      minute.keyDecisions.forEach((dec, idx) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 40, after: 60 },
            children: [
              new TextRun({
                text: `Decision ${idx + 1}: `,
                bold: true,
                color: '0F172A',
                size: 20,
                font: 'Arial',
              }),
              new TextRun({
                text: dec,
                color: '334155',
                size: 20,
                font: 'Arial',
              }),
            ],
          })
        );
      });
    }

    // 6. Action Items & Deliverables (Word Table)
    if (minute.actionItems && minute.actionItems.length > 0) {
      children.push(createSectionHeading('ACTION ITEMS & DELIVERABLES'));

      // Table columns: # (600), Task (4440), Assignee (1800), Due Date (1400), Priority (1500)
      const colWidths = [600, 4440, 1800, 1400, 1500];

      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          createTableHeaderCell('#', colWidths[0], AlignmentType.CENTER),
          createTableHeaderCell('Action Item / Task', colWidths[1], AlignmentType.LEFT),
          createTableHeaderCell('Assignee', colWidths[2], AlignmentType.LEFT),
          createTableHeaderCell('Due Date', colWidths[3], AlignmentType.LEFT),
          createTableHeaderCell('Priority', colWidths[4], AlignmentType.CENTER),
        ],
      });

      const dataRows = minute.actionItems.map((item, idx) => {
        const isEven = idx % 2 === 0;
        const bgFill = isEven ? 'FFFFFF' : 'F8FAFC';
        return new TableRow({
          children: [
            createTableDataCell(String(idx + 1), colWidths[0], AlignmentType.CENTER, bgFill, true),
            createTableDataCell(item.description || '—', colWidths[1], AlignmentType.LEFT, bgFill),
            createTableDataCell(item.assigneeName || 'Unassigned', colWidths[2], AlignmentType.LEFT, bgFill, true),
            createTableDataCell(item.dueDate || '—', colWidths[3], AlignmentType.LEFT, bgFill),
            createPriorityCell(item.priority || 'medium', colWidths[4], bgFill),
          ],
        });
      });

      children.push(
        new Table({
          width: { size: TOTAL_WIDTH_DXA, type: WidthType.DXA },
          borders: {
            top: BORDER_LIGHT,
            bottom: BORDER_LIGHT,
            left: BORDER_LIGHT,
            right: BORDER_LIGHT,
            insideHorizontal: BORDER_LIGHT,
            insideVertical: BORDER_LIGHT,
          },
          rows: [headerRow, ...dataRows],
        })
      );
    }

    // 7. Agenda & Topic Discussions
    if (minute.agendaTopics && minute.agendaTopics.length > 0) {
      children.push(createSectionHeading('AGENDA & TOPIC DISCUSSIONS'));
      minute.agendaTopics.forEach((top, idx) => {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `${idx + 1}. ${top.topic}`,
                bold: true,
                size: 22, // 11pt
                color: '0F172A',
                font: 'Arial',
              }),
            ],
          })
        );

        if (top.discussion) {
          children.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { before: 40, after: 80, line: 260 },
              children: [
                new TextRun({
                  text: top.discussion,
                  size: 20,
                  color: '334155',
                  font: 'Arial',
                }),
              ],
            })
          );
        }

        if (top.decisions && top.decisions.length > 0) {
          top.decisions.forEach((d) => {
            children.push(
              new Paragraph({
                bullet: { level: 1 },
                indent: { left: 720 },
                spacing: { before: 20, after: 40 },
                children: [
                  new TextRun({
                    text: 'Resolution: ',
                    bold: true,
                    size: 19,
                    color: '0F766E',
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: d,
                    size: 19,
                    color: '334155',
                    font: 'Arial',
                  }),
                ],
              })
            );
          });
        }
      });
    }

    // 8. Sign-off / Signatures
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({
            text: 'ADOPTION & ENDORSEMENT',
            bold: true,
            size: 20,
            color: '0F172A',
            font: 'Arial',
          }),
        ],
      })
    );

    const halfWidth = Math.floor(TOTAL_WIDTH_DXA / 2);
    children.push(
      new Table({
        width: { size: TOTAL_WIDTH_DXA, type: WidthType.DXA },
        borders: {
          top: BORDER_NONE,
          bottom: BORDER_NONE,
          left: BORDER_NONE,
          right: BORDER_NONE,
          insideHorizontal: BORDER_NONE,
          insideVertical: BORDER_NONE,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: halfWidth, type: WidthType.DXA },
                borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                children: [
                  new Paragraph({
                    spacing: { before: 200, after: 60 },
                    children: [new TextRun({ text: '________________________________________', color: '94A3B8' })],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Prepared & Recorded By',
                        bold: true,
                        size: 20,
                        color: '0F172A',
                        font: 'Arial',
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Secretariat / Administrative Officer',
                        size: 18,
                        color: '64748B',
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: halfWidth, type: WidthType.DXA },
                borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
                children: [
                  new Paragraph({
                    spacing: { before: 200, after: 60 },
                    children: [new TextRun({ text: '________________________________________', color: '94A3B8' })],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Approved & Adopted By',
                        bold: true,
                        size: 20,
                        color: '0F172A',
                        font: 'Arial',
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: minute.chairPerson || 'Chairperson / Presiding Officer',
                        size: 18,
                        color: '64748B',
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // Build the Document with A4 margins and Page Number Footer
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1080,
                bottom: 1080,
                left: 1080,
                right: 1080,
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${minute.title || 'Meeting Minute'}  •  Page `,
                      size: 17,
                      color: '94A3B8',
                      font: 'Arial',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 17,
                      color: '64748B',
                      bold: true,
                      font: 'Arial',
                    }),
                    new TextRun({
                      text: ' of ',
                      size: 17,
                      color: '94A3B8',
                      font: 'Arial',
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 17,
                      color: '64748B',
                      bold: true,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    // Generate safe filename
    const safeTitle = (minute.title || 'Meeting_Minute')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);
    const filename = `${safeTitle}_${minute.date || 'Minute'}.docx`;

    // Offline Desktop & Web Save Execution
    const win = window as any;
    if (win.electronAPI?.savePathDialog && win.electronAPI?.writeFile) {
      const filePath = await win.electronAPI.savePathDialog({
        title: 'Save Editable Meeting Minutes (.docx)',
        defaultPath: filename,
        filters: [{ name: 'Word Documents', extensions: ['docx'] }],
      });

      if (filePath) {
        const blob = await Packer.toBlob(doc);
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const success = await win.electronAPI.writeFile(filePath, Array.from(uint8Array), 'binary');
        if (success) {
          toast.success(`Word document saved successfully: ${filePath}`);
        } else {
          toast.error('Failed to write Word document file.');
        }
      }
      return;
    }

    // Standard Browser / Web Fallback
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Word document downloaded: ${filename}`);
  } catch (err: any) {
    console.error('Failed to export DOCX:', err);
    toast.error(`Error exporting Word document: ${err?.message || 'Unknown error'}`);
  }
}

// Helper: section heading with underline styling
function createSectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 21, // 10.5pt
        color: '0F172A',
        font: 'Arial',
      }),
    ],
  });
}

// Helper: meta info box for top 4-cell table
function createMetaBox(label: string, value: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: label,
            bold: true,
            size: 16, // 8pt
            color: '64748B',
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40 },
        children: [
          new TextRun({
            text: value,
            bold: true,
            size: 20, // 10pt
            color: '0F172A',
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// Helper: table header cell
function createTableHeaderCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: '0F766E', type: ShadingType.CLEAR }, // Deep corporate teal
    margins: { top: 140, bottom: 140, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold: true,
            color: 'FFFFFF',
            size: 19,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// Helper: table data cell
function createTableDataCell(
  text: string,
  width: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType],
  fill: string,
  bold = false
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold,
            color: '1E293B',
            size: 19,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// Helper: priority badge cell
function createPriorityCell(priority: string, width: number, fill: string): TableCell {
  const p = priority.toLowerCase();
  let color = '475569';
  if (p === 'urgent') color = 'DC2626';
  else if (p === 'high') color = 'EA580C';
  else if (p === 'medium') color = '0284C7';
  else if (p === 'low') color = '16A34A';

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: priority.toUpperCase(),
            bold: true,
            color,
            size: 18,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}
