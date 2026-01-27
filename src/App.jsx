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
import LoanSize from "./views/LoanSize";
import BusinessFormation from "./views/BusinessFormation";
import DashboardFrame from "./components/dashboard/DashboardFrame";
import NaicsHeatMapView from "./features/naicsHeatMap/NaicsHeatMapView";
import Sba7aVolumeView from "./features/sba/views/Sba7aVolumeView";
import Sba504IndustryView from "./features/sba/views/Sba504IndustryView";
import SbaSizeStandardsView from "./features/sba/views/SbaSizeStandardsView";

function App() {
  const [activeTab, setActiveTab] = useState("popular");

  const tabs = [
    { id: "popular", label: "Popular" },
    { id: "growing", label: "Growing" },
    { id: "density", label: "Density" },
    { id: "income", label: "Income" },
    { id: "cost", label: "Cost" },
    { id: "loan-size", label: "Loan Size" },
    { id: "bfs", label: "Business Formation (BFS)" },
    { id: "workstyle", label: "Workstyle" },
    { id: "demand", label: "Demand" },
    { id: "housing", label: "Housing" },
    { id: "naics-heatmap", label: "NAICS Heat Map" },
    { id: "sba-7a", label: "SBA 7(a) Loans — Volume", isSba: true },
    { id: "sba-504", label: "SBA 504 Loans — By Industry", isSba: true },
    { id: "sba-size-standards", label: "SBA Size Standards — By NAICS", isSba: true },
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
      case "loan-size":
        return LoanSize;
      case "bfs":
        return BusinessFormation;
      case "workstyle":
        return Workstyle;
      case "demand":
        return DemographicDemand;
      case "housing":
        return Housing;
      case "naics-heatmap":
        return NaicsHeatMapView;
      case "sba-7a":
        return Sba7aVolumeView;
      case "sba-504":
        return Sba504IndustryView;
      case "sba-size-standards":
        return SbaSizeStandardsView;
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
