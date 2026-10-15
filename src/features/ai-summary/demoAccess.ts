// In-memory only, for the lifetime of this page load — never localStorage.
// Gates nothing client-side; it just rides along as a header so the
// deployed demo's serverless function can check it. Local dev's Express
// handler ignores this header entirely, so leaving it blank never breaks
// `npm run dev:ai`.
let demoPassphrase = '';

export function getDemoPassphrase(): string {
  return demoPassphrase;
}

export function setDemoPassphrase(value: string) {
  demoPassphrase = value;
}
