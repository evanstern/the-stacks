// Paste into mcp__Claude_Browser__javascript_tool on the signed-in hosted-dev page.
// Replace SESSION and the cursors. The page's own cookie authenticates; no token is handled.
// Returns { events, jobs, calls, totals } for `node watch.mjs --input <file>`.
(async () => {
  const SESSION = "<session-uuid>";
  const get = async (p) => (await fetch(`/dm/sessions/${SESSION}/${p}`, { credentials: "same-origin" })).json();
  const events = [], calls = [];
  let totals;
  for (let a = 0, more = true; more; ) { const r = await get(`events?after=${a}&limit=1000`); events.push(...r.events); a = r.nextAfter; more = r.hasMore; }
  for (let a = 0, more = true; more; ) { const r = await get(`calls?after=${a}&limit=1000`); calls.push(...r.calls); a = r.nextAfter; more = r.hasMore; totals = r.totals; }
  const jobs = (await get("jobs?limit=200")).jobs;
  return JSON.stringify({ events, jobs, calls, totals });
})()
