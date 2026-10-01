import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDevicePass,
  generateClaimCode,
  hashClaimCode,
  normalizeClaimCode,
  readDevicePass,
} from "./rewards-access";

const CUSTOMER = "6a76aad1ba5583d97ee1b62d";

describe("códigos de canje", () => {
  it("genera 6 caracteres sin letras confundibles (I, L, O, U)", () => {
    for (let i = 0; i < 200; i++) expect(generateClaimCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("acepta lo que la gente realmente teclea", () => {
    expect(normalizeClaimCode(" ab-c1o ")).toBe("ABC10");
    expect(hashClaimCode("abc-10")).toBe(hashClaimCode("ABC10"));
  });
});

describe("pase del dispositivo", () => {
  beforeEach(() => vi.stubEnv("REWARDS_PASS_SECRET", "test-secret"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("un pase válido identifica a la clienta", () => {
    expect(readDevicePass(createDevicePass(CUSTOMER)!)).toBe(CUSTOMER);
  });

  it("rechaza pases alterados o de otra clienta", () => {
    const pass = createDevicePass(CUSTOMER)!;
    const [, expiry, sig] = pass.split(".");
    expect(readDevicePass(`6a76aaceba5583d97ee1b626.${expiry}.${sig}`)).toBeNull();
    expect(readDevicePass(`${CUSTOMER}.${Number(expiry) + 1}.${sig}`)).toBeNull();
    expect(readDevicePass("basura")).toBeNull();
  });

  it("rechaza pases firmados con otra clave", () => {
    const pass = createDevicePass(CUSTOMER)!;
    vi.stubEnv("REWARDS_PASS_SECRET", "otra-clave");
    expect(readDevicePass(pass)).toBeNull();
  });

  it("los pases vencen", () => {
    const pass = createDevicePass(CUSTOMER)!;
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 181 * 24 * 60 * 60 * 1000);
    expect(readDevicePass(pass)).toBeNull();
  });

  it("sin clave configurada no emite pases", () => {
    vi.stubEnv("REWARDS_PASS_SECRET", "");
    expect(createDevicePass(CUSTOMER)).toBeNull();
  });
});
