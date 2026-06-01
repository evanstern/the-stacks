import { Outlet } from "react-router";

import { TopNav } from "./top-nav";

export function AppShell() {
  return (
    <div className="app-shell">
      <TopNav />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
