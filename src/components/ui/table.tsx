import * as React from "react"
import { cn } from "@/src/lib/utils"

const TableContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const scrollLeftRef = React.useRef(0);
  const scrollTopRef = React.useRef(0);
  const hasMoved = React.useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only capture left-clicks, and skip any interactive elements.
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], label')) return;
    
    const container = innerRef.current;
    if (!container) return;
    
    startX.current = e.pageX - container.offsetLeft;
    startY.current = e.pageY - container.offsetTop;
    scrollLeftRef.current = container.scrollLeft;
    scrollTopRef.current = container.scrollTop;
    hasMoved.current = false;
    
    // We don't set isDragging to true yet to prevent cursor changes from interrupting clicks
    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - container.offsetLeft;
      const y = moveEvent.pageY - container.offsetTop;
      const walkX = x - startX.current;
      const walkY = y - startY.current;

      if (!hasMoved.current && (Math.abs(walkX) > 10 || Math.abs(walkY) > 10)) {
        hasMoved.current = true;
        setIsDragging(true);
      }

      if (hasMoved.current) {
        moveEvent.preventDefault();
        container.scrollLeft = scrollLeftRef.current - walkX;
        container.scrollTop = scrollTopRef.current - walkY;
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

  return (
    <div 
      ref={innerRef}
      className={cn("relative w-full overflow-auto max-h-[70vh]", isDragging ? "cursor-grabbing select-none" : "cursor-grab", className)}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {children}
    </div>
  );
});

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <TableContainer>
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </TableContainer>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-[0_1px_3px_-2px_rgba(0,0,0,0.1)]", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t bg-slate-100/50 dark:bg-slate-800/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("border-b border-slate-100 dark:border-slate-700/60 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-700", className)} {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("h-12 px-4 text-left align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0", className)} {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-slate-500 dark:text-slate-400", className)} {...props} />
))
TableCaption.displayName = "TableCaption"

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
