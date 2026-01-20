import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fetchNonemployerSectors } from "../lib/nonemp";

const formatNumber = (value) => Number(value).toLocaleString("en-US");

const formatCompactNumber = (value) =>
  Number(value).toLocaleString("en-US", {
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
        const data = await fetchNonemployerSectors({
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

  const maxCount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.count), 0) || 1,
    [rows]
  );

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Nonemployer Establishments by Industry
        </h2>
        <p className="text-sm text-zb-ink-muted">
          2-digit NAICS sectors • United States • Latest available year
        </p>
        <p className="text-xs text-zb-ink-muted">
          Shows where solo businesses cluster across the U.S. economy.
        </p>
      </div>

      <div className="min-h-[520px] space-y-4">
        {status === "loading" && (
          <p className="text-sm text-zb-ink-muted">
            Loading nonemployer data...
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
              const tooltip = `${row.label}\nNonemployer establishments: ${formatNumber(
                row.count
              )}`;

              return (
                <div
                  key={row.code}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate" title={row.label}>
                      {row.label}
                    </p>
                    <p className="text-xs text-zb-ink-muted">
                      {formatNumber(row.count)} establishments
                    </p>
                  </div>
                  <div className="space-y-2" title={tooltip}>
                    <div className="flex items-center justify-between text-xs text-zb-ink-muted">
                      <span>{formatCompactNumber(row.count)}</span>
                      <span>Establishments</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zb-subtle">
                      <div
                        className="h-2 rounded-full bg-dash-accent-1"
                        style={{ width: `${(row.count / maxCount) * 100}%` }}
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
            Source: U.S. Census Bureau (Nonemployer Statistics)
          </p>
        </div>
      )}
    </Card>
  );
}

export default LoanSize;
