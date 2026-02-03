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
import { loadStateCentroids } from "./naicsHeatMapData";

const EMPTY_GEOJSON = {
  type: "FeatureCollection",
  features: [],
};

const MIN_HEATMAP_ZOOM = 3;
const NEARBY_BBOX_DEGREES = 0.5;
const DENSE_POP_PER_SQMI = 3000;
const DENSE_POP_FALLBACK = 50000;
const POP_FLOOR = 1000;
const VIEW_MODES = {
  ZIP: "zip",
  STATE: "state",
};
const STATES_GEOJSON_URL = "/data/us-states.geojson";

const STATE_FIPS_BY_ABBR = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

const STATE_FIPS = Object.values(STATE_FIPS_BY_ABBR);

const normalizeStateId = (value) =>
  String(value ?? "")
    .trim()
    .padStart(2, "0");

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

const formatCompact = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const formatPercent = (value) =>
  `${(Number(value ?? 0) * 100).toFixed(0)}%`;

const calcEstabPer10k = (estab, pop) =>
  pop > 0 ? (estab / pop) * 10000 : 0;

const log10p1 = (value) => Math.log10(Math.max(0, value) + 1);

const getOpportunityColor = (value) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  if (v <= 0.25) return "#1F2E2B";
  if (v <= 0.5) return "#23624C";
  if (v <= 0.75) return "#2BAA7B";
  if (v <= 0.9) return "#7BE7C1";
  return "#E7FFF4";
};

const deriveStateCentroids = (features = []) => {
  const centroids = [];
  features.forEach((feature) => {
    const state = normalizeStateId(feature?.properties?.STATE ?? feature?.id);
    if (!state) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const walk = (coords) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        const [x, y] = coords;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        return;
      }
      coords.forEach(walk);
    };
    walk(feature?.geometry?.coordinates ?? []);
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
    centroids.push({
      state,
      name: feature?.properties?.NAME ?? "State",
      lat: (minY + maxY) / 2,
      lng: (minX + maxX) / 2,
    });
  });
  return centroids;
};

const buildTooltipHtml = ({
  zip,
  name,
  categoryLabel,
  per10k,
  medianPer10k,
  rating,
}) => `
  <div style="font-size:12px;line-height:1.4">
    <strong>ZIP ${zip}${name ? ` • ${name}` : ""}</strong><br/>
    ${categoryLabel}<br/>
    Opportunity: ${rating}<br/>
    ${formatNumber(per10k)} per 10k (Local median ${formatNumber(medianPer10k)})
  </div>
`;

const buildStateTooltipHtml = ({
  name,
  categoryLabel,
  per10k,
  rating,
}) => `
  <div style="font-size:12px;line-height:1.4">
    <strong>${name || "State"}</strong><br/>
    ${categoryLabel}<br/>
    Opportunity: ${rating}<br/>
    ${formatNumber(per10k)} per 10k residents
  </div>
`;

const percentileRank = (sorted, value) => {
  if (!sorted?.length || !Number.isFinite(value)) return null;
  if (sorted.length === 1) return 0.5;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo / (sorted.length - 1);
};

const getBlendWeights = (zoom) => {
  if (zoom < 4) return { national: 0.7, state: 0.2, local: 0.1 };
  if (zoom < 6) return { national: 0.4, state: 0.4, local: 0.2 };
  return { national: 0.2, state: 0.3, local: 0.5 };
};

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

const buildLocalOppMap = (points, categoryId) => {
  const valuesByBand = new Map();
  points.forEach((item) => {
    const pop = item.p ?? 0;
    if (pop < POP_FLOOR) return;
    const est = item.e?.[categoryId] ?? 0;
    const per10k = calcEstabPer10k(est, pop);
    const value = log10p1(per10k);
    const band = item.d ?? 0;
    const bucket = valuesByBand.get(band) ?? [];
    bucket.push(value);
    valuesByBand.set(band, bucket);
  });

  const sortedByBand = new Map();
  valuesByBand.forEach((bucket, band) => {
    bucket.sort((a, b) => a - b);
    sortedByBand.set(band, bucket);
  });

  const oppByZip = new Map();
  points.forEach((item) => {
    const pop = item.p ?? 0;
    if (pop < POP_FLOOR) {
      oppByZip.set(item.z, 0);
      return;
    }
    const est = item.e?.[categoryId] ?? 0;
    const per10k = calcEstabPer10k(est, pop);
    const value = log10p1(per10k);
    const band = item.d ?? 0;
    const bucket = sortedByBand.get(band) ?? [];
    const rank = percentileRank(bucket, value);
    const opp = rank === null ? 0 : 1 - rank;
    oppByZip.set(item.z, opp);
  });

  return oppByZip;
};

