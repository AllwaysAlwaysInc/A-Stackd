import type { ShippingAddress } from "./api";

/** Two-letter USPS codes for the 50 states, DC, and shippable territories. */
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
];

const US_STATE_SET = new Set(US_STATES);
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const HAS_LETTER = /[a-z]/i;
const HAS_DIGIT = /\d/;

/** Raw, in-progress address fields bound to the form inputs. */
export interface AddressForm {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

export const EMPTY_ADDRESS_FORM: AddressForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

export type AddressErrors = Partial<Record<keyof AddressForm, string>>;

/**
 * Validate a form locally so the buy button stays locked until the address is
 * deliverable. Mirrors the backend's parseShippingAddress so the user gets
 * instant feedback and the server stays the source of truth.
 */
export function validateAddress(form: AddressForm): AddressErrors {
  const errors: AddressErrors = {};
  const name = form.name.trim();
  const line1 = form.line1.trim();
  const city = form.city.trim();
  const state = form.state.trim().toUpperCase();
  const postalCode = form.postalCode.trim();

  if (name.length < 2 || !HAS_LETTER.test(name)) errors.name = "Recipient name is required.";
  if (line1.length < 3 || !HAS_LETTER.test(line1) || !HAS_DIGIT.test(line1)) {
    errors.line1 = "Street address with a number is required.";
  }
  if (city.length < 2 || !HAS_LETTER.test(city)) errors.city = "City is required.";
  if (!US_STATE_SET.has(state)) errors.state = "2-letter state, e.g. NV.";
  if (!ZIP_RE.test(postalCode)) errors.postalCode = "ZIP like 90210 or 90210-1234.";

  return errors;
}

export function isAddressValid(form: AddressForm): boolean {
  return Object.keys(validateAddress(form)).length === 0;
}

/** Convert a validated form into the API payload. */
export function toShippingAddress(form: AddressForm): ShippingAddress {
  const address: ShippingAddress = {
    name: form.name.trim(),
    line1: form.line1.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    postalCode: form.postalCode.trim(),
    country: "US",
  };
  const line2 = form.line2.trim();
  if (line2.length > 0) address.line2 = line2;
  return address;
}
