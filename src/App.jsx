import { useMemo, useState } from "react";
import Badge from "./components/Badge";
import Tabs from "./components/Tabs";
import { ACS_YEARS } from "./lib/datasets";
import Density from "./views/Density";
import Growing from "./views/Growing";
import Income from "./views/Income";
import Cost from "./views/Cost";
import Workstyle from "./views/Workstyle";
import DemographicDemand from "./views/DemographicDemand";
import Housing from "./views/Housing";
import Popular from "./views/Popular";

function App() {
  const [activeTab, setActiveTab] = useState("popular");

  const tabs = [
    { id: "popular", label: "Popular" },
    { id: "growing", label: "Growing" },
    { id: "density", label: "Density" },
    { id: "income", label: "Income" },
    { id: "cost", label: "Cost" },
    { id: "workstyle", label: "Workstyle" },
    { id: "demand", label: "Demand" },
    { id: "housing", label: "Housing" },
  ];

  const View = useMemo(() => {
    switch (activeTab) {
      case "popular":
        return Popular;
      case "growing":
        return Growing;
      case "density":
        return Density;
      case "income":
        return Income;
      case "cost":
        return Cost;
      case "workstyle":
        return Workstyle;
      case "demand":
        return DemographicDemand;
      case "housing":
        return Housing;
      default:
        return Popular;
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-zb-bg text-zb-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
              Census Explorer
            </p>
            <h1 className="text-2xl font-semibold">Solopreneur Dashboards</h1>
          </div>
          <Badge>Data: U.S. Census</Badge>
        </header>

        <div className="flex flex-col gap-4 rounded-zb-lg border border-zb-border bg-zb-surface p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
              Focus Area
            </p>
            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>
        </div>

        <View yearRange={ACS_YEARS} />
      </div>
    </div>
  );
}

export default App;
