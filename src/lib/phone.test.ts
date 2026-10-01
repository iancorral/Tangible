import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["6142708576", "6142708576"],
    ["526142708576", "6142708576"],
    ["5216142708576", "6142708576"],
    ["(614) 270-8576", "6142708576"],
  ])("%j → %j", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("devuelve null cuando no alcanza para identificar a alguien", () => {
    expect(normalizePhone("2708576")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("nunca recorta un número que no reconoce", () => {
    expect(normalizePhone("0016142708576")).toBe("0016142708576");
  });
});

it("formatea y enmascara", () => {
  expect(formatPhone("6142708576")).toBe("614 270 8576");
  expect(maskPhone("6142708576")).toBe("••• ••• 8576");
});
