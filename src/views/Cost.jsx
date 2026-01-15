import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { fetchAcsStates } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { GEO_OPTIONS } from "../lib/geography";

const formatCurrency = (value) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function Cost() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [survey, setSurvey] = useState("");

  const stateOptions = useMemo(
    () => GEO_OPTIONS.filter((option) => option.type === "state"),
    []
  );

  useEffect(() => {
    let isActive = true;
    const config = VIEW_CONFIGS.cost;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const { data, label } = await fetchAcsStates({
          year: ACS_YEARS[0],
          variables: [config.variables.medianRent],
        });

        const allRows = data.slice(1).map((row) => ({
          name: row[0],
          value: Number(row[1]),
          state: row[2],
        }));

        const allowed = new Set(stateOptions.map((option) => option.fips));
        const filtered = allRows
          .filter((row) => allowed.has(row.state))
          .sort((a, b) => b.value - a.value);

        const values = filtered.map((row) => row.value).sort((a, b) => a - b);
        const lowIndex = Math.floor(values.length / 3);
        const highIndex = Math.floor((values.length * 2) / 3);
        const lowCut = values[lowIndex] ?? 0;
        const highCut = values[highIndex] ?? 0;

        const withSignal = filtered.map((row) => ({
          ...row,
          signal:
            row.value >= highCut
              ? "High"
              : row.value >= lowCut
              ? "Medium"
              : "Low",
        }));

        if (!isActive) return;
        setRows(withSignal);
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
  }, [stateOptions]);

  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Cost-of-Living Signal</h2>
        <p className="text-sm text-zb-ink-muted">
          Median gross rent across major states with low/med/high markers.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading rent data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.state} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{row.name}</span>
                <span className="text-zb-ink-muted">
                  {formatCurrency(row.value)} · {row.signal}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-dash-accent-1"
                  style={{ width: `${(row.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
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

export default Cost;
