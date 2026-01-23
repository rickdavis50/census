const Icon = ({ active }) => (
  <div
    className={[
      "flex h-10 w-10 items-center justify-center rounded-full border",
      active
        ? "border-dash-accent-3 bg-dash-surface-2 text-dash-accent-1 shadow-dash-sm"
        : "border-dash-border text-dash-muted",
    ].join(" ")}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 18V6M10 18V10M16 18V4M22 18V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

function Sidebar({ tabs, activeTab, onTabChange }) {
  return (
    <>
      <aside className="hidden flex-col gap-6 rounded-dash-lg border border-dash-border bg-dash-surface p-4 lg:flex">
        <div className="flex items-center justify-center rounded-full bg-dash-surface-2 p-3">
          <div className="h-8 w-8 rounded-full bg-dash-accent-3" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-dash-muted">
            Focus Area
          </p>
          <div className="mt-4 flex max-h-[calc(100vh-260px)] flex-col gap-3 overflow-y-auto pr-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const isSba = Boolean(tab.isSba);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={[
                    "flex items-center gap-3 rounded-dash-md border px-3 py-2 text-sm transition",
                    isActive
                      ? "border-dash-accent-3 bg-dash-surface-2 text-dash-ink"
                      : "border-dash-border text-dash-muted hover:text-dash-ink",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      isSba ? "bg-zb-blue" : "bg-dash-accent-1",
                    ].join(" ")}
                  />
                  <Icon active={isActive} />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-dash-border bg-dash-bg-2 px-4 py-2 lg:hidden">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-1"
            >
              <Icon active={isActive} />
              <span className="text-[10px] text-dash-muted">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default Sidebar;
