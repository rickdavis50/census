const weekData = [
  { day: "Mon", segments: [20, 30, 25] },
  { day: "Tue", segments: [28, 35, 18] },
  { day: "Wed", segments: [22, 26, 32] },
  { day: "Thu", segments: [30, 24, 28] },
  { day: "Fri", segments: [35, 32, 26] },
  { day: "Sat", segments: [18, 20, 14] },
  { day: "Sun", segments: [22, 24, 20] },
];

const segmentColors = [
  "bg-dash-accent-3",
  "bg-dash-accent-2",
  "bg-dash-accent-1",
];

function StackedBars() {
  const maxValue = Math.max(
    ...weekData.map((item) => item.segments.reduce((sum, value) => sum + value, 0))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Week of spending</p>
        <div className="flex items-center gap-4 text-xs text-dash-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-dash-accent-3" />
            Title 1
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-dash-accent-2" />
            Title 2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-dash-accent-1" />
            Title 3
          </span>
        </div>
      </div>
      <p className="text-sm text-dash-muted">$ 6,358,130</p>
      <div className="grid grid-cols-7 items-end gap-3">
        {weekData.map((item) => {
          const total = item.segments.reduce((sum, value) => sum + value, 0);
          return (
            <div key={item.day} className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-full flex-col justify-end gap-1">
                {item.segments.map((segment, index) => (
                  <div
                    key={`${item.day}-${index}`}
                    className={`${segmentColors[index]} rounded-md`}
                    style={{
                      height: `${(segment / maxValue) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-dash-muted">{item.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StackedBars;
