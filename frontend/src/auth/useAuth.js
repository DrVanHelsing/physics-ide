import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../utils/api/client";
import {
  flushPendingSyncBeforeSignOut,
  clearCloudProjectsAfterSignOut,
} from "../utils/sync/signOutCleanup";
import { SIGNED_IN_HINT_KEY } from "../constants";

export const ME_KEY = ["auth", "me"];

/** null = signed out; object = the AuthUser. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const data = await api("/api/auth/me");
        if (data.user) localStorage.setItem(SIGNED_IN_HINT_KEY, "1");
        return data.user;
      } catch (err) {
        if (err.status === 401) {
          localStorage.removeItem(SIGNED_IN_HINT_KEY);
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useSignin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api("/api/auth/signin", { method: "POST", body }),
    onSuccess: (data) => {
      localStorage.setItem(SIGNED_IN_HINT_KEY, "1");
      qc.setQueryData(ME_KEY, data.user);
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (body) => api("/api/auth/signup", { method: "POST", body }),
  });
}

export function useSignout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Push anything still parked while the session cookie is valid — after
      // the request below it would 401. Never throws, never blocks sign-out.
      // The departing user's id is snapshotted HERE so the flush stamps meta
      // for them, not for whoever signs in next.
      const departingId = qc.getQueryData(ME_KEY)?.id ?? null;
      await flushPendingSyncBeforeSignOut(departingId);
      return api("/api/auth/signout", { method: "POST", body: {} });
    },
    onSuccess: async () => {
      localStorage.removeItem(SIGNED_IN_HINT_KEY);
      qc.setQueryData(ME_KEY, null);
      // Cloud-pulled projects must not outlive the session on a shared
      // computer (final review F3). Guest-era work stays put.
      await clearCloudProjectsAfterSignOut();
    },
  });
}
