import { useMemo, useState } from "react";
import Badge from "./components/Badge";
import Select from "./components/Select";
import Tabs from "./components/Tabs";
import { ACS_YEARS } from "./lib/datasets";
import { GEO_OPTIONS, getGeoLabel } from "./lib/geography";
import Density from "./views/Density";
import Growing from "./views/Growing";
import Popular from "./views/Popular";

function App() {
  const [activeTab, setActiveTab] = useState("popular");
  const [geoId, setGeoId] = useState("us");

  const geo = useMemo(
    () => GEO_OPTIONS.find((option) => option.id === geoId),
    [geoId]
  );

  const tabs = [
    { id: "popular", label: "Popular" },
    { id: "growing", label: "Growing" },
    { id: "density", label: "Density" },
  ];

  const View = useMemo(() => {
    switch (activeTab) {
      case "popular":
        return Popular;
      case "growing":
        return Growing;
      case "density":
        return Density;
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
          {activeTab === "growing" && (
            <div className="w-full md:w-64">
              <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
                Geography
              </p>
              <Select
                value={geoId}
                onChange={(event) => setGeoId(event.target.value)}
                className="mt-2"
              >
                {GEO_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-xs text-zb-ink-muted">
                Viewing: {getGeoLabel(geo)}
              </p>
            </div>
          )}
        </div>

        <View geo={geo} yearRange={ACS_YEARS} />
      </div>
    </div>
  );
}

export default App;
