function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "rounded-zb-md border px-3 py-2 text-sm font-medium transition",
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
  );
}

export default Tabs;
