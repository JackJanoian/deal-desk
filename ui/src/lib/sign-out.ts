export function resolveSignOutRedirectPath(
  deploymentMode: "local_trusted" | "authenticated" | undefined,
): string {
  if (deploymentMode === "authenticated") {
    return `/auth?next=${encodeURIComponent("/onboarding")}`;
  }
  return "/onboarding";
}

/** Better Auth sign-out is only mounted in authenticated deployment mode. */
export function shouldCallAuthSignOutApi(
  deploymentMode: "local_trusted" | "authenticated" | undefined,
): boolean {
  return deploymentMode === "authenticated";
}

export function shouldOpenOnboardingWelcomeAfterSignOut(redirectPath: string): boolean {
  return redirectPath === "/onboarding";
}
