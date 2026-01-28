export const NAICS_CATEGORIES = [
  { id: "restaurants", label: "Restaurants", prefixes: ["7225"] },
  { id: "food_trucks", label: "Food Trucks", prefixes: ["722330"] },
  { id: "auto_repair", label: "Auto Repair", prefixes: ["8111"] },
  { id: "real_estate", label: "Real Estate Offices", prefixes: ["53121"] },
  { id: "nail_salons", label: "Nail Salons", prefixes: ["812113"] },
  { id: "hair_salons", label: "Hair Salons", prefixes: ["812112"] },
  { id: "child_care", label: "Child Care", prefixes: ["6244"] },
  { id: "grocery", label: "Grocery Stores", prefixes: ["4451"] },
  { id: "dentists", label: "Dentist Offices", prefixes: ["6212"] },
  { id: "gyms", label: "Gyms/Fitness", prefixes: ["71394"] },
];

export const ZBP_BASE_URL =
  "https://www2.census.gov/programs-surveys/cbp/datasets";
export const GAZETTEER_BASE_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer";
export const ACS_API_BASE = "https://api.census.gov/data";

export const OUTPUT_DIR = "public/data";
export const RAW_DIR = "data/raw";

export const OPPORTUNITY_EPS = 0.01;
