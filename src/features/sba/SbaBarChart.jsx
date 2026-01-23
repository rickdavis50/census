import { useMemo, useState } from "react";

const DEFAULT_OPTIONS = [10, 25, 50, "All"];

const formatValueFallback = (value) =>
  Number(value ?? 0).toLocaleString("en-US");

export const SbaChartSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-4 w-40 rounded bg-zb-subtle" />
    <div className="h-4 w-full rounded bg-zb-subtle" />
    <div className="h-4 w-5/6 rounded bg-zb-subtle" />
    <div className="h-4 w-3/4 rounded bg-zb-subtle" />
  </div>
);

function SbaBarChart({
  title,
  data,
  valueFormatter = formatValueFallback,
  sort = "desc",
}) {
  const [limit, setLimit] = useState(25);
  const showLimit = data.length > 60;

  if (!data.length) {
    return (
      <div className="rounded-zb-md border border-zb-border bg-zb-subtle px-4 py-6 text-sm text-zb-ink-muted">
        No chart data available.
      </div>
    );
  }

  const sortedData = useMemo(() => {
    if (sort === "none") return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const aValue = a.value ?? 0;
      const bValue = b.value ?? 0;
      return sort === "asc" ? aValue - bValue : bValue - aValue;
    });
    return copy;
  }, [data, sort]);

  const limitSource = useMemo(() => {
    if (!showLimit) return sortedData;
    if (sort === "none") {
      const copy = [...data];
      copy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      return copy;
    }
    return sortedData;
  }, [data, showLimit, sort, sortedData]);

  const limitedData = useMemo(() => {
    if (!showLimit) return sortedData;
    const limitValue = limit === "All" ? limitSource.length : Number(limit);
    return limitSource.slice(0, limitValue);
  }, [limit, limitSource, showLimit, sortedData]);

  const maxValue = useMemo(
    () => limitedData.reduce((max, entry) => Math.max(max, entry.value ?? 0), 0) || 1,
    [limitedData]
  );

  const rowHeight = 28;
  const barHeight = 12;
  const paddingY = 16;
  const labelWidth = 210;
  const valueWidth = 90;
  const chartWidth = 640;
  const barAreaWidth = chartWidth - labelWidth - valueWidth - 24;
  const height = Math.max(220, limitedData.length * rowHeight + paddingY * 2);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zb-ink">{title}</p>
        {showLimit && (
          <label className="flex items-center gap-2 text-xs text-zb-ink-muted">
            Show
            <select
              className="rounded-zb-sm border border-zb-border bg-zb-surface px-2 py-1 text-xs text-zb-ink"
              value={limit}
              onChange={(event) => {
                const nextValue = event.target.value;
                setLimit(nextValue === "All" ? "All" : Number(nextValue));
              }}
            >
              {DEFAULT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="max-h-[520px] overflow-y-auto rounded-zb-md border border-zb-border bg-zb-subtle">
        <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
          {limitedData.map((entry, index) => {
            const y = paddingY + index * rowHeight;
            const value = entry.value ?? 0;
            const barWidth = (value / maxValue) * barAreaWidth;

            return (
              <g key={`${entry.label}-${index}`} transform={`translate(12, ${y})`}>
                <text
                  x={0}
                  y={barHeight}
                  fill="var(--zb-ink)"
                  fontSize="11"
                >
                  {entry.label}
                </text>
                <rect
                  x={labelWidth}
                  y={2}
                  width={barWidth}
                  height={barHeight}
                  fill="var(--zb-blue)"
                  rx={6}
                />
                <text
                  x={labelWidth + barAreaWidth + 8}
                  y={barHeight}
                  fill="var(--zb-ink-muted)"
                  fontSize="11"
                >
                  {valueFormatter(value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default SbaBarChart;
