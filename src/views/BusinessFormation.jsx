import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Select from "../components/Select";
import StatRow from "../components/StatRow";
import { fetchBfsMonthly, fetchBfsWeeklyState } from "../lib/bfs";

const MONTHLY_METRICS = [
  { id: "BA_BA", label: "Business Applications (BA)" },
  { id: "BA_HBA", label: "High-Propensity Applications (HBA)" },
  { id: "BA_WBA", label: "Applications with Planned Wages (WBA)" },
  { id: "BA_CBA", label: "Corporate Applications (CBA)" },
  { id: "BF_PBF4Q", label: "Projected Formations (PBF4Q)" },
];

const WEEKLY_METRICS = [
  { id: "BA_NSA", label: "Business Applications (BA_NSA)" },
  { id: "HBA_NSA", label: "High-Propensity Applications (HBA_NSA)" },
  { id: "WBA_NSA", label: "Planned Wages Applications (WBA_NSA)" },
  { id: "CBA_NSA", label: "Corporate Applications (CBA_NSA)" },
];

const MONTH_RANGE_OPTIONS = [
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
  { value: "60", label: "Last 60 months" },
];

const WEEK_RANGE_OPTIONS = [
  { value: "26", label: "Last 26 weeks" },
  { value: "52", label: "Last 52 weeks" },
  { value: "104", label: "Last 104 weeks" },
];

const FLAG_LABELS = {
  D: "withheld",
  S: "low quality",
  NA: "not available",
};

const formatNumber = (value) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });

const formatDelta = (value) =>
  `${value >= 0 ? "+" : ""}${formatNumber(value)}`;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getDefaultGeo = (options, fallback) => {
  if (!options.length) return fallback;
  if (fallback && options.some((option) => option.value === fallback)) {
    return fallback;
  }
  const us = options.find((option) => option.value === "US");
  return us?.value ?? options[0].value;
};

const buildMonthlyGeoOptions = (geoLabels) => {
  const options = Array.from(geoLabels.entries()).map(([value, label]) => ({
    value,
    label: label || value,
  }));
  options.sort((a, b) => a.label.localeCompare(b.label));
  const usIndex = options.findIndex((option) => option.value === "US");
  if (usIndex > 0) {
    const [us] = options.splice(usIndex, 1);
    options.unshift(us);
  }
  return options;
};

const buildWeeklyGeoOptions = (geos) =>
  geos
    .map((geo) => ({ value: geo, label: geo }))
    .sort((a, b) => a.label.localeCompare(b.label));

