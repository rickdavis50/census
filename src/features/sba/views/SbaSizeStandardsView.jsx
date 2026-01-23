import { useEffect, useMemo, useState } from "react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import SbaBarChart, { SbaChartSkeleton } from "../SbaBarChart";
import { fetchSbaSizeStandards } from "../adapters/sbaSizeStandards";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatNumber,
} from "../utils";

const metricButtonClass = (active) =>
  active
    ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
    : "border-zb-border text-zb-ink-muted";

function SbaSizeStandardsView() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState("employees");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const result = await fetchSbaSizeStandards({
          forceRefresh: refreshIndex > 0,
        });
        if (!isActive) return;
        setData(result);
        if (result.hasEmployees) {
          setMetric("employees");
        } else if (result.hasReceipts) {
          setMetric("receipts");
        }
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
    return data.rows
      .map((row) => ({
        label: row.label,
        value: metric === "employees" ? row.employees : row.receipts,
      }))
      .filter((row) => row.value !== null && row.value !== undefined);
  }, [data, metric]);

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">SBA Size Standards — By NAICS</h2>
        <p className="text-sm text-zb-ink-muted">
          Maximum size standards by NAICS sector.
        </p>
        <p className="text-xs text-zb-ink-muted">
          Uses SBA size standards published via SBA Open Data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
        <span className="uppercase tracking-[0.2em]">Measure</span>
        <Button
          size="sm"
          variant="secondary"
          className={metricButtonClass(metric === "employees")}
          onClick={() => setMetric("employees")}
          disabled={!data?.hasEmployees}
        >
          Employees
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={metricButtonClass(metric === "receipts")}
          onClick={() => setMetric("receipts")}
          disabled={!data?.hasReceipts}
        >
          Receipts ($)
        </Button>
        {data && <span>Sectors: {formatNumber(chartData.length)}</span>}
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
          title={`Size Standards (${metric === "employees" ? "Employees" : "Receipts"})`}
          data={chartData}
          valueFormatter={
            metric === "employees" ? formatCompactNumber : formatCompactCurrency
          }
          sort="none"
        />
      )}

      <div className="text-xs text-zb-ink-muted">
        Source: SBA Open Data (data.sba.gov)
      </div>
    </Card>
  );
}

export default SbaSizeStandardsView;
