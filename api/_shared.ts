import { resolveActiveProviderConfig, type ActiveProviderConfig } from '../server/app.js';

// Vercel injects env vars directly into process.env — there is no
// .env.local file to read on the deployed function. resolveActiveProviderConfig
// itself is untouched; only the env source differs from local dev.
// Never throws: a misconfigured provider must become a clean JSON error at
// request time, not an unhandled exception that leaks a raw stack trace.
export function resolveActiveConfigSafely(): ActiveProviderConfig | undefined {
  try {
    return resolveActiveProviderConfig(process.env as Record<string, string>);
  } catch {
    return undefined;
  }
}
