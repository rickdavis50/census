import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NONEMP_YEARS } from "../lib/datasets";
import { GEO_OPTIONS, getGeoParams } from "../lib/geography";

const MAX_ROWS = 8;
const MAX_STATES = 3;

const isSectorCode = (code) => code.length === 2 && code !== "00";

const formatNumber = (value) => Number(value).toLocaleString();

function Popular() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [stateIds, setStateIds] = useState(["ca", "tx", "ny"]);
  const [results, setResults] = useState([]);

  const stateOptions = useMemo(
    () => GEO_OPTIONS.filter((option) => option.type === "state"),
    []
  );

  const toggleState = (id) => {
    setStateIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_STATES) {
        return prev;
      }
      return [...prev, id];
    });
  };

  useEffect(() => {
    let isActive = true;
    const year = NONEMP_YEARS[0];
    const variables = DATASETS.nonemp.variablesByYear[year];

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const selections = stateOptions.filter((option) =>
          stateIds.includes(option.id)
        );
        if (!selections.length) {
          setResults([]);
          setStatus("success");
          return;
        }

        const dataByState = await Promise.all(
          selections.map(async (option) => {
            const url = buildUrl(DATASETS.nonemp.getBase(year), {
              get: [
                variables.naics,
                variables.label,
                DATASETS.nonemp.variables.establishments,
              ],
              ...getGeoParams(option),
            });

            const data = await cachedFetch(url, () => fetchJson(url));
            const rows = data
              .slice(1)
              .map((row) => ({
                code: row[0],
                label: row[1],
                value: Number(row[2]),
              }))
              .filter((row) => isSectorCode(row.code))
              .sort((a, b) => b.value - a.value)
              .slice(0, MAX_ROWS);

            return { state: option.label, rows };
          })
        );

        if (!isActive) return;
        setResults(dataByState);
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
  }, [stateIds, stateOptions]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Top Nonemployer Industries (Head-to-Head)
        </h2>
        <p className="text-sm text-zb-ink-muted">
          Compare up to three states by nonemployer establishment counts.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
          Select up to {MAX_STATES} states
        </p>
        <div className="flex flex-wrap gap-2">
          {stateOptions.map((option) => {
            const isSelected = stateIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleState(option.id)}
                className={[
                  "rounded-zb-md border px-3 py-2 text-xs font-medium",
                  isSelected
                    ? "border-zb-blue bg-zb-surface text-zb-ink"
                    : "border-zb-border text-zb-ink-muted",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading nonemployer data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="text-sm text-zb-ink-muted">
          Select at least one state to compare.
        </p>
      )}

      {status === "success" && results.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          {results.map((state) => {
            const maxValue =
              state.rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;

            return (
              <div key={state.state} className="space-y-4">
                <p className="text-sm font-medium">{state.state}</p>
                <div className="space-y-3">
                  {state.rows.map((row) => (
                    <div key={row.code} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{row.label}</span>
                        <span className="text-zb-ink-muted">
                          {formatNumber(row.value)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zb-subtle">
                        <div
                          className="h-2 rounded-full bg-zb-blue"
                          style={{
                            width: `${(row.value / maxValue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (Nonemployer Statistics, {NONEMP_YEARS[0]})
      </p>
    </Card>
  );
}

export default Popular;
