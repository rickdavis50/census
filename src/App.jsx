import { useMemo, useState } from "react";
import { ACS_YEARS } from "./lib/datasets";
import Density from "./views/Density";
import Growing from "./views/Growing";
import Income from "./views/Income";
import Cost from "./views/Cost";
import Workstyle from "./views/Workstyle";
import DemographicDemand from "./views/DemographicDemand";
import Housing from "./views/Housing";
import Popular from "./views/Popular";
import DashboardFrame from "./components/dashboard/DashboardFrame";
import SmoothLineAreaChart from "./components/charts/SmoothLineAreaChart";
import ProgressRing from "./components/charts/ProgressRing";
import StackedBars from "./components/charts/StackedBars";

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
    <DashboardFrame
      title="Solopreneur Dashboards"
      subtitle="Current Census signals across growth, demand, and cost pressure."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      lineCard={
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Statistic Overview</h2>
            <span className="rounded-full border border-dash-border px-3 py-1 text-xs text-dash-muted">
              Jul
            </span>
          </div>
          <SmoothLineAreaChart
            data={[
              { label: "Jan", value: 22 },
              { label: "Feb", value: 34 },
              { label: "Mar", value: 18 },
              { label: "Apr", value: 28 },
              { label: "May", value: 42 },
              { label: "Jun", value: 36 },
              { label: "Jul", value: 46 },
              { label: "Aug", value: 41 },
              { label: "Sep", value: 38 },
              { label: "Oct", value: 47 },
              { label: "Nov", value: 58 },
              { label: "Dec", value: 64 },
            ]}
          />
        </div>
      }
      ringCard={<ProgressRing value={45} />}
      stackedCard={<StackedBars />}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">View Detail</h2>
          <span className="text-xs text-dash-muted">
            Active: {tabs.find((tab) => tab.id === activeTab)?.label}
          </span>
        </div>
        <View yearRange={ACS_YEARS} />
      </div>
    </DashboardFrame>
  );
}

export default App;
