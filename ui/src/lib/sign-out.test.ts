import { describe, expect, it } from "vitest";
import {
  resolveSignOutRedirectPath,
  shouldCallAuthSignOutApi,
  shouldOpenOnboardingWelcomeAfterSignOut,
} from "./sign-out";

describe("resolveSignOutRedirectPath", () => {
  it("routes authenticated sign-out through auth with onboarding as next", () => {
    expect(resolveSignOutRedirectPath("authenticated")).toBe("/auth?next=%2Fonboarding");
  });

  it("routes local sign-out directly to onboarding", () => {
    expect(resolveSignOutRedirectPath("local_trusted")).toBe("/onboarding");
  });

  it("defaults to onboarding when deployment mode is unknown", () => {
    expect(resolveSignOutRedirectPath(undefined)).toBe("/onboarding");
  });
});

describe("shouldCallAuthSignOutApi", () => {
  it("calls Better Auth sign-out only in authenticated mode", () => {
    expect(shouldCallAuthSignOutApi("authenticated")).toBe(true);
    expect(shouldCallAuthSignOutApi("local_trusted")).toBe(false);
    expect(shouldCallAuthSignOutApi(undefined)).toBe(false);
  });
});

describe("shouldOpenOnboardingWelcomeAfterSignOut", () => {
  it("opens onboarding welcome for direct onboarding redirects", () => {
    expect(shouldOpenOnboardingWelcomeAfterSignOut("/onboarding")).toBe(true);
    expect(shouldOpenOnboardingWelcomeAfterSignOut("/auth?next=%2Fonboarding")).toBe(false);
  });
});
