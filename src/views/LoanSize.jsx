import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fetchSbaLoanSizeByNaics } from "../lib/sba";

const formatCurrency = (value) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatCompactCurrency = (value) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

function LoanSize() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchSbaLoanSizeByNaics({
          forceRefresh: refreshIndex > 0,
        });
        if (!isActive) return;
        setRows(data.rows.slice(0, 15));
        setYear(String(data.year));
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
  }, [refreshIndex]);

  const maxAvg = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.avgAmount), 0) || 1,
    [rows]
  );

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Average SBA 7(a) Loan Size by Industry
        </h2>
        <p className="text-sm text-zb-ink-muted">
          2-digit NAICS sectors • United States • Latest available full year
        </p>
        <p className="text-xs text-zb-ink-muted">
          Higher average 7(a) loan sizes can indicate more capital-intensive
          industries.
        </p>
      </div>

      <div className="min-h-[520px] space-y-4">
        {status === "loading" && (
          <p className="text-sm text-zb-ink-muted">
            Loading SBA loan size data...
          </p>
        )}

        {status === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
            <span>Error loading data: {error}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRefreshIndex((prev) => prev + 1)}
            >
              Retry
            </Button>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            {rows.map((row) => {
              const tooltip = `${row.label}\nAverage loan amount: ${formatCurrency(
                row.avgAmount
              )}\nLoans: ${row.count.toLocaleString()}`;

              return (
                <div
                  key={row.sector}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate" title={row.label}>
                      {row.label}
                    </p>
                    <p className="text-xs text-zb-ink-muted">
                      {row.count.toLocaleString()} loans
                    </p>
                  </div>
                  <div className="space-y-2" title={tooltip}>
                    <div className="flex items-center justify-between text-xs text-zb-ink-muted">
                      <span>{formatCompactCurrency(row.avgAmount)}</span>
                      <span>Avg loan</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zb-subtle">
                      <div
                        className="h-2 rounded-full bg-dash-accent-1"
                        style={{ width: `${(row.avgAmount / maxAvg) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {status === "success" && (
        <div className="space-y-1">
          <p className="text-xs text-zb-ink-muted">Year: {year}</p>
          <p className="text-xs text-zb-ink-muted">
            Source: U.S. Small Business Administration (SBA) API — 7(a) loan
            data
          </p>
        </div>
      )}
    </Card>
  );
}

export default LoanSize;
