import { useMemo, useRef, useState } from "react";

const buildPath = (points) => {
  if (!points.length) return "";
  const d = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (i === 0) {
      d.push(`M ${point.x} ${point.y}`);
      continue;
    }
    const prev = points[i - 1];
    const next = points[i + 1] || point;
    const prevMidX = (prev.x + point.x) / 2;
    const nextMidX = (point.x + next.x) / 2;
    d.push(`C ${prevMidX} ${prev.y} ${nextMidX} ${point.y} ${point.x} ${point.y}`);
  }
  return d.join(" ");
};

function SmoothLineAreaChart({ data, height = 240 }) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(data.length / 2));
  const containerRef = useRef(null);

  const chart = useMemo(() => {
    const padding = { top: 16, right: 24, bottom: 32, left: 24 };
    const width = 640;
    const maxValue = Math.max(...data.map((d) => d.value));
    const minValue = Math.min(...data.map((d) => d.value));
    const range = maxValue - minValue || 1;

    const points = data.map((point, index) => {
      const x =
        padding.left +
        (index / (data.length - 1)) * (width - padding.left - padding.right);
      const y =
        padding.top +
        (1 - (point.value - minValue) / range) *
          (height - padding.top - padding.bottom);
      return { x, y, label: point.label, value: point.value };
    });

    return {
      width,
      height,
      padding,
      points,
      path: buildPath(points),
      minValue,
      maxValue,
    };
  }, [data, height]);

  const activePoint = chart.points[activeIndex];

  const onMove = (event) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const index = Math.round(
      ((x - chart.padding.left) /
        (chart.width - chart.padding.left - chart.padding.right)) *
        (data.length - 1)
    );
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    setActiveIndex(clamped);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      setActiveIndex((prev) => Math.min(data.length - 1, prev + 1));
    }
    if (event.key === "ArrowLeft") {
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      role="img"
      tabIndex={0}
      onMouseMove={onMove}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="w-full">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dash-accent-3)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => {
          const y =
            chart.padding.top +
            (line / 3) * (chart.height - chart.padding.top - chart.padding.bottom);
          return (
            <line
              key={`grid-${line}`}
              x1={chart.padding.left}
              x2={chart.width - chart.padding.right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        <path
          d={`${chart.path} L ${
            chart.width - chart.padding.right
          } ${chart.height - chart.padding.bottom} L ${chart.padding.left} ${
            chart.height - chart.padding.bottom
          } Z`}
          fill="url(#area-fill)"
        />
        <path
          d={chart.path}
          fill="none"
          stroke="var(--dash-accent-1)"
          strokeWidth="4"
        />

        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={chart.padding.top}
          y2={chart.height - chart.padding.bottom}
          stroke="rgba(255,255,255,0.12)"
        />

        <circle
          cx={activePoint.x}
          cy={activePoint.y}
          r="10"
          fill="rgba(0,246,127,0.2)"
        />
        <circle
          cx={activePoint.x}
          cy={activePoint.y}
          r="4"
          fill="var(--dash-accent-1)"
        />
      </svg>

      <div
        className="absolute -translate-x-1/2 rounded-dash-md border border-dash-border bg-dash-surface-2 px-4 py-3 text-center text-xs text-dash-ink shadow-dash-md"
        style={{ left: `${(activePoint.x / chart.width) * 100}%`, top: 12 }}
      >
        <p className="text-lg font-semibold text-dash-accent-1">
          {activePoint.value}%
        </p>
        <p className="uppercase tracking-[0.3em] text-[10px] text-dash-muted">
          Compare Growth
        </p>
        <p className="mt-2 text-xs text-dash-ink">US {activePoint.label}</p>
      </div>

      <div className="mt-4 flex justify-between text-xs text-dash-muted">
        {data.map((point, index) => (
          <span
            key={point.label}
            className={
              index === activeIndex ? "text-dash-ink" : "text-dash-muted"
            }
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SmoothLineAreaChart;
