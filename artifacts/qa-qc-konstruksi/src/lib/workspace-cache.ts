import type { QueryClient } from "@tanstack/react-query";

export const WORKSPACE_QUERY_KEY = ["/api/workspace"] as const;

export const WORKSPACE_QUERY_OPTIONS = {
  queryKey: WORKSPACE_QUERY_KEY,
  refetchInterval: 15_000,
  staleTime: 5_000,
  refetchOnWindowFocus: "always" as const,
};

export function refreshWorkspace(queryClient: Pick<QueryClient, "invalidateQueries">) {
  return queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_OPTIONS.queryKey });
}

export function workspaceMutationOptions(
  onSuccess: () => unknown,
  onError: (error: Error) => unknown,
) {
  return {
    create: { mutation: { onSuccess, onError } },
    update: { mutation: { onSuccess, onError } },
    remove: { mutation: { onSuccess, onError } },
    invite: { mutation: { onSuccess, onError } },
  };
}