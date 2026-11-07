// Shared hub script: nav bar + a small layered-graph SVG renderer. No dependencies.
(function () {
  const pages = [
    ["index.html", "Briefing"], ["goals-to-architecture.html", "Goals → architecture"], ["play-ux.html", "Play UX"],
    ["vtt.html", "VTT"], ["campaign-tools.html", "Campaign tools"], ["architecture.html", "Architecture"],
    ["plan.html", "Plan"], ["board.html", "Board"], ["decisions.html", "Decisions"],
  ];
  const here = location.pathname.split("/").pop() || "index.html";
  const nav = document.createElement("header");
  nav.className = "top";
  nav.innerHTML = '<nav aria-label="Hub pages"><a class="home" href="index.html">← Replan 2026-11 hub</a>' +
    pages.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ""}>${t}</a>`).join("") + "</nav>";
  document.body.prepend(nav);
})();

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/**
 * Draw a left-to-right layered graph.
 * cols: [{title, nodes:[{id, label, sub?, color?}]}]; edges: [[fromId, toId]].
 * Hovering or focusing a node highlights everything upstream and downstream of it.
 */
function layered(host, cols, edges, opt = {}) {
  const W = opt.width || 1280, nodeW = opt.nodeW || 190, nodeH = opt.nodeH || 44, gap = opt.gap || 12, top = 40;
  const maxN = Math.max(...cols.map(c => c.nodes.length));
  const H = top + maxN * (nodeH + gap) + 10;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.label || "diagram" });
  const colX = i => 10 + i * ((W - nodeW - 20) / (cols.length - 1));
  const pos = {};
  cols.forEach((c, i) => {
    const t = el("text", { x: colX(i) + nodeW / 2, y: 22, "text-anchor": "middle", "font-size": 15, "font-weight": 700, class: "mute" }, svg);
    t.textContent = c.title;
    const colH = c.nodes.length * (nodeH + gap);
    const y0 = top + (maxN * (nodeH + gap) - colH) / 2;
    c.nodes.forEach((n, j) => (pos[n.id] = { x: colX(i), y: y0 + j * (nodeH + gap), n }));
  });
  const gEdges = el("g", {}, svg), gNodes = el("g", {}, svg);
  const paths = edges.filter(([a, b]) => pos[a] && pos[b]).map(([a, b]) => {
    const p = pos[a], q = pos[b];
    const x1 = p.x + nodeW, y1 = p.y + nodeH / 2, x2 = q.x, y2 = q.y + nodeH / 2, mx = (x1 + x2) / 2;
    const path = el("path", { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, fill: "none", stroke: "var(--border)", "stroke-width": 1.6 }, gEdges);
    return { a, b, path };
  });
  const rects = {};
  for (const id in pos) {
    const { x, y, n } = pos[id];
    const g = el("g", { tabindex: 0, style: "cursor:pointer" }, gNodes);
    const r = el("rect", { x, y, width: nodeW, height: nodeH, rx: 8, fill: n.fill || "var(--card)", stroke: n.color || "var(--primary)", "stroke-width": 2 }, g);
    const t = el("text", { x: x + 10, y: y + (n.sub ? 18 : 27), "font-size": 14, "font-weight": 600 }, g);
    t.textContent = n.label;
    if (n.sub) { const s = el("text", { x: x + 10, y: y + 35, "font-size": 12, class: "mute" }, g); s.textContent = n.sub; }
    const title = el("title", {}, g); title.textContent = n.tip || n.label;
    rects[id] = { g, r };
    const on = () => highlight(id), off = () => highlight(null);
    g.addEventListener("mouseenter", on); g.addEventListener("focus", on);
    g.addEventListener("mouseleave", off); g.addEventListener("blur", off);
  }
  function reach(id, dir) {
    const seen = new Set([id]), stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of paths) {
        const [from, to] = dir > 0 ? [e.a, e.b] : [e.b, e.a];
        if (from === cur && !seen.has(to)) { seen.add(to); stack.push(to); }
      }
    }
    return seen;
  }
  function highlight(id) {
    const live = id ? new Set([...reach(id, 1), ...reach(id, -1)]) : null;
    for (const e of paths) {
      const hot = live && live.has(e.a) && live.has(e.b);
      e.path.setAttribute("stroke", hot ? "var(--primary)" : "var(--border)");
      e.path.setAttribute("stroke-width", hot ? 3 : 1.6);
      e.path.style.opacity = live && !hot ? 0.25 : 1;
    }
    for (const k in rects) rects[k].g.style.opacity = live && !live.has(k) ? 0.3 : 1;
  }
  host.appendChild(svg);
}
