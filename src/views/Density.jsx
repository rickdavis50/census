import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NONEMP_YEARS } from "../lib/datasets";
import { GEO_OPTIONS } from "../lib/geography";

const formatNumber = (value) => Number(value).toLocaleString();

function Density({ geo, yearRange }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const stateOptions = useMemo(
    () => GEO_OPTIONS.filter((option) => option.type === "state"),
    []
  );

  useEffect(() => {
    let isActive = true;
    const acsYear = yearRange[0];
    const nonempYear = NONEMP_YEARS[0];

    const load = async () => {
      setStatus("loading");
      setError("");

      try {
        const popUrl = buildUrl(DATASETS.acs.getBase(acsYear), {
          get: ["NAME", DATASETS.acs.variables.population],
          for: "state:*",
        });
        const nonempUrl = buildUrl(DATASETS.nonemp.getBase(nonempYear), {
          get: [
            DATASETS.nonemp.variables.establishments,
            DATASETS.nonemp.variablesByYear[nonempYear].naics,
          ],
          for: "state:*",
          [DATASETS.nonemp.variablesByYear[nonempYear].naics]: "00",
        });

        const [popData, nonempData] = await Promise.all([
          cachedFetch(popUrl, () => fetchJson(popUrl)),
          cachedFetch(nonempUrl, () => fetchJson(nonempUrl)),
        ]);

        const popRows = popData.slice(1).map((row) => ({
          name: row[0],
          population: Number(row[1]),
          state: row[2],
        }));

        const nonempRows = nonempData.slice(1).map((row) => ({
          count: Number(row[0]),
          naics: row[1],
          state: row[2],
        }));

        const nonempMap = new Map(
          nonempRows.map((row) => [row.state, row.count])
        );
        const allowedStates = new Set(stateOptions.map((option) => option.fips));

        const density = popRows
          .filter((row) => allowedStates.has(row.state))
          .map((row) => {
            const nonemp = nonempMap.get(row.state) || 0;
            const per10k = row.population
              ? (nonemp / row.population) * 10000
              : 0;
            return {
              name: row.name,
              state: row.state,
              nonemp,
              population: row.population,
              per10k,
            };
          })
          .sort((a, b) => b.per10k - a.per10k);

        if (!isActive) return;
        setRows(density);
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
  }, [yearRange, stateOptions]);

  const maxValue = rows.reduce((max, row) => Math.max(max, row.per10k), 0) || 1;
  const highlightState = geo?.type === "state" ? geo.fips : null;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Solopreneur Density Index</h2>
        <p className="text-sm text-zb-ink-muted">
          Nonemployer firms per 10,000 residents across major states.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading density data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.state}
              className={[
                "rounded-zb-md border border-transparent p-2",
                row.state === highlightState ? "border-zb-blue" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between text-sm">
                <span>{row.name}</span>
                <span className="text-zb-ink-muted">
                  {row.per10k.toFixed(1)} / 10k
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-zb-green"
                  style={{ width: `${(row.per10k / maxValue) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zb-ink-muted">
                {formatNumber(row.nonemp)} nonemployers ·{" "}
                {formatNumber(row.population)} residents
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Higher density = more competition AND more proven demand.
      </p>
      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (ACS {yearRange[0]}, Nonemployer{" "}
        {NONEMP_YEARS[0]})
      </p>
    </Card>
  );
}

export default Density;
