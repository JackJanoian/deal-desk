import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { authApi } from "@/api/auth";
import { healthApi } from "@/api/health";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { useDialogActions } from "@/context/DialogContext";
import {
  resolveSignOutRedirectPath,
  shouldCallAuthSignOutApi,
  shouldOpenOnboardingWelcomeAfterSignOut,
} from "@/lib/sign-out";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearSelectedCompanyId } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    staleTime: Infinity,
  });

  return useMutation({
    mutationFn: async () => {
      if (shouldCallAuthSignOutApi(health?.deploymentMode)) {
        await authApi.signOut();
      }
    },
    onSuccess: async () => {
      clearSelectedCompanyId();
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      const redirectPath = resolveSignOutRedirectPath(health?.deploymentMode);
      navigate(redirectPath, { replace: true });
      if (shouldOpenOnboardingWelcomeAfterSignOut(redirectPath)) {
        openOnboarding({ initialStep: 1 });
      }
    },
  });
}
