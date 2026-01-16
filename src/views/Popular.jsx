import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import DownloadButton from "../components/DownloadButton";
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

  const getStateMetrics = (stateId) => {
    const stateData = stateMap.get(stateId);
    const maxValue =
      stateData?.rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;
    const metrics = new Map(
      stateData?.rows.map((row) => [row.code, row.value]) ?? []
    );
    return { maxValue, metrics };
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
      <div className="flex items-center justify-end">
        <DownloadButton
          filename="popular-head-to-head.csv"
          headers={[
            "Industry",
            ...stateIds.map(
              (stateId) =>
                stateOptions.find((option) => option.id === stateId)?.label ||
                stateId
            ),
          ]}
          rows={anchorRows.map((row) => [
            row.label,
            ...stateIds.map((stateId) => {
              const stateData = stateMap.get(stateId);
              const match = stateData?.rows.find(
                (item) => item.code === row.code
              );
              return match?.value ?? 0;
            }),
          ])}
          disabled={status !== "success"}
        />
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-end gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
              Industry
            </p>
          </div>
          {stateIds.map((stateId, index) => {
            const current = stateOptions.find((option) => option.id === stateId);
            const available = stateOptions.filter(
              (option) =>
                option.id === stateId || !stateIds.includes(option.id)
            );

            return (
              <div key={`select-${stateId}`} className="space-y-2">
                <Select
                  value={stateId}
                  onChange={(event) =>
                    setStateAtIndex(index, event.target.value)
                  }
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
              </div>
            );
          })}
        </div>

        {status === "loading" && (
          <p className="text-sm text-zb-ink-muted">Loading data...</p>
        )}

        {status === "success" && (
          <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-4">
            {anchorRows.map((row) => (
              <div key={row.code} className="contents">
                <div className="text-xs">{row.label}</div>
                {stateIds.map((stateId) => {
                  const { maxValue, metrics } = getStateMetrics(stateId);
                  const value = metrics.get(row.code) ?? 0;
                  return (
                    <div key={`${stateId}-${row.code}`} className="space-y-2">
                      <div className="text-xs text-zb-ink-muted">
                        {formatNumber(value)}
                      </div>
                      <div className="h-2 w-full rounded-full bg-zb-subtle">
                        <div
                          className="h-2 rounded-full bg-dash-accent-1"
                          style={{ width: `${(value / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
