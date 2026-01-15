import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import { fetchAcsSeries } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";
import { fetchStateOptions } from "../lib/stateOptions";

const formatPercent = (value) => `${value.toFixed(1)}%`;

function DemographicDemand() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [survey, setSurvey] = useState("");
  const [options, setOptions] = useState([
    { value: "us", label: "United States", type: "us" },
  ]);
  const [geoId, setGeoId] = useState("us");

  const selectedGeo = useMemo(() => {
    if (geoId === "us") {
      return { label: "United States", type: "us" };
    }
    return options.find((option) => option.value === geoId);
  }, [geoId, options]);

  const geoLabel = useMemo(() => getGeoLabel(selectedGeo), [selectedGeo]);
  const config = VIEW_CONFIGS.demand;

  useEffect(() => {
    let isActive = true;

    const loadOptions = async () => {
      try {
        const states = await fetchStateOptions();
        if (!isActive) return;
        setOptions([
          { value: "us", label: "United States", type: "us" },
          ...states,
        ]);
      } catch (err) {
        return;
      }
    };

    loadOptions();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const variables = [
          config.variables.popTotal,
          config.variables.age25_29_m,
          config.variables.age30_34_m,
          config.variables.age25_29_f,
          config.variables.age30_34_f,
          config.variables.hhTotal,
          config.variables.hhWithKids,
        ];

        const [geoSeries, nationalSeries] = await Promise.all([
          fetchAcsSeries({
            years: [ACS_YEARS[0]],
            variables,
            geoParams: getGeoParams(selectedGeo),
          }),
          fetchAcsSeries({
            years: [ACS_YEARS[0]],
            variables,
            geoParams: { for: "us:1" },
          }),
        ]);

        const parseMetrics = (result) => {
          const row = result.results[0].data[1];
          const popTotal = Number(row?.[1] ?? 0);
          const age25_29_m = Number(row?.[2] ?? 0);
          const age30_34_m = Number(row?.[3] ?? 0);
          const age25_29_f = Number(row?.[4] ?? 0);
          const age30_34_f = Number(row?.[5] ?? 0);
          const hhTotal = Number(row?.[6] ?? 0);
          const hhWithKids = Number(row?.[7] ?? 0);

          const youngShare = popTotal
            ? ((age25_29_m + age30_34_m + age25_29_f + age30_34_f) / popTotal) *
              100
            : 0;
          const familyShare = hhTotal ? (hhWithKids / hhTotal) * 100 : 0;
          const index = (youngShare + familyShare) / 2;

          return { youngShare, familyShare, index };
        };

        const geoMetrics = parseMetrics(geoSeries);
        const nationalMetrics = parseMetrics(nationalSeries);

        if (!isActive) return;
        setMetrics(geoMetrics);
        setBaseline(nationalMetrics);
        setSurvey(geoSeries.label);
        setStatus("success");
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
        setStatus("error");
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [selectedGeo, config.variables]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Customer Demographics: Movers & Builders
        </h2>
        <p className="text-sm text-zb-ink-muted">
          Signals from young adults and households with children in {geoLabel}.
        </p>
      </div>
      <div className="max-w-xs">
        <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
          Geography
        </p>
        <Select
          value={geoId}
          onChange={(event) => setGeoId(event.target.value)}
          className="mt-2"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading demographics...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && metrics && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Population ages 25-34</span>
              <span className="text-zb-ink-muted">
                {formatPercent(metrics.youngShare)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zb-subtle">
              <div
                className="h-2 rounded-full bg-zb-green"
                style={{ width: `${metrics.youngShare}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Households with children</span>
              <span className="text-zb-ink-muted">
                {formatPercent(metrics.familyShare)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zb-subtle">
              <div
                className="h-2 rounded-full bg-zb-blue"
                style={{ width: `${metrics.familyShare}%` }}
              />
            </div>
          </div>

          <div className="rounded-zb-md border border-zb-border bg-zb-surface-strong p-4 text-sm">
            Starter-market index:{" "}
            <span className="font-medium">
              {formatPercent(metrics.index)}
            </span>
          </div>
          {baseline && (
            <div className="text-xs text-zb-ink-muted">
              National average: 25–34 {formatPercent(baseline.youngShare)} ·
              Households with children {formatPercent(baseline.familyShare)} ·
              Index {formatPercent(baseline.index)}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Year: {ACS_YEARS[0]} ({survey})
      </p>
      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (ACS)
      </p>
    </Card>
  );
}

export default DemographicDemand;
