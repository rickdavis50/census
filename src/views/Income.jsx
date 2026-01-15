import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import { fetchAcsSeries } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";
import { fetchStateOptions } from "../lib/stateOptions";

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
  const config = VIEW_CONFIGS.income;

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
        const { results, label } = await fetchAcsSeries({
          years: ACS_YEARS,
          variables: [config.variables.medianIncome],
          geoParams: getGeoParams(selectedGeo),
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
  }, [selectedGeo, config.variables.medianIncome]);

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
                const prevValue = series[index + 1]?.value || 0;
                const deltaPercent = prevValue
                  ? (delta / prevValue) * 100
                  : 0;
                return (
                  <tr key={row.year} className="odd:bg-zb-surface">
                    <td className="px-4 py-3">{row.year}</td>
                    <td className="px-4 py-3">{formatCurrency(row.value)}</td>
                    <td className="px-4 py-3">
                      {delta === null
                        ? "—"
                        : `${formatCurrency(delta)} (${deltaPercent.toFixed(
                            1
                          )}%)`}
                      {delta !== null && (
                        <div className="mt-2 h-1 w-full rounded-full bg-zb-subtle">
                          <div
                            className="h-1 rounded-full bg-dash-accent-1"
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
