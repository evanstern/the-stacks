import { createBrowserRouter, redirect } from "react-router";

import { AppShell } from "@/components/app/app-shell";
import { logout } from "@/lib/api";
import { redirectToSession, requireAuth } from "@/lib/auth";
import { chatLoader, ChatRoute } from "@/routes/chat";
import { loginAction, loginLoader, LoginRoute } from "@/routes/login";
import { recordsLoader, RecordsRoute } from "@/routes/records";
import { UploadRoute } from "@/routes/upload";

function RedirectingRoute() {
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    loader: loginLoader,
    action: loginAction,
    element: <LoginRoute />,
  },
  {
    path: "/logout",
    action: async () => {
      await logout();
      throw redirect("/login");
    },
  },
  {
    element: <AppShell />,
    loader: requireAuth,
    children: [
      {
        path: "/",
        loader: redirectToSession,
        element: <RedirectingRoute />,
      },
      {
        path: "/chat/:sessionId",
        loader: chatLoader,
        element: <ChatRoute />,
      },
      {
        path: "/upload",
        loader: requireAuth,
        element: <UploadRoute />,
      },
      {
        path: "/records",
        loader: recordsLoader,
        element: <RecordsRoute />,
      },
    ],
  },
]);
