import { InvalidAddressError, GeoBlockedError } from "./errors.js";

/**
 * A validated, deliverable shipping address. Prizes are physical goods, so a
 * complete, well-formed address is required before any chip can be spent. The
 * address is persisted with the immutable ticket batch so a won prize can
 * always be shipped to where the seat was claimed.
 */
export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Two-letter USPS codes for the 50 states, DC, and shippable territories. */
const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
]);

const ZIP_RE = /^\d{5}(-\d{4})?$/;
const HAS_LETTER = /[a-z]/i;
const HAS_DIGIT = /\d/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validate and normalize a raw shipping address. Collects every problem so the
 * caller (and the user) sees all of them at once, then throws
 * InvalidAddressError if anything is wrong.
 */
export function parseShippingAddress(input: unknown, blockedStates: Set<string> = new Set()): ShippingAddress {
  const problems: string[] = [];
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;

  const name = asString(raw.name);
  const line1 = asString(raw.line1);
  const line2 = asString(raw.line2);
  const city = asString(raw.city);
  const state = asString(raw.state).toUpperCase();
  const postalCode = asString(raw.postalCode);
  const rawCountry = asString(raw.country).toUpperCase();
  const country = rawCountry === "" ? "US" : rawCountry;

  if (name.length < 2 || !HAS_LETTER.test(name)) {
    problems.push("recipient name is required");
  }
  if (line1.length < 3 || !HAS_LETTER.test(line1) || !HAS_DIGIT.test(line1)) {
    problems.push("a street address with a number is required");
  }
  if (city.length < 2 || !HAS_LETTER.test(city)) {
    problems.push("city is required");
  }
  if (!US_STATES.has(state)) {
    problems.push("a valid 2-letter state is required");
  }
  if (blockedStates.has(state)) {
    throw new GeoBlockedError(state);
  }
  if (!ZIP_RE.test(postalCode)) {
    problems.push("a valid ZIP code is required (e.g. 90210 or 90210-1234)");
  }
  if (country !== "US" && country !== "USA") {
    problems.push("prizes can only be shipped within the US");
  }

  if (problems.length > 0) throw new InvalidAddressError(problems);

  const address: ShippingAddress = {
    name,

    line1,
    city,
    state,
    postalCode,
    country: "US",
  };
  if (line2.length > 0) address.line2 = line2;
  return address;
}

/** Render an address as a single shipping label line for display/logging. */
export function formatShippingAddress(address: ShippingAddress): string {
  const parts = [
    address.name,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
  ].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.join(", ");
}
