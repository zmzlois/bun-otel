export const isDebugEnabled =
  process.env.DEBUG === "true" ||
  process.env.DEBUG === "1" ||
  process.env.DEBUG?.startsWith("bun-otel") ||
  false;
