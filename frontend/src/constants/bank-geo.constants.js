/**
 * Geographic and Banking System Constants for Vendor Bank Management
 * Standardized ISO 3166-1 alpha-2 country codes and regional subdivisions.
 */

export const SUPPORTED_COUNTRIES = Object.freeze([
  { code: "IN", name: "India", routingLabel: "IFSC Code", routingPlaceholder: "e.g. HDFC0001234", requiresIfsc: true },
  { code: "US", name: "United States", routingLabel: "Routing Number (ABA)", routingPlaceholder: "9-digit ABA routing", requiresIfsc: false },
  { code: "GB", name: "United Kingdom", routingLabel: "Sort Code / SWIFT", routingPlaceholder: "6-digit sort code", requiresIfsc: false },
  { code: "AE", name: "United Arab Emirates", routingLabel: "Routing / SWIFT Code", routingPlaceholder: "SWIFT / BIC", requiresIfsc: false },
  { code: "SG", name: "Singapore", routingLabel: "Bank / Branch Code", routingPlaceholder: "e.g. 7171-001", requiresIfsc: false },
  { code: "CA", name: "Canada", routingLabel: "Transit / Routing Number", routingPlaceholder: "Transit (5) + Inst (3)", requiresIfsc: false },
  { code: "AU", name: "Australia", routingLabel: "BSB Code", routingPlaceholder: "6-digit BSB (e.g. 123-456)", requiresIfsc: false },
]);

export const INDIAN_STATES = Object.freeze([
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
]);

export const US_STATES = Object.freeze([
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
  "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
  "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
]);

export const CANADIAN_PROVINCES = Object.freeze([
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon",
]);

export const AUSTRALIAN_STATES = Object.freeze([
  "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland",
  "South Australia", "Tasmania", "Victoria", "Western Australia",
]);

export const UK_REGIONS = Object.freeze([
  "England", "Scotland", "Wales", "Northern Ireland",
]);

export const UAE_EMIRATES = Object.freeze([
  "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain",
]);

export const SINGAPORE_REGIONS = Object.freeze([
  "Central Region", "East Region", "North Region", "North-East Region", "West Region",
]);

/**
 * Country-to-States lookup map
 */
export const COUNTRY_SUBDIVISIONS = Object.freeze({
  IN: INDIAN_STATES,
  US: US_STATES,
  CA: CANADIAN_PROVINCES,
  AU: AUSTRALIAN_STATES,
  GB: UK_REGIONS,
  AE: UAE_EMIRATES,
  SG: SINGAPORE_REGIONS,
});

/**
 * Helper to retrieve subdivision list for a given country code
 * @param {string} countryCode - ISO 3166-1 alpha-2
 * @returns {readonly string[] | null} List of subdivision names, or null if free-form entry
 */
export function getSubdivisionsForCountry(countryCode) {
  if (!countryCode) return null;
  const upper = countryCode.toUpperCase();
  return COUNTRY_SUBDIVISIONS[upper] || null;
}

/**
 * Retrieve routing configuration for a given country code
 * @param {string} countryCode
 */
export function getCountryRoutingMeta(countryCode) {
  const match = SUPPORTED_COUNTRIES.find((c) => c.code === (countryCode || "IN").toUpperCase());
  return match || {
    code: countryCode,
    name: countryCode,
    routingLabel: "Routing / SWIFT Code",
    routingPlaceholder: "Routing code",
    requiresIfsc: false,
  };
}
