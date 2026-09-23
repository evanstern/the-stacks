import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, signIn, signOut, type User } from "./api";

/** Exported so ws/useSession.ts can flip identity to signed-out on a 401 (FR-014). */
export const identityKey = ["identity"] as const;

/** The one place identity is read from (D3) — never a stored copy. */
export function useIdentity() {
  return useQuery({ queryKey: identityKey, queryFn: fetchMe, retry: false });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => signIn(username, password),
    onSuccess: (user: User) => {
      queryClient.setQueryData(identityKey, user);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(identityKey, null);
    },
  });
}
