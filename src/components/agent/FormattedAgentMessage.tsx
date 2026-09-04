import React from 'react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

interface Props {
  text: string;
  isUser?: boolean;
}

export function FormattedAgentMessage({ text, isUser }: Props) {
  const { isDark } = useTheme();
  if (!text) return null;

  // Helper to parse inline markdown: **bold**, *italic*, `code`
  const renderInline = (str: string): React.ReactNode => {
    if (!str) return null;
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let key = 0;

    // Pattern matches **bold**, *italic*, and `code`
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/;

    while (remaining) {
      const match = regex.exec(remaining);
      if (!match) {
        parts.push(remaining);
        break;
      }

      const matchIndex = match.index;
      if (matchIndex > 0) {
        parts.push(remaining.slice(0, matchIndex));
      }

      const matchedText = match[0];
      if (matchedText.startsWith('**') && matchedText.endsWith('**') && matchedText.length >= 4) {
        parts.push(
          <strong
            key={key++}
            className={cn(
              'font-semibold',
              isUser ? 'text-white' : isDark ? 'text-slate-100 font-bold' : 'text-slate-900 font-bold'
            )}
          >
            {matchedText.slice(2, -2)}
          </strong>
        );
      } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        parts.push(
          <code
            key={key++}
            className={cn(
              "px-1.5 py-0.5 rounded font-mono text-[11px] border",
              isUser
                ? "bg-white/20 text-white border-white/20"
                : isDark
                  ? "bg-slate-800 text-amber-300 border-slate-700"
                  : "bg-slate-200/70 text-indigo-700 border-slate-300"
            )}
          >
            {matchedText.slice(1, -1)}
          </code>
        );
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*') && matchedText.length >= 2) {
        parts.push(
          <em
            key={key++}
            className={cn(
              'italic',
              isUser ? 'text-white/90' : isDark ? 'text-sky-300' : 'text-sky-700'
            )}
          >
            {matchedText.slice(1, -1)}
          </em>
        );
      } else {
        parts.push(matchedText);
      }

      remaining = remaining.slice(matchIndex + matchedText.length);
    }

    return parts;
  };

  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        // Header e.g. ## Heading or ### Heading
        if (line.startsWith('#')) {
          const headerText = line.replace(/^#+\s*/, '');
          return (
            <h4
              key={idx}
              className={cn(
                "text-xs font-bold uppercase tracking-wider mt-2 mb-1 border-b pb-0.5",
                isDark 
                  ? "text-indigo-300 border-indigo-500/20" 
                  : "text-indigo-700 border-indigo-200"
              )}
            >
              {renderInline(headerText)}
            </h4>
          );
        }

        // Bullet point e.g. - item or * item or • item
        if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
          const cleanItem = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className={cn("font-bold text-sm leading-none mt-0.5", isDark ? "text-indigo-400" : "text-indigo-600")}>•</span>
              <div className={cn("flex-1", isDark ? "text-slate-200" : "text-slate-800")}>
                {renderInline(cleanItem)}
              </div>
            </div>
          );
        }

        // Blockquote e.g. > Quote
        if (line.startsWith('>')) {
          const quoteText = line.replace(/^>\s*/, '');
          return (
            <div
              key={idx}
              className={cn(
                "border-l-2 rounded-r-md px-2.5 py-1.5 my-1.5 italic text-[11.5px]",
                isDark 
                  ? "border-indigo-500/60 bg-indigo-500/10 text-slate-300" 
                  : "border-indigo-400 bg-indigo-50 text-indigo-900"
              )}
            >
              {renderInline(quoteText)}
            </div>
          );
        }

        return (
          <p
            key={idx}
            className={cn(
              isUser ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'
            )}
          >
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
