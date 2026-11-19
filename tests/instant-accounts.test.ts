import { afterEach, describe, expect, it, vi } from "vitest";
import { accountEmailAvailable, instantAccounts } from "../src/account-email";

afterEach(() => vi.unstubAllEnvs());

describe("instant (no-email) customer accounts", () => {
  it("are off unless explicitly enabled", () => {
    vi.stubEnv("SALUT_INSTANT_ACCOUNTS", "");
    expect(instantAccounts()).toBe(false);
  });
  it("work locally and in previews when enabled, and make registration available without a mail provider", () => {
    vi.stubEnv("SALUT_INSTANT_ACCOUNTS", "1");
    for (const env of ["", "preview"]) {
      vi.stubEnv("VERCEL_ENV", env);
      expect(instantAccounts()).toBe(true);
      expect(accountEmailAvailable()).toBe(true);
    }
  });
  it("are always ignored in production", () => {
    vi.stubEnv("SALUT_INSTANT_ACCOUNTS", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(instantAccounts()).toBe(false);
  });
});
