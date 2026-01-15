import { useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { fetchAcsSeries } from "../lib/acsHelpers";
import { ACS_YEARS, VIEW_CONFIGS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const formatPercent = (value) => `${value.toFixed(1)}%`;

function Workstyle({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [series, setSeries] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [survey, setSurvey] = useState("");

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);
  const config = VIEW_CONFIGS.workstyle;

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const { results, label, survey } = await fetchAcsSeries({
          years: ACS_YEARS,
          variables: [
            config.variables.workersTotal,
            config.variables.workedFromHome,
          ],
          geoParams: getGeoParams(geo),
        });

        const rows = results.map((item) => {
          const row = item.data[1];
          const total = Number(row?.[1] ?? 0);
          const remote = Number(row?.[2] ?? 0);
          const share = total ? (remote / total) * 100 : 0;
          return { year: item.year, share };
        });

        const latestYear = ACS_YEARS[0];
        const baseUrl =
          survey === "acs1"
            ? `https://api.census.gov/data/${latestYear}/acs/acs1`
            : `https://api.census.gov/data/${latestYear}/acs/acs5`;

        const baselineUrl = buildUrl(baseUrl, {
          get: [
            "NAME",
            config.variables.workersTotal,
            config.variables.workedFromHome,
          ],
          for: "us:1",
        });

        const baselineData = await cachedFetch(baselineUrl, () =>
          fetchJson(baselineUrl)
        );
        const baselineRow = baselineData[1];
        const baselineTotal = Number(baselineRow?.[1] ?? 0);
        const baselineRemote = Number(baselineRow?.[2] ?? 0);
        const baselineShare = baselineTotal
          ? (baselineRemote / baselineTotal) * 100
          : 0;

        if (!isActive) return;
        setSeries(rows);
        setBaseline(baselineShare);
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
  }, [geo, config.variables.workersTotal, config.variables.workedFromHome]);

  const latest = series[0]?.share ?? 0;
  const baselineLabel =
    baseline === null
      ? ""
      : latest >= baseline
      ? "Above national"
      : "Below national";

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Remote/Commute Landscape</h2>
          <p className="text-sm text-zb-ink-muted">
            Share of workers who work from home in {geoLabel}.
          </p>
        </div>
        {baseline !== null && <Badge>{baselineLabel}</Badge>}
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">
          Loading workstyle data...
        </p>
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
                <th className="px-4 py-3 font-medium">Work from home</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zb-border">
              {series.map((row) => (
                <tr key={row.year} className="odd:bg-zb-surface">
                  <td className="px-4 py-3">{row.year}</td>
                  <td className="px-4 py-3">{formatPercent(row.share)}</td>
                </tr>
              ))}
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

export default Workstyle;
