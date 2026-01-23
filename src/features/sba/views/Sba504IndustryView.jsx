import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SbaBarChart, { SbaChartSkeleton } from "../SbaBarChart";
import { fetchSba504Industry } from "../adapters/sba504Industry";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatNumber,
} from "../utils";

const metricButtonClass = (active) =>
  active
    ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
    : "border-zb-border text-zb-ink-muted";

function Sba504IndustryView() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState("amount");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const result = await fetchSba504Industry({
          forceRefresh: refreshIndex > 0,
        });
        if (!isActive) return;
        setData(result);
        setMetric(result.hasAmount ? "amount" : "count");
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
    return data.rows.map((row) => ({
      label: row.label,
      value: metric === "amount" ? row.total : row.count,
    }));
  }, [data, metric]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">SBA 504 Loans — By Industry</h2>
        <p className="text-sm text-zb-ink-muted">
          Industries grouped by NAICS sector or SBA industry labels.
        </p>
        <p className="text-xs text-zb-ink-muted">
          Compares SBA 504 activity across major industries.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
        <span className="uppercase tracking-[0.2em]">Metric</span>
        <Button
          size="sm"
          variant="secondary"
          className={metricButtonClass(metric === "amount")}
          onClick={() => setMetric("amount")}
          disabled={!data?.hasAmount}
        >
          Total $
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={metricButtonClass(metric === "count")}
          onClick={() => setMetric("count")}
        >
          Loan Count
        </Button>
        {data && <span>Industries: {formatNumber(chartData.length)}</span>}
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
          title={`Top Industries (${metric === "amount" ? "Total $" : "Loan Count"})`}
          data={chartData}
          valueFormatter={
            metric === "amount" ? formatCompactCurrency : formatCompactNumber
          }
        />
      )}

      <div className="text-xs text-zb-ink-muted">
        Source: SBA Open Data (data.sba.gov)
      </div>
    </Card>
  );
}

export default Sba504IndustryView;
