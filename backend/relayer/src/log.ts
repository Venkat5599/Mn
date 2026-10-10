type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const min = ORDER[(process.env.LOG_LEVEL as Level) ?? "info"] ?? ORDER.info;

/** One JSON line per event, so a live session can be grepped and turned into README stats. */
function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < min) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};