function BusinessFormation() {
  const [frequency, setFrequency] = useState("monthly");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [monthlyData, setMonthlyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [metric, setMetric] = useState(MONTHLY_METRICS[0].id);
  const [geo, setGeo] = useState("US");
  const [range, setRange] = useState("24");
  const [hovered, setHovered] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        if (frequency === "monthly") {
          const data = monthlyData || (await fetchBfsMonthly());
          if (!isActive) return;
          setMonthlyData(data);
        } else {
          const data = weeklyData || (await fetchBfsWeeklyState());
          if (!isActive) return;
          setWeeklyData(data);
        }
        setStatus("success");
      } catch (err) {
        if (!isActive) return;
        console.error("BFS parse error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load BFS data."
        );
        setStatus("error");
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [frequency, monthlyData, weeklyData, refreshIndex]);

  useEffect(() => {
    if (frequency === "monthly") {
      setMetric(MONTHLY_METRICS[0].id);
      setRange("24");
      if (monthlyData?.geoLabels) {
        const options = buildMonthlyGeoOptions(monthlyData.geoLabels);
        setGeo((current) => getDefaultGeo(options, current));
      }
    } else {
      setMetric(WEEKLY_METRICS[0].id);
      setRange("104");
      if (weeklyData?.geos) {
        const options = buildWeeklyGeoOptions(weeklyData.geos);
        setGeo((current) => getDefaultGeo(options, current));
      }
    }
  }, [frequency, monthlyData, weeklyData]);

  const geoOptions = useMemo(() => {
    if (frequency === "monthly" && monthlyData?.geoLabels) {
      return buildMonthlyGeoOptions(monthlyData.geoLabels);
    }
    if (frequency === "weekly" && weeklyData?.geos) {
      return buildWeeklyGeoOptions(weeklyData.geos);
    }
    return [];
  }, [frequency, monthlyData, weeklyData]);

  const seriesOptions =
    frequency === "monthly" ? MONTHLY_METRICS : WEEKLY_METRICS;

  const filteredSeries = useMemo(() => {
    const data =
      frequency === "monthly" ? monthlyData?.data : weeklyData?.data;
    if (!data) return [];

    let rows = data.filter(
      (item) => item.series === metric && item.geo === geo
    );

    if (frequency === "monthly" && monthlyData) {
      const { defaultSa, defaultIndustry } = monthlyData;
      if (defaultSa) {
        rows = rows.filter((item) => item.sa === defaultSa);
      }
      if (defaultIndustry) {
        rows = rows.filter((item) => item.industry === defaultIndustry);
      }
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const limit = Number(range);
    return limit && rows.length > limit ? rows.slice(-limit) : rows;
  }, [frequency, monthlyData, weeklyData, metric, geo, range]);

  const chartPoints = useMemo(() => {
    if (!filteredSeries.length) return [];
    const dates = filteredSeries.map((item) => Date.parse(item.date));
    const values = filteredSeries
      .map((item) => item.value)
      .filter((value) => value !== null);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 1;
    const rangeDate = maxDate === minDate ? 1 : maxDate - minDate;
    const rangeValue = maxValue === minValue ? 1 : maxValue - minValue;
    const width = 640;
    const height = 260;
    const padding = 28;

    return filteredSeries.map((item) => {
      const time = Date.parse(item.date);
      const x =
        padding +
        ((time - minDate) / rangeDate) * (width - padding * 2);
      const value = item.value;
      const yValue =
        value === null
          ? height - padding
          : height -
            padding -
            ((value - minValue) / rangeValue) * (height - padding * 2);
      return {
        ...item,
        x,
        y: yValue,
        width,
        height,
        padding,
      };
    });
  }, [filteredSeries]);

  const linePath = useMemo(() => {
    const segments = chartPoints.filter((point) => point.value !== null);
    if (!segments.length) return "";
    return segments
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      )
      .join(" ");
  }, [chartPoints]);

  const kpi = useMemo(() => {
    const series = filteredSeries.filter((item) => item.value !== null);
    if (!series.length) return null;
    const latest = series[series.length - 1];
    const previous = series[series.length - 2];
    const yearBackIndex =
      frequency === "monthly" ? series.length - 13 : series.length - 53;
    const yearBack = yearBackIndex >= 0 ? series[yearBackIndex] : null;

    return {
      latest,
      change: previous ? latest.value - previous.value : null,
      yearChange: yearBack ? latest.value - yearBack.value : null,
    };
  }, [filteredSeries, frequency]);

  const handleHover = (event) => {
    if (!chartPoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const scaledX = (x / rect.width) * 640;
    const nearest = chartPoints.reduce((closest, point) => {
      if (!closest) return point;
      return Math.abs(point.x - scaledX) < Math.abs(closest.x - scaledX)
        ? point
        : closest;
    }, null);
    setHovered(nearest);
  };

  const activeMetricLabel =
    seriesOptions.find((option) => option.id === metric)?.label ?? metric;

  const tooltip = hovered
    ? {
        date: formatDate(hovered.date),
        value:
          hovered.value === null ? "Not available" : formatNumber(hovered.value),
        flags: hovered.flags?.length
          ? hovered.flags
              .map((flag) => FLAG_LABELS[flag] || flag)
              .join(", ")
          : "",
      }
    : null;

  const isFormatError = error
    ? /format|header|column|dataset/.test(error.toLowerCase())
    : false;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Business Formation (BFS) Signals
        </h2>
        <p className="text-sm text-zb-ink-muted">
          Census BFS data is derived from IRS EIN (SS-4) applications.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-zb-md border border-zb-border bg-zb-surface p-1">
          <Button
            size="sm"
            variant={frequency === "monthly" ? "primary" : "secondary"}
            onClick={() => setFrequency("monthly")}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={frequency === "weekly" ? "primary" : "secondary"}
            onClick={() => setFrequency("weekly")}
          >
            Weekly
          </Button>
        </div>

        <div className="min-w-[220px] flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
            Geography
          </p>
          <Select
            value={geo}
            onChange={(event) => setGeo(event.target.value)}
            className="mt-2"
          >
            {geoOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[220px] flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
            Metric
          </p>
          <Select
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
            className="mt-2"
          >
            {seriesOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[200px] flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
            Date Range
          </p>
          <Select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="mt-2"
          >
            {(frequency === "monthly"
              ? MONTH_RANGE_OPTIONS
              : WEEK_RANGE_OPTIONS
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading BFS data...</p>
      )}

      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          <span>
            {isFormatError
              ? "BFS data format changed."
              : "Failed to load BFS data."}
          </span>
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
          <div className="grid gap-2 rounded-zb-sm border border-zb-border bg-zb-subtle p-4 sm:grid-cols-3">
            <StatRow
              label="Latest value"
              value={
                kpi?.latest?.value === undefined
                  ? "—"
                  : formatNumber(kpi.latest.value)
              }
            />
            <StatRow
              label="1-period change"
              value={
                kpi?.change === null || kpi?.change === undefined
                  ? "—"
                  : formatDelta(kpi.change)
              }
            />
            <StatRow
              label="1-year change"
              value={
                kpi?.yearChange === null || kpi?.yearChange === undefined
                  ? "—"
                  : formatDelta(kpi.yearChange)
              }
            />
          </div>

          <div className="relative rounded-zb-sm border border-zb-border bg-zb-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zb-ink-muted">
              {activeMetricLabel}
            </p>
            <div className="mt-3 h-[280px]">
              <svg
                viewBox="0 0 640 260"
                className="h-full w-full"
                onMouseMove={handleHover}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x="0"
                  y="0"
                  width="640"
                  height="260"
                  fill="transparent"
                />
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--zb-green)"
                    strokeWidth="2"
                  />
                )}
                {hovered && (
                  <circle
                    cx={hovered.x}
                    cy={hovered.y}
                    r="4"
                    fill="var(--zb-blue)"
                  />
                )}
              </svg>
            </div>

            {tooltip && (
              <div
                className="pointer-events-none absolute top-3 rounded-zb-sm border border-zb-border bg-zb-bg px-3 py-2 text-xs text-zb-ink"
                style={{
                  left: `${(hovered.x / 640) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="font-semibold">{tooltip.date}</p>
                <p>{tooltip.value}</p>
                {tooltip.flags && (
                  <p className="text-zb-ink-muted">
                    Flagged: {tooltip.flags}
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-xs text-zb-ink-muted">
              <span>
                {filteredSeries[0]?.date
                  ? formatDate(filteredSeries[0].date)
                  : "—"}
              </span>
              <span>
                {filteredSeries[filteredSeries.length - 1]?.date
                  ? formatDate(filteredSeries[filteredSeries.length - 1].date)
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (Business Formation Statistics)
      </p>
    </Card>
  );
}

export default BusinessFormation;
