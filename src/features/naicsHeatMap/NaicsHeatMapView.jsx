import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Card from "../../components/Card";
import Button from "../../components/Button";
import {
  DEFAULT_NAICS,
  NAICS_OPTIONS,
  getNaicsLabel,
  loadStateCentroids,
  sanitizeNaics,
} from "./naicsHeatMapData";
import {
  getEstablishmentsByState,
  getLatestStateEstabSource,
  getPopulationByState,
  getPopYear,
} from "./censusZipData";

const EMPTY_GEOJSON = {
  type: "FeatureCollection",
  features: [],
};
const MIN_HEATMAP_ZOOM = 5;

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

const formatCompact = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const buildTooltipHtml = ({ stateName, naicsLabel, estab, pop, density }) => {
  const densityLine =
    pop && density ? `Density: ${formatNumber(density)} per 10k` : "Density: —";
  const popLine = pop ? `Population: ${formatNumber(pop)}` : "Population: —";

  return `
    <div style="font-size:12px;line-height:1.4">
      <strong>${stateName}</strong><br/>
      ${naicsLabel}<br/>
      Establishments: ${formatNumber(estab)}<br/>
      ${popLine}<br/>
      ${densityLine}
    </div>
  `;
};

const buildHeatmapPaint = (metricKey, maxValue) => ({
  "heatmap-weight": [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", metricKey], 0],
    0,
    0,
    maxValue || 1,
    1,
  ],
  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 10, 1.4],
  "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 10, 45],
  "heatmap-opacity": 0.85,
  "heatmap-color": [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "#33F28B",
    0.5,
    "#A8CFEA",
    1,
    "#EBF1FD",
  ],
});

const buildCirclePaint = (metricKey, maxValue) => ({
  "circle-color": "#EBF1FD",
  "circle-opacity": 0.5,
  "circle-radius": [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", metricKey], 0],
    0,
    3,
    maxValue || 1,
    8,
  ],
});

function NaicsHeatMapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const [centroids, setCentroids] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("density");
  const [naics, setNaics] = useState(DEFAULT_NAICS);
  const [customNaics, setCustomNaics] = useState("");
  const [yearInfo, setYearInfo] = useState(null);
  const [legend, setLegend] = useState({ min: null, max: null });
  const [stats, setStats] = useState({
    visible: 0,
    estabLoaded: 0,
    popLoaded: 0,
  });

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    let isActive = true;
    setStatus("loading");
    loadStateCentroids()
      .then((rows) => {
        if (!isActive) return;
        setCentroids(rows);
        setStatus("ready");
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load state data.");
        setStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const updateMapPaint = useCallback((metricKey, maxValue) => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("naics-heat")) {
      map.setPaintProperty(
        "naics-heat",
        "heatmap-weight",
        buildHeatmapPaint(metricKey, maxValue)["heatmap-weight"]
      );
    }
    if (map.getLayer("naics-circle")) {
      map.setPaintProperty(
        "naics-circle",
        "circle-radius",
        buildCirclePaint(metricKey, maxValue)["circle-radius"]
      );
    }
  }, []);

  const buildFeatures = useCallback(
    ({ states, estabMap, popMap, metricKey }) => {
      const features = [];
      let min = null;
      let max = null;
      let estabLoaded = 0;
      let popLoaded = 0;

      states.forEach((item) => {
        const estabEntry = estabMap.get(item.state);
        const popEntry = popMap?.get(item.state);
        const estab = estabEntry?.value ?? 0;
        const pop = popEntry?.value ?? 0;
        const density = pop ? (estab / pop) * 10000 : null;
        const value = metricKey === "density" ? density : estab;
        const stateName = item.name || estabEntry?.name || popEntry?.name || item.state;

        if (estab) estabLoaded += 1;
        if (pop) popLoaded += 1;

        if (value !== null) {
          min = min === null ? value : Math.min(min, value);
          max = max === null ? value : Math.max(max, value);
        }

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [item.lng, item.lat] },
          properties: {
            state: item.state,
            stateName,
            estab,
            pop: pop || null,
            density,
            metricValue: value ?? 0,
            naics,
            naicsLabel: getNaicsLabel(naics),
          },
        });
      });

      return {
        features,
        min,
        max,
        estabLoaded,
        popLoaded,
      };
    },
    [naics]
  );

  const applyGeoJson = useCallback((geojson, metricKey, maxValue) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("naics-zip");
    if (source) {
      source.setData(geojson);
    }
    updateMapPaint(metricKey, maxValue);
  }, [updateMapPaint]);

  const refreshData = useCallback(async () => {
    if (!mapRef.current || !centroids.length) return;
    const currentRequest = requestIdRef.current + 1;
    requestIdRef.current = currentRequest;

    const bounds = mapRef.current.getBounds();
    const visible = centroids.filter((item) =>
      bounds.contains([item.lng, item.lat])
    );

    setStats((prev) => ({ ...prev, visible: visible.length }));

    const { year, endpoint } = await getLatestStateEstabSource();
    setYearInfo({ year, endpoint });

    const estabMap = await getEstablishmentsByState({
      year,
      naics,
    });

    const popMap =
      metric === "density"
        ? await getPopulationByState()
        : null;

    if (requestIdRef.current !== currentRequest) return;

    const densityResult = buildFeatures({
      states: visible,
      estabMap,
      popMap,
      metricKey: "density",
    });
    const estabResult = buildFeatures({
      states: visible,
      estabMap,
      popMap,
      metricKey: "estab",
    });

    const usingDensity =
      metric === "density" && densityResult.popLoaded > 0;
    const result = usingDensity ? densityResult : estabResult;
    const metricKey = usingDensity ? "density" : "estab";

    applyGeoJson(
      { type: "FeatureCollection", features: result.features },
      metricKey,
      result.max
    );

    setLegend({ min: result.min, max: result.max });
    setStats({
      visible: visible.length,
      estabLoaded: result.estabLoaded,
      popLoaded: densityResult.popLoaded,
    });

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("NAICS map stats", {
        visible: visible.length,
        estabLoaded: result.estabLoaded,
        popLoaded: densityResult.popLoaded,
      });
    }
  }, [centroids, metric, naics, buildFeatures, applyGeoJson]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshData();
    }, 400);
  }, [refreshData]);

  useEffect(() => {
    if (!token) {
      setError("Missing Mapbox token (VITE_MAPBOX_TOKEN).");
      setStatus("error");
      return;
    }
    if (!mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98, 39],
      zoom: 3,
      minZoom: MIN_HEATMAP_ZOOM,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("naics-zip", {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });

      map.addLayer({
        id: "naics-heat",
        type: "heatmap",
        source: "naics-zip",
        paint: buildHeatmapPaint("density", 1),
      });

      map.addLayer({
        id: "naics-circle",
        type: "circle",
        source: "naics-zip",
        minzoom: 7,
        paint: buildCirclePaint("density", 1),
      });

      map.on("mousemove", "naics-circle", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { stateName, estab, pop, density, naicsLabel } = feature.properties;
        const html = buildTooltipHtml({
          stateName,
          naicsLabel,
          estab,
          pop,
          density,
        });

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
          });
        }
        popupRef.current.setLngLat(event.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "naics-circle", () => {
        popupRef.current?.remove();
      });

      scheduleRefresh();
    });

    map.on("moveend", scheduleRefresh);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, scheduleRefresh]);

  useEffect(() => {
    scheduleRefresh();
  }, [metric, naics, scheduleRefresh]);

  const effectiveNaicsLabel = useMemo(() => getNaicsLabel(naics), [naics]);
  const isCustomValid = customNaics.length >= 2 && customNaics.length <= 6;

  const metricLabel = metric === "density" ? "Density (per 10k)" : "Establishments";
  const densityPending = metric === "density" && stats.popLoaded === 0;
  const legendMin = legend.min ?? 0;
  const legendMax = legend.max ?? 0;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">NAICS Heat Map</h2>
        <p className="text-sm text-zb-ink-muted">
          State-level opportunity heat map for {effectiveNaicsLabel}.
        </p>
        <p className="text-xs text-zb-ink-muted">
          Green = opportunity (low density). Blue = saturated (high density).
        </p>
      </div>

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
        <span className="uppercase tracking-[0.2em]">NAICS</span>
        <select
          className="rounded-zb-sm border border-zb-border bg-zb-surface px-2 py-1 text-xs text-zb-ink"
          value={naics}
          onChange={(event) => setNaics(event.target.value)}
        >
          {NAICS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-zb-ink-muted">Custom:</span>
        <input
          className="w-28 rounded-zb-sm border border-zb-border bg-zb-surface px-2 py-1 text-xs text-zb-ink"
          value={customNaics}
          placeholder="2-6 digits"
          onChange={(event) => setCustomNaics(sanitizeNaics(event.target.value))}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (isCustomValid) {
              setNaics(customNaics);
            }
          }}
          disabled={!isCustomValid}
        >
          Apply
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
        <span className="uppercase tracking-[0.2em]">Metric</span>
        <Button
          size="sm"
          variant="secondary"
          className={
            metric === "density"
              ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
              : "border-zb-border text-zb-ink-muted"
          }
          onClick={() => setMetric("density")}
        >
          Density (per 10k)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={
            metric === "estab"
              ? "border-zb-blue/60 bg-zb-subtle text-zb-blue"
              : "border-zb-border text-zb-ink-muted"
          }
          onClick={() => setMetric("estab")}
        >
          Establishments
        </Button>
        {yearInfo && (
          <span>
            Year: {yearInfo.year} ({yearInfo.endpoint.toUpperCase()})
          </span>
        )}
      </div>

      <div className="rounded-zb-md border border-zb-border bg-zb-subtle">
        <div ref={mapContainerRef} className="h-[560px] w-full" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zb-ink-muted">
        <div className="space-y-2">
          <p className="uppercase tracking-[0.2em]">Legend</p>
          <div className="h-2 w-48 rounded-full" style={{
            background: "linear-gradient(90deg, #33F28B 0%, #A8CFEA 50%, #EBF1FD 100%)",
          }} />
          <div className="flex items-center justify-between text-[11px] text-zb-ink-muted">
            <span>{formatCompact(legendMin)}</span>
            <span>{formatCompact(legendMax)}</span>
          </div>
          <p className="text-[11px]">Green = opportunity (low density)</p>
          {densityPending && (
            <p className="text-[11px]">
              Using raw establishments until population loads.
            </p>
          )}
        </div>
        <div className="space-y-1 text-right">
          <p>Visible states: {formatNumber(stats.visible)}</p>
          <p>
            Establishments loaded: {formatNumber(stats.estabLoaded)}
          </p>
          <p>
            Population loaded: {formatNumber(stats.popLoaded)} (ACS {getPopYear()})
          </p>
          <p>Metric: {metricLabel}</p>
        </div>
      </div>
    </Card>
  );
}

export default NaicsHeatMapView;
