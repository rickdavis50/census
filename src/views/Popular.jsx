import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NONEMP_YEARS } from "../lib/datasets";
import { GEO_OPTIONS, getGeoParams } from "../lib/geography";

const MAX_ROWS = 8;

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

  const setStateAtIndex = (index, id) => {
    setStateIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      const next = [...prev];
      next[index] = id;
      return next;
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
              .sort((a, b) => b.value - a.value);

            return { state: option.label, id: option.id, rows };
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

  const primaryState = results.find((item) => item.id === stateIds[0]);
  const anchorRows = primaryState?.rows.slice(0, MAX_ROWS) ?? [];
  const stateMap = new Map(results.map((item) => [item.id, item]));

  const renderColumn = (stateId) => {
    const stateData = stateMap.get(stateId);
    const maxValue =
      stateData?.rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;

    return (
      <div className="space-y-3">
        {anchorRows.map((row) => {
          const match = stateData?.rows.find((item) => item.code === row.code);
          const value = match?.value ?? 0;
          return (
            <div key={`${stateId}-${row.code}`} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zb-ink-muted">
                  {formatNumber(value)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-zb-blue"
                  style={{ width: `${(value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
            Industry
          </p>
          <div className="rounded-zb-md border border-zb-border bg-zb-surface px-3 py-2 text-xs text-zb-ink-muted">
            Based on {primaryState?.state ?? "selected"} rankings
          </div>
          <div className="space-y-3 pt-1">
            {anchorRows.map((row) => (
              <div key={row.code} className="text-xs">
                {row.label}
              </div>
            ))}
          </div>
        </div>

        {stateIds.map((stateId, index) => {
          const current = stateOptions.find((option) => option.id === stateId);
          const available = stateOptions.filter(
            (option) =>
              option.id === stateId || !stateIds.includes(option.id)
          );

          return (
            <div key={stateId} className="space-y-2">
              <Select
                value={stateId}
                onChange={(event) => setStateAtIndex(index, event.target.value)}
              >
                {available.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-zb-ink-muted">
                {current?.label ?? "State"}
              </p>
              {status === "loading" && (
                <p className="text-xs text-zb-ink-muted">
                  Loading data...
                </p>
              )}
              {status === "success" && renderColumn(stateId)}
            </div>
          );
        })}
      </div>

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (Nonemployer Statistics, {NONEMP_YEARS[0]})
      </p>
    </Card>
  );
}

export default Popular;
