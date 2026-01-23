import { useEffect, useMemo, useState } from "react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import SbaBarChart, { SbaChartSkeleton } from "../SbaBarChart";
import { fetchSba7aVolume } from "../adapters/sba7aVolume";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatNumber,
} from "../utils";

const formatMonthLabel = (year, month) => {
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const getRangeLabel = (buckets, granularity) => {
  if (!buckets.length) return "";
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (granularity === "month") {
    return `${formatMonthLabel(first.year, first.month)} – ${formatMonthLabel(
      last.year,
      last.month
    )}`;
  }
  return `${first.year} – ${last.year}`;
};

const metricButtonClass = (active) =>
  active
    ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
    : "border-zb-border text-zb-ink-muted";

function Sba7aVolumeView() {
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
        const result = await fetchSba7aVolume({
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
    return data.buckets.map((bucket) => ({
      label:
        data.granularity === "month"
          ? formatMonthLabel(bucket.year, bucket.month)
          : String(bucket.year),
      value: metric === "amount" ? bucket.total : bucket.count,
    }));
  }, [data, metric]);

  const rangeLabel = useMemo(() => {
    if (!data) return "";
    return getRangeLabel(data.buckets, data.granularity);
  }, [data]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">SBA 7(a) Loans — Volume</h2>
        <p className="text-sm text-zb-ink-muted">
          Loan approvals over time • {data?.granularity === "month" ? "Monthly" : "Yearly"}
        </p>
        <p className="text-xs text-zb-ink-muted">
          Tracks SBA 7(a) approvals using SBA Open Data resources.
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
        {rangeLabel && <span>Range: {rangeLabel}</span>}
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
          title={`Approvals (${metric === "amount" ? "Total $" : "Loan Count"})`}
          data={chartData}
          sort="none"
          valueFormatter={
            metric === "amount" ? formatCompactCurrency : formatCompactNumber
          }
        />
      )}

      <div className="flex items-center justify-between text-xs text-zb-ink-muted">
        <span>Source: SBA Open Data (data.sba.gov)</span>
        {status === "success" && data && (
          <span>
            Total periods: {formatNumber(chartData.length)}
          </span>
        )}
      </div>
    </Card>
  );
}

export default Sba7aVolumeView;
