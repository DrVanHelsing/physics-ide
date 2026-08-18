import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../utils/api/client";

export const ME_KEY = ["auth", "me"];

/** null = signed out; object = the AuthUser. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const data = await api("/api/auth/me");
        return data.user;
      } catch (err) {
        if (err.status === 401) return null;
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
    onSuccess: (data) => qc.setQueryData(ME_KEY, data.user),
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
    mutationFn: () => api("/api/auth/signout", { method: "POST", body: {} }),
    onSuccess: () => qc.setQueryData(ME_KEY, null),
  });
}
