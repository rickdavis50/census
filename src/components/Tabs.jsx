import { useRef } from "react";

function Tabs({ tabs, active, onChange }) {
  const scrollRef = useRef(null);

  const onWheel = (event) => {
    if (!scrollRef.current) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    scrollRef.current.scrollLeft += event.deltaY;
  };

  return (
    <div
      className="relative max-w-full"
      style={{
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, black 12px, black calc(100% - 12px), transparent)",
        maskImage:
          "linear-gradient(90deg, transparent, black 12px, black calc(100% - 12px), transparent)",
      }}
    >
      <div
        ref={scrollRef}
        onWheel={onWheel}
        className="flex w-full gap-2 overflow-x-auto py-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={[
                "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                isActive
                  ? "border-dash-accent-2 bg-dash-surface-2 text-dash-ink shadow-dash-sm"
                  : "border-dash-border text-dash-muted hover:text-dash-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
