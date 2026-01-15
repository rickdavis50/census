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
          "linear-gradient(90deg, transparent, black 16px, black calc(100% - 16px), transparent)",
        maskImage:
          "linear-gradient(90deg, transparent, black 16px, black calc(100% - 16px), transparent)",
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
                "whitespace-nowrap rounded-zb-md border px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "border-zb-blue bg-zb-surface text-zb-ink"
                  : "border-zb-border text-zb-ink-muted hover:text-zb-ink",
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
