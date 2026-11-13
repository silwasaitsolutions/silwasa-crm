import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState, ErrorState, Skeleton } from "./feedback";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hidden below the `md` breakpoint to keep the table usable on phones. */
  hideOnMobile?: boolean;
  /** Visually hidden header text for icon-only columns (e.g. actions). */
  srOnlyHeader?: boolean;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  empty: { title: string; description?: string; action?: ReactNode };
  skeletonRows?: number;
}

/** Generic table with built-in loading, error and empty states. */
export function DataTable<T>({ caption, columns, rows, rowKey, isLoading, error, onRetry, empty, skeletonRows = 5 }: DataTableProps<T>) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;

  const showEmpty = !isLoading && (rows?.length ?? 0) === 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 font-medium", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`} data-testid="skeleton-row">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", c.hideOnMobile && "hidden md:table-cell")}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle text-slate-700", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {showEmpty ? <EmptyState {...empty} /> : null}
    </div>
  );
}
