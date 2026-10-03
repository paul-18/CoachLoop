/** Keep the original database for existing CoachLoop users; isolate additional copies. */
export function localScopeSuffix() {
  const path = typeof window !== "undefined" && window.location ? window.location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") : "";
  return !path || path === "/CoachLoop" ? "" : `:${path}`;
}
