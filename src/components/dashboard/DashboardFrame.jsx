import Sidebar from "./Sidebar";

function DashboardFrame({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="relative min-h-screen bg-dash-bg text-dash-ink">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "var(--dash-glow)" }} />
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-6 lg:pb-10 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Sidebar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

          <main className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-dash-muted">
                  Census Explorer
                </p>
                <h1 className="text-3xl font-semibold">{title}</h1>
                <p className="mt-1 text-sm text-dash-muted">{subtitle}</p>
              </div>
            </header>

            <div className="dash-card p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardFrame;
