import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NESD_YEAR } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const formatNumber = (value) => Number(value).toLocaleString();

const filterTotal = (row) => row.label.toLowerCase() !== "total";

function Demographics({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [sexRows, setSexRows] = useState([]);
  const [raceRows, setRaceRows] = useState([]);
  const [ethRows, setEthRows] = useState([]);

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const base = DATASETS.nesd.getBase(NESD_YEAR);
        const geoParams = { ...getGeoParams(geo), NAICS2022: "00" };

        const sexUrl = buildUrl(base, {
          get: [
            DATASETS.nesd.variables.sex,
            DATASETS.nesd.variables.sexLabel,
            DATASETS.nesd.variables.firms,
          ],
          ...geoParams,
        });

        const raceUrl = buildUrl(base, {
          get: [
            DATASETS.nesd.variables.race,
            DATASETS.nesd.variables.raceLabel,
            DATASETS.nesd.variables.firms,
          ],
          ...geoParams,
        });

        const ethUrl = buildUrl(base, {
          get: [
            DATASETS.nesd.variables.ethnicity,
            DATASETS.nesd.variables.ethnicityLabel,
            DATASETS.nesd.variables.firms,
          ],
          ...geoParams,
        });

        const [sexData, raceData, ethData] = await Promise.all([
          cachedFetch(sexUrl, () => fetchJson(sexUrl)),
          cachedFetch(raceUrl, () => fetchJson(raceUrl)),
          cachedFetch(ethUrl, () => fetchJson(ethUrl)),
        ]);

        const parseRows = (data) =>
          data
            .slice(1)
            .map((row) => ({
              code: row[0],
              label: row[1],
              value: Number(row[2]),
            }))
            .filter(filterTotal);

        if (!isActive) return;
        setSexRows(parseRows(sexData));
        setRaceRows(
          parseRows(raceData)
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
        );
        setEthRows(
          parseRows(ethData)
            .sort((a, b) => b.value - a.value)
            .slice(0, 4)
        );
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
  }, [geo]);

  const sexTotal = sexRows.reduce((sum, row) => sum + row.value, 0) || 1;
  const sexColors = ["bg-zb-green", "bg-zb-blue", "bg-zb-surface-strong"];
  const raceMax = raceRows.reduce((max, row) => Math.max(max, row.value), 0) || 1;
  const ethMax = ethRows.reduce((max, row) => Math.max(max, row.value), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Who's Starting Nonemployer Businesses
        </h2>
        <p className="text-sm text-zb-ink-muted">
          Owner demographics for nonemployer firms in {geoLabel}.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">
          Loading demographic data...
        </p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-zb-ink">
              Owners by sex (segmented share)
            </p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-zb-subtle">
              {sexRows.map((row, index) => (
                <div
                  key={row.code}
                  className={sexColors[index % sexColors.length]}
                  style={{ width: `${(row.value / sexTotal) * 100}%` }}
                />
              ))}
            </div>
            <div className="overflow-hidden rounded-zb-md border border-zb-border">
              <table className="w-full text-sm">
                <thead className="bg-zb-surface-strong text-left text-zb-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Firms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zb-border">
                  {sexRows.map((row) => (
                    <tr key={row.code} className="odd:bg-zb-surface">
                      <td className="px-4 py-3">{row.label}</td>
                      <td className="px-4 py-3">{formatNumber(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-zb-ink">
                Owners by race
              </p>
              <div className="space-y-2">
                {raceRows.map((row) => (
                  <div key={row.code} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="text-zb-ink-muted">
                        {formatNumber(row.value)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zb-subtle">
                      <div
                        className="h-2 rounded-full bg-zb-green"
                        style={{
                          width: `${(row.value / raceMax) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-zb-ink">
                Owners by ethnicity
              </p>
              <div className="space-y-2">
                {ethRows.map((row) => (
                  <div key={row.code} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="text-zb-ink-muted">
                        {formatNumber(row.value)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zb-subtle">
                      <div
                        className="h-2 rounded-full bg-zb-blue"
                        style={{
                          width: `${(row.value / ethMax) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (NES-D, {NESD_YEAR})
      </p>
    </Card>
  );
}

export default Demographics;