const buildLocalMedianPer10k = (points, categoryId) => {
  const per10kValues = [];
  points.forEach((item) => {
    const pop = item.p ?? 0;
    if (pop < POP_FLOOR) return;
    const est = item.e?.[categoryId] ?? 0;
    const per10k = calcEstabPer10k(est, pop);
    if (Number.isFinite(per10k)) per10kValues.push(per10k);
  });
  if (!per10kValues.length) return 0;
  per10kValues.sort((a, b) => a - b);
  const mid = Math.floor(per10kValues.length / 2);
  return per10kValues.length % 2 === 0
    ? (per10kValues[mid - 1] + per10kValues[mid]) / 2
    : per10kValues[mid];
};

const classifyOpportunity = (value) => {
  if (value >= 0.67) return "High";
  if (value >= 0.33) return "Medium";
  return "Low";
};

const blendOpportunity = (nationalOpp, stateOpp, localOpp, weights) =>
  Math.min(
    1,
    Math.max(
      0,
      weights.national * nationalOpp +
        weights.state * stateOpp +
        weights.local * localOpp
    )
  );

function NaicsHeatMapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const categoryLabelRef = useRef("");
  const stateMarkersRef = useRef([]);

  const loadedChunksRef = useRef(new Map());
  const loadedPointsRef = useRef([]);

  const [indexMeta, setIndexMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [viewMode, setViewMode] = useState(VIEW_MODES.ZIP);
  const [legend, setLegend] = useState({ min: null, max: null, medianPer10k: 0 });
  const [stateCentroids, setStateCentroids] = useState([]);
  const [stateShapes, setStateShapes] = useState(null);
  const [stats, setStats] = useState({
    visible: 0,
    loaded: 0,
  });
  const [stateStats, setStateStats] = useState({
    count: 0,
    medianPer10k: 0,
    minPer10k: 0,
    maxPer10k: 0,
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

  useEffect(() => {
    let isActive = true;
    loadStateCentroids()
      .then((data) => {
        if (!isActive) return;
        setStateCentroids(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load state centroids.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    fetch(STATES_GEOJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load state shapes (${response.status}).`);
        }
        return response.json();
      })
      .then((data) => {
        if (!isActive) return;
        setStateShapes(data);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load state shapes.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const categoryLabel = useMemo(() => {
    if (!indexMeta?.categories) return "";
    return indexMeta.categories.find((cat) => cat.id === categoryId)?.label ?? "";
  }, [categoryId, indexMeta]);

  const categoryIndex = useMemo(() => {
    const map = new Map();
    indexMeta?.categories?.forEach((cat, idx) => {
      map.set(cat.id, idx);
    });
    return map;
  }, [indexMeta]);

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

  const ensureAllChunksLoaded = useCallback(async () => {
    if (!indexMeta?.chunks) return;
    await ensureChunksLoaded(Object.keys(indexMeta.chunks));
  }, [ensureChunksLoaded, indexMeta]);

  const clearStateMarkers = useCallback(() => {
    stateMarkersRef.current.forEach((marker) => marker.remove());
    stateMarkersRef.current = [];
  }, []);

  const buildFeatures = useCallback(
    (points, localOppMap, weights) => {
      const features = [];
      let min = null;
      let max = null;
      const categoryIdx = categoryIndex.get(categoryId) ?? 0;

      points.forEach((item) => {
        const estab = item.e?.[categoryId] ?? 0;
        const pop = item.p ?? 0;
        const per10k = calcEstabPer10k(estab, pop);
        const nationalOpp = item.pn?.[categoryIdx] ?? 0;
        const stateOpp = item.ps?.[categoryIdx] ?? nationalOpp;
        const localOpp = localOppMap.get(item.z) ?? nationalOpp;
        const blended = blendOpportunity(nationalOpp, stateOpp, localOpp, weights);

        if (blended > 0) {
          min = min === null ? blended : Math.min(min, blended);
          max = max === null ? blended : Math.max(max, blended);
        }

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [item.lon, item.lat] },
          properties: {
            zip: item.z,
            name: item.n ?? "",
            estab,
            pop,
            per10k,
            opportunity: blended,
          },
        });
      });

      return {
        features,
        min,
        max,
      };
    },
    [categoryId, categoryIndex]
  );

  const applyGeoJson = useCallback((geojson, minValue, maxValue) => {
    if (viewMode !== VIEW_MODES.ZIP) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("naics-zip");
    if (source) {
      source.setData(geojson);
    }
    if (map.getLayer("naics-points")) {
      map.setPaintProperty("naics-points", "circle-opacity", [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "opportunity"], 0],
        minValue ?? 0,
        0.45,
        maxValue ?? 1,
        0.95,
      ]);
    }
  }, [viewMode]);

  const refreshData = useCallback(async () => {
    if (!mapRef.current || !indexMeta) return;

    if (viewMode === VIEW_MODES.STATE) {
      await ensureAllChunksLoaded();
      const stateTotals = new Map();
      loadedPointsRef.current.forEach((item) => {
        const abbr = item.s;
        const fips = STATE_FIPS_BY_ABBR[abbr];
        if (!fips) return;
        const pop = item.p ?? 0;
        if (!Number.isFinite(pop) || pop <= 0) return;
        const est = item.e?.[categoryId] ?? 0;
        if (!Number.isFinite(est)) return;
        const entry = stateTotals.get(fips) ?? { pop: 0, estab: 0, fips };
        entry.pop += pop;
        entry.estab += est;
        stateTotals.set(fips, entry);
      });

      const rows = [];
      stateTotals.forEach((entry, fips) => {
        if (entry.pop <= 0) return;
        const per10k = calcEstabPer10k(entry.estab, entry.pop);
        rows.push({ fips, ...entry, per10k });
      });

      const per10kSorted = rows.map((row) => row.per10k).sort((a, b) => a - b);
      const mid = Math.floor(per10kSorted.length / 2);
      const medianPer10k =
        per10kSorted.length === 0
          ? 0
          : per10kSorted.length % 2 === 0
          ? (per10kSorted[mid - 1] + per10kSorted[mid]) / 2
          : per10kSorted[mid];

      let minOpp = null;
      let maxOpp = null;
      const byFips = new Map();
      rows.forEach((row) => {
        const rank = percentileRank(per10kSorted, row.per10k);
        const opportunity = rank === null ? 0 : 1 - rank;
        byFips.set(row.fips, { ...row, opportunity });
        minOpp = minOpp === null ? opportunity : Math.min(minOpp, opportunity);
        maxOpp = maxOpp === null ? opportunity : Math.max(maxOpp, opportunity);
      });

      const map = mapRef.current;
      if (map?.getSource("states") && stateShapes?.features?.length) {
        const features = stateShapes.features
          .filter((feature) =>
            STATE_FIPS.includes(
              normalizeStateId(feature.properties?.STATE ?? feature.id)
            )
          )
          .map((feature) => {
            const stateId = normalizeStateId(
              feature.properties?.STATE ?? feature.id
            );
            const row = byFips.get(stateId);
            return {
              ...feature,
              properties: {
                ...feature.properties,
                opportunity: row?.opportunity ?? 0,
                per10k: row?.per10k ?? 0,
                pop: row?.pop ?? 0,
                estab: row?.estab ?? 0,
              },
            };
          });
        map.getSource("states").setData({
          ...stateShapes,
          features,
        });
      }

      const centroidSource =
        stateCentroids.length > 0
          ? stateCentroids
          : deriveStateCentroids(stateShapes?.features);
      if (map?.getSource("state-centroids") && centroidSource?.length) {
        const features = centroidSource
          .filter((item) => STATE_FIPS.includes(item.state))
          .map((item) => {
            const row = byFips.get(item.state);
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [item.lng, item.lat] },
              properties: {
                state: item.state,
                name: item.name,
                per10k: row?.per10k ?? 0,
                opportunity: row?.opportunity ?? 0,
                pop: row?.pop ?? 0,
                estab: row?.estab ?? 0,
              },
            };
          });
        const source = map.getSource("state-centroids");
        source.setData({ type: "FeatureCollection", features });

        clearStateMarkers();
        features.forEach((feature) => {
          const el = document.createElement("div");
          const opportunity = feature.properties?.opportunity ?? 0;
          el.style.width = "12px";
          el.style.height = "12px";
          el.style.borderRadius = "999px";
          el.style.backgroundColor = getOpportunityColor(opportunity);
          el.style.border = "2px solid #0B1220";
          el.style.boxShadow = "0 0 6px rgba(15, 23, 42, 0.45)";
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat(feature.geometry.coordinates)
            .addTo(map);
          stateMarkersRef.current.push(marker);
        });
      } else {
        clearStateMarkers();
      }

      setLegend({ min: minOpp ?? 0, max: maxOpp ?? 1, medianPer10k });
      setStateStats({
        count: rows.length,
        medianPer10k,
        minPer10k: per10kSorted[0] ?? 0,
        maxPer10k: per10kSorted[per10kSorted.length - 1] ?? 0,
      });
      return;
    }

    const bounds = mapRef.current.getBounds();
    const bbox = bboxFromMap(bounds);
    await ensureChunksForBbox(bbox);

    const visible = loadedPointsRef.current.filter((item) =>
      bounds.contains([item.lon, item.lat])
    );

    const zoom = mapRef.current.getZoom();
    const weights = getBlendWeights(zoom);
    const localOppMap = buildLocalOppMap(visible, categoryId);
    const localMedianPer10k = buildLocalMedianPer10k(visible, categoryId);
    const { features, min, max } = buildFeatures(visible, localOppMap, weights);
    applyGeoJson({ type: "FeatureCollection", features }, min, max);
    setLegend({ min, max, medianPer10k: localMedianPer10k });
    setStats({ visible: visible.length, loaded: loadedPointsRef.current.length });
  }, [
    applyGeoJson,
    buildFeatures,
    clearStateMarkers,
    ensureAllChunksLoaded,
    ensureChunksForBbox,
    indexMeta,
    categoryId,
    stateCentroids,
    stateShapes,
    viewMode,
  ]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshData();
    }, 400);
  }, [refreshData]);


  const updateNearbyLayer = useCallback(() => {
    if (viewMode !== VIEW_MODES.ZIP) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("nearby-zip");
    if (!source) return;

    const zoom = map.getZoom();
    const weights = getBlendWeights(zoom);
    const localOppMap = buildLocalOppMap(nearbyRecords, categoryId);
    const localMedianPer10k = buildLocalMedianPer10k(nearbyRecords, categoryId);
    const categoryIdx = categoryIndex.get(categoryId) ?? 0;

    const features = nearbyRecords.map((record) => {
      const estab = record.e?.[categoryId] ?? 0;
      const pop = record.p ?? 0;
      const per10k = calcEstabPer10k(estab, pop);
      const nationalOpp = record.pn?.[categoryIdx] ?? 0;
      const stateOpp = record.ps?.[categoryIdx] ?? nationalOpp;
      const localOpp = localOppMap.get(record.z) ?? nationalOpp;
      const opp = blendOpportunity(nationalOpp, stateOpp, localOpp, weights);
      const rating = classifyOpportunity(opp);
      const oppLabel = `${Math.round(opp * 100)}%`;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [record.lon, record.lat] },
        properties: {
          zip: record.z,
          name: record.n ?? "",
          estab,
          pop,
          per10k,
          opportunity: opp,
          rating,
          medianPer10k: localMedianPer10k,
          isTarget: targetRecord?.z === record.z,
          showLabel: targetRecord?.z !== record.z,
          oppLabel,
        },
      };
    });

    source.setData({ type: "FeatureCollection", features });
  }, [categoryId, nearbyRecords, targetRecord, categoryIndex, viewMode]);

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
      map.addSource("state-centroids", {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });
      map.addSource("states", {
        type: "geojson",
        data: EMPTY_GEOJSON,
        promoteId: "STATE",
      });

      map.addLayer({
        id: "naics-points",
        type: "circle",
        source: "naics-zip",
        minzoom: MIN_HEATMAP_ZOOM,
        filter: [
          "all",
          [">=", ["coalesce", ["get", "pop"], 0], POP_FLOOR],
          [">", ["coalesce", ["get", "opportunity"], 0], 0],
        ],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            1.2,
            6,
            2.4,
            9,
            4,
            12,
            6.5,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "opportunity"], 0],
            0,
            "#1F2E2B",
            0.25,
            "#23624C",
            0.5,
            "#2BAA7B",
            0.75,
            "#7BE7C1",
            1,
            "#E7FFF4",
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "opportunity"], 0],
            0,
            0.45,
            1,
            0.95,
          ],
        },
      });

      map.addLayer({
        id: "naics-states",
        type: "fill",
        source: "states",
        layout: { visibility: "none" },
        filter: ["in", ["get", "STATE"], ["literal", STATE_FIPS]],
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "opportunity"], 0],
            0,
            "#1F2E2B",
            0.25,
            "#23624C",
            0.5,
            "#2BAA7B",
            0.75,
            "#7BE7C1",
            1,
            "#E7FFF4",
          ],
          "fill-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "naics-states-outline",
        type: "line",
        source: "states",
        layout: { visibility: "none" },
        filter: ["in", ["get", "STATE"], ["literal", STATE_FIPS]],
        paint: {
          "line-color": "#0B1220",
          "line-width": 1,
        },
      });

      map.addLayer({
        id: "naics-state-dots",
        type: "circle",
        source: "state-centroids",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            4,
            5,
            6,
            7,
            8,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "opportunity"], 0],
            0,
            "#1F2E2B",
            0.25,
            "#23624C",
            0.5,
            "#2BAA7B",
            0.75,
            "#7BE7C1",
            1,
            "#E7FFF4",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#0B1220",
          "circle-stroke-width": 1.25,
        },
      });

      map.on("click", "naics-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { zip, name, per10k, opportunity } = feature.properties;
        const rating = classifyOpportunity(opportunity);
        const medianPer10k = legend.medianPer10k ?? 0;
        const html = buildTooltipHtml({
          zip,
          name,
          categoryLabel: categoryLabelRef.current,
          per10k,
          medianPer10k,
          rating,
        });

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 12,
            className: "zb-popup",
          });
        }
        popupRef.current.setLngLat(event.lngLat).setHTML(html).addTo(map);
      });

      map.on("click", "naics-state-dots", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const name =
          feature.properties?.name ??
          feature.properties?.NAME ??
          "State";
        const per10k = feature.properties?.per10k ?? 0;
        const opportunity = feature.properties?.opportunity ?? 0;
        const rating = classifyOpportunity(opportunity);
        const html = buildStateTooltipHtml({
          name,
          categoryLabel: categoryLabelRef.current,
          per10k,
          rating,
        });

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 12,
            className: "zb-popup",
          });
        }
        popupRef.current.setLngLat(event.lngLat).setHTML(html).addTo(map);
      });

      map.on("click", "naics-states", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const name =
          feature.properties?.NAME ??
          feature.properties?.name ??
          "State";
        const per10k = feature.properties?.per10k ?? 0;
        const opportunity = feature.properties?.opportunity ?? 0;
        const rating = classifyOpportunity(opportunity);
        const html = buildStateTooltipHtml({
          name,
          categoryLabel: categoryLabelRef.current,
          per10k,
          rating,
        });

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 12,
            className: "zb-popup",
          });
        }
        popupRef.current.setLngLat(event.lngLat).setHTML(html).addTo(map);
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

      map.addLayer({
        id: "nearby-zip-label",
        type: "symbol",
        source: "nearby-zip",
        layout: {
          "text-field": ["get", "oppLabel"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#E2E8F0",
          "text-halo-color": "#0B1220",
          "text-halo-width": 1.5,
        },
        filter: ["==", ["get", "showLabel"], true],
      });

      const handlePopup = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { zip, name, per10k, opportunity, medianPer10k } = feature.properties;
        const rating = classifyOpportunity(opportunity);
        const html = buildTooltipHtml({
          zip,
          name,
          categoryLabel: categoryLabelRef.current,
          per10k,
          medianPer10k: medianPer10k ?? legend.medianPer10k ?? 0,
          rating,
        });

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 12,
            className: "zb-popup",
          });
        }
        popupRef.current.setLngLat(event.lngLat).setHTML(html).addTo(map);
      };

      map.on("click", "nearby-zip-circle", handlePopup);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const showStates = viewMode === VIEW_MODES.STATE;
    const zipVisibility = showStates ? "none" : "visible";
    const stateVisibility = showStates ? "visible" : "none";

    if (map.getLayer("naics-points")) {
      map.setLayoutProperty("naics-points", "visibility", zipVisibility);
    }
    if (map.getLayer("nearby-zip-circle")) {
      map.setLayoutProperty("nearby-zip-circle", "visibility", zipVisibility);
    }
    if (map.getLayer("nearby-zip-label")) {
      map.setLayoutProperty("nearby-zip-label", "visibility", zipVisibility);
    }
    if (map.getLayer("naics-states")) {
      map.setLayoutProperty("naics-states", "visibility", stateVisibility);
    }
    if (map.getLayer("naics-states-outline")) {
      map.setLayoutProperty("naics-states-outline", "visibility", stateVisibility);
    }
    if (map.getLayer("naics-state-dots")) {
      map.setLayoutProperty("naics-state-dots", "visibility", stateVisibility);
    }

    if (!showStates) {
      clearStateMarkers();
    }

    scheduleRefresh();
  }, [clearStateMarkers, scheduleRefresh, viewMode]);

  useEffect(() => {
    if (viewMode === VIEW_MODES.STATE) {
      scheduleRefresh();
    }
  }, [scheduleRefresh, stateCentroids, stateShapes, viewMode]);

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
          {viewMode === VIEW_MODES.STATE
            ? `State-level opportunity heat map for ${categoryLabel || "NAICS"}.`
            : `ZIP-level opportunity heat map for ${categoryLabel || "NAICS"}.`}
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

      <div className="flex flex-wrap items-center gap-4 text-xs text-zb-ink-muted">
        <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="uppercase tracking-[0.2em]">View</span>
          <Button
            size="sm"
            variant={viewMode === VIEW_MODES.ZIP ? "primary" : "secondary"}
            onClick={() => setViewMode(VIEW_MODES.ZIP)}
          >
            ZIP
          </Button>
          <Button
            size="sm"
            variant={viewMode === VIEW_MODES.STATE ? "primary" : "secondary"}
            onClick={() => setViewMode(VIEW_MODES.STATE)}
          >
            State
          </Button>
        </div>
      </div>

      {viewMode === VIEW_MODES.ZIP && (
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
        </div>
      )}

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
            <span>{formatPercent(legendMin)}</span>
            <span>{formatPercent(legendMax)}</span>
          </div>
          <p className="text-[11px]">
            {viewMode === VIEW_MODES.STATE
              ? "State shading is relative to other states (per-capita concentration)."
              : `Colored points only (ZIPs with population ≥ ${POP_FLOOR.toLocaleString()}).`}
          </p>
        </div>
        {viewMode === VIEW_MODES.STATE ? (
          <div className="space-y-1 text-right">
            <p>States: {formatNumber(stateStats.count)}</p>
            <p>Median per 10k: {formatNumber(stateStats.medianPer10k)}</p>
            <p>Category: {categoryLabel || "—"}</p>
          </div>
        ) : (
          <div className="space-y-1 text-right">
            <p>Visible ZIPs: {formatNumber(stats.visible)}</p>
            <p>Loaded ZIPs: {formatNumber(stats.loaded)}</p>
            <p>Category: {categoryLabel || "—"}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default NaicsHeatMapView;
