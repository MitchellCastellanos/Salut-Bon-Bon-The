import { afterEach, expect, it, vi } from "vitest";
import { demoStorageAllowed } from "../src/db";

afterEach(() => vi.unstubAllEnvs());

it("never falls back to embedded demo storage in deployed environments", () => {
  expect(demoStorageAllowed()).toBe(true);
  for (const env of ["production", "preview"]) {
    vi.stubEnv("VERCEL_ENV", env);
    expect(demoStorageAllowed()).toBe(false);
  }
  vi.stubEnv("SALUT_ALLOW_DEMO", "1");
  expect(demoStorageAllowed()).toBe(true);
});
