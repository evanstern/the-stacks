import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { AppState, AppStore } from "./app-store";
import { createAppStore } from "./app-store";

const AppStoreContext = createContext<AppStore | null>(null);

export interface AppStoreProviderProps {
  /** Called on any 401 from ask, upload, or jobs — the root's revalidate (plan D8). */
  onUnauthorized: () => void;
  children: ReactNode;
}

/**
 * Creates the store once per mount (plan D8) — pass `key={user.id}` at the
 * call site so a different signed-in user gets a fresh store instead of
 * inheriting the previous one's conversation.
 */
export function AppStoreProvider({
  onUnauthorized,
  children,
}: AppStoreProviderProps) {
  const [store] = useState(() => createAppStore({ onUnauthorized }));
  useEffect(() => () => store.dispose(), [store]);
  return (
    <AppStoreContext.Provider value={store}>
      {children}
    </AppStoreContext.Provider>
  );
}

/** The store instance itself — stable, for calling its actions. */
export function useAppStoreHandle(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStoreHandle must be used within AppStoreProvider");
  }
  return store;
}

/** A reactive slice of state (plan D8) — the server snapshot equals the initial state. */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useAppStoreHandle();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
