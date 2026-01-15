import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { fetchAcsStates } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { GEO_OPTIONS } from "../lib/geography";

const formatPercent = (value) => `${value.toFixed(1)}%`;

function Housing() {
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
    const config = VIEW_CONFIGS.housing;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const { data, label } = await fetchAcsStates({
          year: ACS_YEARS[0],
          variables: [
            config.variables.totalUnits,
            config.variables.built2020,
            config.variables.built2010_2019,
          ],
        });

        const allowed = new Set(stateOptions.map((option) => option.fips));
        const parsed = data
          .slice(1)
          .map((row) => {
            const total = Number(row[1]);
            const built2020 = Number(row[2]);
            const built2010_2019 = Number(row[3]);
            const recent = built2020 + built2010_2019;
            const share = total ? (recent / total) * 100 : 0;
            return {
              name: row[0],
              state: row[4],
              share,
            };
          })
          .filter((row) => allowed.has(row.state))
          .sort((a, b) => b.share - a.share);

        const values = parsed.map((row) => row.share).sort((a, b) => a - b);
        const growthCut = values[Math.floor((values.length * 2) / 3)] ?? 0;

        const labeled = parsed.map((row) => ({
          ...row,
          growth: row.share >= growthCut ? "Growth neighborhood" : "Stable",
        }));

        if (!isActive) return;
        setRows(labeled);
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

  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">New Neighborhoods = New Demand</h2>
        <p className="text-sm text-zb-ink-muted">
          Share of housing units built since 2010 across major states.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading housing data...</p>
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
                  {formatPercent(row.share)} · {row.growth}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-dash-accent-1"
                  style={{ width: `${(row.share / maxShare) * 100}%` }}
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

export default Housing;
