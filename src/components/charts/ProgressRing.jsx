function ProgressRing({ value = 45, size = 180, stroke = 12 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Proportion (%)</p>
        <span className="rounded-full border border-dash-border px-3 py-1 text-xs text-dash-muted">
          Jul
        </span>
      </div>
      <div className="relative mx-auto">
        <svg width={size} height={size}>
          <defs>
            <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--dash-accent-1)" />
              <stop offset="100%" stopColor="var(--dash-accent-3)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ring-gradient)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold">{value}%</p>
          <p className="text-xs uppercase tracking-[0.3em] text-dash-muted">
            Total Spending
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProgressRing;
