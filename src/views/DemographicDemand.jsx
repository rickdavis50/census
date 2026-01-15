import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { fetchAcsSeries } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const formatPercent = (value) => `${value.toFixed(1)}%`;

function DemographicDemand({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [survey, setSurvey] = useState("");

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);
  const config = VIEW_CONFIGS.demand;

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const { results, label } = await fetchAcsSeries({
          years: [ACS_YEARS[0]],
          variables: [
            config.variables.popTotal,
            config.variables.age25_29_m,
            config.variables.age30_34_m,
            config.variables.age25_29_f,
            config.variables.age30_34_f,
            config.variables.hhTotal,
            config.variables.hhWithKids,
          ],
          geoParams: getGeoParams(geo),
        });

        const row = results[0].data[1];
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

        if (!isActive) return;
        setMetrics({ youngShare, familyShare, index });
        setSurvey(label);
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
  }, [geo, config.variables]);

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
