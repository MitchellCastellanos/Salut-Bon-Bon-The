import { afterEach, describe, expect, it, vi } from "vitest";
import { accountEmailAvailable, instantAccounts } from "../src/account-email";

afterEach(() => vi.unstubAllEnvs());

describe("instant (no-email) customer accounts", () => {
  it("are off unless explicitly enabled", () => {
    vi.stubEnv("SALUT_INSTANT_ACCOUNTS", "");
    expect(instantAccounts()).toBe(false);
  });
  it("work in every environment when explicitly enabled, and make registration available without a mail provider", () => {
    vi.stubEnv("SALUT_INSTANT_ACCOUNTS", "1");
    for (const env of ["", "preview", "production"]) {
      vi.stubEnv("VERCEL_ENV", env);
      expect(instantAccounts()).toBe(true);
      expect(accountEmailAvailable()).toBe(true);
    }
  });
});
