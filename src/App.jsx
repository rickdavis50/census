import { useEffect, useState } from "react";
import Badge from "./components/Badge";
import Card from "./components/Card";
import StatRow from "./components/StatRow";

const YEARS = [2023, 2022, 2021];

function App() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");

      try {
        const results = await Promise.all(
          YEARS.map(async (year) => {
            const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,B01001_001E&for=us:1`;
            const response = await fetch(url);

            if (!response.ok) {
              throw new Error(`Request failed for ${year}`);
            }

            const data = await response.json();
            const row = data[1];

            if (!row) {
              throw new Error(`No data for ${year}`);
            }

            return { year, population: row[1] };
          })
        );

        if (!isActive) return;
        setRows(results);
        setStatus("success");
      } catch (err) {
        if (!isActive) return;
        const message =
          err instanceof Error ? err.message : "Failed to load data.";
        setError(message);
        setStatus("error");
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zb-bg text-zb-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
              Census Explorer
            </p>
            <h1 className="text-2xl font-semibold">
              U.S. Population (Last 3 Years)
            </h1>
          </div>
          <Badge>Data: U.S. Census</Badge>
        </header>

        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <p className="text-sm text-zb-ink-muted">
              ACS 1-Year Estimates for total population, national level.
            </p>
            <div className="space-y-1">
              <StatRow label="Dataset" value="ACS 1-Year" />
              <StatRow label="Geography" value="United States" />
            </div>
          </div>

          {status === "loading" && (
            <p className="text-sm text-zb-ink-muted">Loading data...</p>
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
                    <th className="px-4 py-3 font-medium">Population</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zb-border">
                  {rows.map((row) => (
                    <tr key={row.year} className="odd:bg-zb-surface">
                      <td className="px-4 py-3">{row.year}</td>
                      <td className="px-4 py-3">
                        {Number(row.population).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default App;
