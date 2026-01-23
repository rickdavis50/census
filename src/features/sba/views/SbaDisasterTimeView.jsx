import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SbaBarChart, { SbaChartSkeleton } from "../SbaBarChart";
import { fetchSbaDisasterTime } from "../adapters/sbaDisasterTime";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatNumber,
} from "../utils";

const groupingButtonClass = (active) =>
  active
    ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
    : "border-zb-border text-zb-ink-muted";

function SbaDisasterTimeView() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [grouping, setGrouping] = useState("total");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const result = await fetchSbaDisasterTime({
          forceRefresh: refreshIndex > 0,
        });
        if (!isActive) return;
        setData(result);
        setStatus("success");
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : "Failed to load data.";
        setError(message);
        setStatus(
          message.includes("SBA dataset not found") ? "empty" : "error"
        );
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [refreshIndex]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const series = grouping === "top" ? data.topStatesSeries : data.totalSeries;
    return series.map((entry) => ({
      label: String(entry.year),
      value: data.usesCount ? entry.count : entry.total,
    }));
  }, [data, grouping]);

  const valueFormatter = useMemo(() => {
    if (data?.usesCount) return formatCompactNumber;
    return formatCompactCurrency;
  }, [data]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">SBA Disaster Loans — Over Time</h2>
        <p className="text-sm text-zb-ink-muted">
          Yearly disaster loan approvals and recovery funding.
        </p>
        <p className="text-xs text-zb-ink-muted">
          Toggle between nationwide totals and top 10 disaster states.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
        <span className="uppercase tracking-[0.2em]">Grouping</span>
        <Button
          size="sm"
          variant="secondary"
          className={groupingButtonClass(grouping === "total")}
          onClick={() => setGrouping("total")}
        >
          US Total
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={groupingButtonClass(grouping === "top")}
          onClick={() => setGrouping("top")}
          disabled={!data?.hasStateData}
        >
          Top 10 States
        </Button>
        {data && (
          <span>
            Metric: {data.usesCount ? "Loan Count" : "Total $"}
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="min-h-[320px]">
          <SbaChartSkeleton />
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>SBA dataset not found via open data search.</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRefreshIndex((prev) => prev + 1)}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Error loading data: {error}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRefreshIndex((prev) => prev + 1)}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {status === "success" && data && (
        <SbaBarChart
          title={
            grouping === "top"
              ? "Top 10 Disaster States (Combined)"
              : "US Total"
          }
          data={chartData}
          sort="none"
          valueFormatter={valueFormatter}
        />
      )}

      <div className="flex items-center justify-between text-xs text-zb-ink-muted">
        <span>Source: SBA Open Data (data.sba.gov)</span>
        {status === "success" && data && (
          <span>Years: {formatNumber(chartData.length)}</span>
        )}
      </div>
    </Card>
  );
}

export default SbaDisasterTimeView;
