import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("ask", "routes/ask.tsx"),
  route("books", "routes/books.tsx"),
  route("play", "routes/table.tsx"),
  route("play/:sessionId", "routes/play.tsx"),
  route("about", "routes/about.tsx"),
  route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
