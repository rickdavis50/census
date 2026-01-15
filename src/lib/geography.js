// TODO: Add CBSA metro options once ACS/Nonemployer geo support is finalized.
export const GEO_OPTIONS = [
  { id: "us", label: "United States", type: "us" },
  { id: "ca", label: "California", type: "state", fips: "06" },
  { id: "tx", label: "Texas", type: "state", fips: "48" },
  { id: "ny", label: "New York", type: "state", fips: "36" },
  { id: "fl", label: "Florida", type: "state", fips: "12" },
  { id: "il", label: "Illinois", type: "state", fips: "17" },
  { id: "pa", label: "Pennsylvania", type: "state", fips: "42" },
  { id: "oh", label: "Ohio", type: "state", fips: "39" },
  { id: "ga", label: "Georgia", type: "state", fips: "13" },
  { id: "nc", label: "North Carolina", type: "state", fips: "37" },
  { id: "mi", label: "Michigan", type: "state", fips: "26" },
];

export const getGeoParams = (geo) => {
  if (geo?.type === "state") {
    return { for: `state:${geo.fips}` };
  }
  return { for: "us:1" };
};

export const getGeoLabel = (geo) => geo?.label ?? "United States";
