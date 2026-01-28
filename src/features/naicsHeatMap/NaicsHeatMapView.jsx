import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Card from "../../components/Card";
import Button from "../../components/Button";
import {
  bboxFromMap,
  bboxIntersects,
  getChunkIdForZip,
  loadOpportunityChunk,
  loadOpportunityIndex,
  normalizeZip,
} from "./opportunityData";

const EMPTY_GEOJSON = {
  type: "FeatureCollection",
  features: [],
};

const MIN_HEATMAP_ZOOM = 3;
const NEARBY_BBOX_DEGREES = 0.5;
const DENSE_POP_PER_SQMI = 3000;
const DENSE_POP_FALLBACK = 50000;
const OPP_EPS = 0.01;
const OPP_MAX = 50;

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

const formatCompact = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const calcEstabPer10k = (estab, pop) =>
  pop > 0 ? (estab / pop) * 10000 : 0;

const calcOpportunity = (estab, pop) => {
  if (pop <= 0) return 0;
  const per10k = calcEstabPer10k(estab, pop);
  return 1 / Math.max(per10k, OPP_EPS);
};

const buildTooltipHtml = ({ zip, categoryLabel, estab, pop, per10k, opp }) => `
  <div style="font-size:12px;line-height:1.4">
    <strong>ZIP ${zip}</strong><br/>
    ${categoryLabel}<br/>
    Establishments: ${formatNumber(estab)}<br/>
    Population: ${formatNumber(pop)}<br/>
    Establishments / 10k: ${formatNumber(per10k)}<br/>
    Opportunity score: ${formatNumber(opp)}
  </div>
`;

const haversine = (a, b) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2) ** 2;
  const sinLon = Math.sin(dLon / 2) ** 2;
  const radius = 6371;
  const h = sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
};

function NaicsHeatMapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const categoryLabelRef = useRef("");

  const loadedChunksRef = useRef(new Map());
  const loadedPointsRef = useRef([]);

  const [indexMeta, setIndexMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [legend, setLegend] = useState({ min: null, max: null });
  const [stats, setStats] = useState({
    visible: 0,
    loaded: 0,
  });
  const [zipQuery, setZipQuery] = useState("");
  const [zipError, setZipError] = useState("");
  const [nearbyRecords, setNearbyRecords] = useState([]);
  const [targetRecord, setTargetRecord] = useState(null);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    let isActive = true;
    setStatus("loading");
    loadOpportunityIndex()
      .then((meta) => {
        if (!isActive) return;
        setIndexMeta(meta);
        setCategoryId(meta.categories?.[0]?.id ?? "");
        setStatus("ready");
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load ZIP data.");
        setStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const categoryLabel = useMemo(() => {
    if (!indexMeta?.categories) return "";
    return indexMeta.categories.find((cat) => cat.id === categoryId)?.label ?? "";
  }, [categoryId, indexMeta]);

  useEffect(() => {
    categoryLabelRef.current = categoryLabel;
  }, [categoryLabel]);

  const ensureChunksLoaded = useCallback(async (chunkIds) => {
    const missing = chunkIds.filter((id) => !loadedChunksRef.current.has(id));
    if (!missing.length) return;

    const payloads = await Promise.all(
      missing.map(async (id) => ({ id, data: await loadOpportunityChunk(id) }))
    );
    payloads.forEach(({ id, data }) => {
      loadedChunksRef.current.set(id, data);
      loadedPointsRef.current = loadedPointsRef.current.concat(data);
    });
  }, []);

  const ensureChunksForBbox = useCallback(async (bbox) => {
    if (!indexMeta?.chunks) return;
    const needed = Object.entries(indexMeta.chunks)
      .filter(([, chunk]) => bboxIntersects(bbox, chunk.bbox))
      .map(([chunkId]) => chunkId);
    await ensureChunksLoaded(needed);
  }, [ensureChunksLoaded, indexMeta]);

  const buildFeatures = useCallback(
    (points) => {
      const features = [];
      let min = null;
      let max = null;

      points.forEach((item) => {
        const estab = item.e?.[categoryId] ?? 0;
        const pop = item.p ?? 0;
        const per10k = calcEstabPer10k(estab, pop);
        const opp = Math.min(calcOpportunity(estab, pop), OPP_MAX);

        if (opp > 0) {
          min = min === null ? opp : Math.min(min, opp);
          max = max === null ? opp : Math.max(max, opp);
        }

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [item.lon, item.lat] },
          properties: {
            zip: item.z,
            estab,
            pop,
            per10k,
            opportunity: opp,
          },
        });
      });

      return {
        features,
        min,
        max,
      };
    },
    [categoryId]
  );

  const applyGeoJson = useCallback((geojson, minValue, maxValue) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("naics-zip");
    if (source) {
      source.setData(geojson);
    }

    if (map.getLayer("naics-heat")) {
      map.setPaintProperty("naics-heat", "heatmap-weight", [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "opportunity"], 0],
        minValue ?? 0,
        0,
        maxValue ?? 1,
        1,
      ]);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!mapRef.current || !indexMeta) return;

    const bounds = mapRef.current.getBounds();
    const bbox = bboxFromMap(bounds);
    await ensureChunksForBbox(bbox);

    const visible = loadedPointsRef.current.filter((item) =>
      bounds.contains([item.lon, item.lat])
    );

    const { features, min, max } = buildFeatures(visible);
    applyGeoJson({ type: "FeatureCollection", features }, min, max);
    setLegend({ min, max });
    setStats({ visible: visible.length, loaded: loadedPointsRef.current.length });
  }, [applyGeoJson, buildFeatures, ensureChunksForBbox, indexMeta]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshData();
    }, 400);
  }, [refreshData]);

  const nearbyRows = useMemo(() => {
    if (!nearbyRecords.length) return [];
    return nearbyRecords.map((record) => {
      const estab = record.e?.[categoryId] ?? 0;
      const pop = record.p ?? 0;
      const per10k = calcEstabPer10k(estab, pop);
      const opp = Math.min(calcOpportunity(estab, pop), OPP_MAX);
      return {
        zip: record.z,
        estab,
        pop,
        per10k,
        opp,
        distance: record.distance ?? 0,
      };
    });
  }, [categoryId, nearbyRecords]);

  const updateNearbyLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("nearby-zip");
    if (!source) return;

    const features = nearbyRecords.map((record) => {
      const estab = record.e?.[categoryId] ?? 0;
      const pop = record.p ?? 0;
      const per10k = calcEstabPer10k(estab, pop);
      const opp = Math.min(calcOpportunity(estab, pop), OPP_MAX);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [record.lon, record.lat] },
        properties: {
          zip: record.z,
          estab,
          pop,
          per10k,
          opportunity: opp,
          isTarget: targetRecord?.z === record.z,
        },
      };
    });

    source.setData({ type: "FeatureCollection", features });
  }, [categoryId, nearbyRecords, targetRecord]);

  useEffect(() => {
    updateNearbyLayer();
  }, [updateNearbyLayer]);

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
      map.addSource("nearby-zip", {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });

      map.addLayer({
        id: "naics-heat",
        type: "heatmap",
        source: "naics-zip",
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "opportunity"], 0],
            0,
            0,
            1,
            1,
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 1.4],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 12, 8, 35],
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "#0A3E2F",
            0.4,
            "#2BAA7B",
            0.7,
            "#9FE7C1",
            1,
            "#F4FFF9",
          ],
        },
      });

      map.addLayer({
        id: "nearby-zip-circle",
        type: "circle",
        source: "nearby-zip",
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "isTarget"], false],
            7,
            5,
          ],
          "circle-color": [
            "case",
            ["boolean", ["get", "isTarget"], false],
            "#FBBF24",
            "#38BDF8",
          ],
          "circle-stroke-color": "#0F172A",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("mousemove", "nearby-zip-circle", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { zip, estab, pop, per10k, opportunity } = feature.properties;
        const html = buildTooltipHtml({
          zip,
          categoryLabel: categoryLabelRef.current,
          estab,
          pop,
          per10k,
          opp: opportunity,
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

      map.on("mouseleave", "nearby-zip-circle", () => {
        popupRef.current?.remove();
      });

      scheduleRefresh();
    });

    map.on("moveend", scheduleRefresh);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [scheduleRefresh, token]);

  useEffect(() => {
    scheduleRefresh();
  }, [categoryId, scheduleRefresh]);

  const handleZipSearch = useCallback(async () => {
    const zip = normalizeZip(zipQuery);
    if (!zip || zip.length !== 5) {
      setZipError("Enter a 5-digit ZIP.");
      return;
    }
    setZipError("");

    const chunkId = getChunkIdForZip(zip);
    await ensureChunksLoaded([chunkId]);

    const chunk = loadedChunksRef.current.get(chunkId) ?? [];
    const record = chunk.find((item) => item.z === zip);
    if (!record) {
      setZipError("ZIP not found in dataset.");
      return;
    }

    const bbox = [
      record.lon - NEARBY_BBOX_DEGREES,
      record.lat - NEARBY_BBOX_DEGREES,
      record.lon + NEARBY_BBOX_DEGREES,
      record.lat + NEARBY_BBOX_DEGREES,
    ];

    await ensureChunksForBbox(bbox);

    const candidates = loadedPointsRef.current.filter(
      (item) =>
        item.lon >= bbox[0] &&
        item.lon <= bbox[2] &&
        item.lat >= bbox[1] &&
        item.lat <= bbox[3]
    );

    const density =
      record.a && record.a > 0 ? record.p / record.a : record.p;
    // Deterministic density heuristic: denser ZIPs get a larger nearby list.
    const isDense =
      (record.a && record.a > 0 && density >= DENSE_POP_PER_SQMI) ||
      record.p >= DENSE_POP_FALLBACK;
    const limit = isDense ? 10 : 4;

    const neighbors = candidates
      .filter((item) => item.z !== zip)
      .map((item) => ({
        ...item,
        distance: haversine(
          { lat: record.lat, lon: record.lon },
          { lat: item.lat, lon: item.lon }
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    setTargetRecord(record);
    setNearbyRecords([record, ...neighbors]);

    mapRef.current?.flyTo({
      center: [record.lon, record.lat],
      zoom: 8,
    });
  }, [ensureChunksForBbox, ensureChunksLoaded, zipQuery]);

  const legendMin = legend.min ?? 0;
  const legendMax = legend.max ?? 0;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">NAICS Opportunity Heat Map</h2>
        <p className="text-sm text-zb-ink-muted">
          ZIP-level opportunity heat map for {categoryLabel || "NAICS"}.
        </p>
        {indexMeta && (
          <p className="text-xs text-zb-ink-muted">
            Data: ZBP {indexMeta.zbpYear}, ACS {indexMeta.acsYear}
          </p>
        )}
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
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {indexMeta?.categories?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zb-ink-muted">
          <span className="uppercase tracking-[0.2em]">ZIP Search</span>
          <input
            className="w-28 rounded-zb-sm border border-zb-border bg-zb-surface px-2 py-1 text-xs text-zb-ink"
            value={zipQuery}
            placeholder="e.g. 94107"
            onChange={(event) => setZipQuery(event.target.value)}
          />
          <Button size="sm" variant="secondary" onClick={handleZipSearch}>
            Go
          </Button>
          {zipError && <span className="text-xs text-zb-rose">{zipError}</span>}
        </div>
        {nearbyRows.length > 0 && (
          <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-3 py-2 text-xs text-zb-ink">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zb-ink-muted">
              Nearby ZIPs
            </p>
            <div className="mt-2 grid gap-1">
              {nearbyRows.map((row) => (
                <div key={row.zip} className="flex items-center justify-between">
                  <span>
                    {row.zip} • {formatCompact(row.distance)} km
                  </span>
                  <span>
                    Opp {formatCompact(row.opp)} · {formatCompact(row.per10k)} /10k
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-zb-md border border-zb-border bg-zb-subtle">
        <div ref={mapContainerRef} className="h-[560px] w-full" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zb-ink-muted">
        <div className="space-y-2">
          <p className="uppercase tracking-[0.2em]">Opportunity</p>
          <div
            className="h-2 w-48 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #0A3E2F 0%, #2BAA7B 45%, #9FE7C1 70%, #F4FFF9 100%)",
            }}
          />
          <div className="flex items-center justify-between text-[11px] text-zb-ink-muted">
            <span>{formatCompact(legendMin)}</span>
            <span>{formatCompact(legendMax)}</span>
          </div>
          <p className="text-[11px]">
            Higher score = fewer establishments per 10k residents.
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p>Visible ZIPs: {formatNumber(stats.visible)}</p>
          <p>Loaded ZIPs: {formatNumber(stats.loaded)}</p>
          <p>Category: {categoryLabel || "—"}</p>
        </div>
      </div>
    </Card>
  );
}

export default NaicsHeatMapView;
