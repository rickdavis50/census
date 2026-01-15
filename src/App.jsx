import { useEffect, useState } from "react";

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
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-semibold">
          U.S. Population (Last 3 Years)
        </h1>

        {status === "loading" && <p className="text-sm">Loading...</p>}

        {status === "error" && (
          <p className="text-sm text-red-700">Error: {error}</p>
        )}

        {status === "success" && (
          <table className="w-full border border-black text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="p-2 text-left">Year</th>
                <th className="p-2 text-left">Population</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year} className="border-b border-black">
                  <td className="p-2">{row.year}</td>
                  <td className="p-2">{Number(row.population).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
