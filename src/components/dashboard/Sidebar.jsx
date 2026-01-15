const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pages", label: "Pages" },
  { id: "insights", label: "Insights" },
  { id: "users", label: "Users" },
  { id: "layout", label: "Layout" },
];

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

function Sidebar() {
  return (
    <>
      <aside className="hidden flex-col gap-6 rounded-dash-lg border border-dash-border bg-dash-surface p-4 lg:flex">
        <div className="flex items-center justify-center rounded-full bg-dash-surface-2 p-3">
          <div className="h-8 w-8 rounded-full bg-dash-accent-3" />
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {navItems.map((item, index) => (
            <div key={item.id} className="flex flex-col items-center gap-2">
              <Icon active={index === 0} />
              <span className="text-xs text-dash-muted">{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-dash-border bg-dash-bg-2 px-4 py-2 lg:hidden">
        {navItems.map((item, index) => (
          <div key={item.id} className="flex flex-col items-center gap-1">
            <Icon active={index === 0} />
            <span className="text-[10px] text-dash-muted">{item.label}</span>
          </div>
        ))}
      </nav>
    </>
  );
}

export default Sidebar;
