import type { StacksLoadContext } from "@the-stacks/shared";
import { createContext } from "react-router";

/** The load-context key (plan D2, D5) — key identity matters, so it's created once here. */
export const stacksContext = createContext<StacksLoadContext>();
