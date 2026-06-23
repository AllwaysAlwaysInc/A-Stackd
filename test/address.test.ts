import { describe, expect, it } from "vitest";
import { formatShippingAddress, parseShippingAddress } from "../src/domain/address.js";

const VALID = {
  name: "Austin Hanshew",
  line1: "123 Jackpot Ave",
  city: "Las Vegas",
  state: "nv",
  postalCode: "89101",
};

describe("parseShippingAddress", () => {
  it("normalizes a valid address (uppercases state, defaults country)", () => {
    const address = parseShippingAddress(VALID);
    expect(address).toEqual({
      name: "Austin Hanshew",
      line1: "123 Jackpot Ave",
      city: "Las Vegas",
      state: "NV",
      postalCode: "89101",
      country: "US",
    });
  });

  it("trims whitespace and keeps an optional line2", () => {
    const address = parseShippingAddress({ ...VALID, line2: "  Apt 7  ", name: "  Sam  " });
    expect(address.line2).toBe("Apt 7");
    expect(address.name).toBe("Sam");
  });

  it("accepts ZIP+4", () => {
    expect(parseShippingAddress({ ...VALID, postalCode: "89101-1234" }).postalCode).toBe(
      "89101-1234",
    );
  });

  it.each([
    ["empty object", {}],
    ["missing name", { ...VALID, name: "" }],
    ["street without a number", { ...VALID, line1: "Jackpot Avenue" }],
    ["street without letters", { ...VALID, line1: "123 456" }],
    ["missing city", { ...VALID, city: "" }],
    ["unknown state", { ...VALID, state: "ZZ" }],
    ["bad ZIP", { ...VALID, postalCode: "abcde" }],
    ["short ZIP", { ...VALID, postalCode: "1234" }],
    ["non-US country", { ...VALID, country: "CA" }],
    ["not an object", "123 Main St"],
  ])("rejects %s", (_label, input) => {
    expect(() => parseShippingAddress(input)).toThrowError(/shipping address/i);
  });

  it("reports every problem at once", () => {
    try {
      parseShippingAddress({ name: "", line1: "", city: "", state: "ZZ", postalCode: "x" });
      throw new Error("expected to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("recipient name");
      expect(message).toContain("street address");
      expect(message).toContain("city");
      expect(message).toContain("state");
      expect(message).toContain("ZIP");
    }
  });
});

describe("formatShippingAddress", () => {
  it("renders a single label line", () => {
    expect(formatShippingAddress(parseShippingAddress({ ...VALID, line2: "Apt 7" }))).toBe(
      "Austin Hanshew, 123 Jackpot Ave, Apt 7, Las Vegas, NV 89101, US",
    );
  });
});
