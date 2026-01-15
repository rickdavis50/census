import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { fetchAcsSeries } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const formatCurrency = (value) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function Income({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [series, setSeries] = useState([]);
  const [survey, setSurvey] = useState("");

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);
  const config = VIEW_CONFIGS.income;

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const { results, label } = await fetchAcsSeries({
          years: ACS_YEARS,
          variables: [config.variables.medianIncome],
          geoParams: getGeoParams(geo),
        });

        const rows = results.map((item) => {
          const row = item.data[1];
          return {
            year: item.year,
            value: Number(row?.[1] ?? 0),
          };
        });

        if (!isActive) return;
        setSeries(rows);
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
  }, [geo, config.variables.medianIncome]);

  const deltas = series.map((row, index) => {
    if (index === series.length - 1) return null;
    const prev = series[index + 1];
    return row.value - prev.value;
  });
  const maxDelta =
    deltas.reduce((max, delta) => Math.max(max, Math.abs(delta || 0)), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Household Income Tailwind</h2>
        <p className="text-sm text-zb-ink-muted">
          Median household income trend for {geoLabel}.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading income data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="overflow-hidden rounded-zb-md border border-zb-border">
          <table className="w-full text-sm">
            <thead className="bg-zb-surface-strong text-left text-zb-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Median income</th>
                <th className="px-4 py-3 font-medium">YoY change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zb-border">
              {series.map((row, index) => {
                const delta = deltas[index];
                return (
                  <tr key={row.year} className="odd:bg-zb-surface">
                    <td className="px-4 py-3">{row.year}</td>
                    <td className="px-4 py-3">{formatCurrency(row.value)}</td>
                    <td className="px-4 py-3">
                      {delta === null ? "—" : formatCurrency(delta)}
                      {delta !== null && (
                        <div className="mt-2 h-1 w-full rounded-full bg-zb-subtle">
                          <div
                            className="h-1 rounded-full bg-zb-green"
                            style={{
                              width: `${(Math.abs(delta) / maxDelta) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Year range: {ACS_YEARS[2]}-{ACS_YEARS[0]} ({survey})
      </p>
      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (ACS)
      </p>
    </Card>
  );
}

export default Income;
