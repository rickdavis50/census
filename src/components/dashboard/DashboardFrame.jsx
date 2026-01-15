import Badge from "../Badge";
import Select from "../Select";
import Tabs from "../Tabs";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";

function DashboardFrame({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  controls,
  lineCard,
  ringCard,
  stackedCard,
}) {
  return (
    <div className="relative min-h-screen bg-dash-bg text-dash-ink">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "var(--dash-glow)" }} />
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-6 lg:pb-10 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-[80px_minmax(0,1fr)_280px]">
          <Sidebar />

          <main className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-dash-muted">
                  Census Explorer
                </p>
                <h1 className="text-3xl font-semibold">{title}</h1>
                <p className="mt-1 text-sm text-dash-muted">{subtitle}</p>
              </div>
              <Badge>Data: U.S. Census</Badge>
            </header>

            <div className="dash-card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.32em] text-dash-muted">
                    Focus Area
                  </p>
                  <Tabs tabs={tabs} active={activeTab} onChange={onTabChange} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Select value="Monthly" onChange={() => {}} className="w-32">
                    <option>Monthly</option>
                    <option>Quarterly</option>
                  </Select>
                  <Select value="2017" onChange={() => {}} className="w-24">
                    <option>2017</option>
                    <option>2018</option>
                    <option>2019</option>
                  </Select>
                </div>
              </div>
              {controls}
            </div>

            <div className="dash-card p-6">{lineCard}</div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="dash-card p-6">{ringCard}</div>
              <div className="dash-card p-6">{stackedCard}</div>
            </div>

            <div className="dash-card p-6">{children}</div>
          </main>

          <div className="lg:row-span-2">
            <RightPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardFrame;
