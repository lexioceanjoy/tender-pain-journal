import { providerConsentMetadataSchema, type AiProvider, type ProviderName } from './types.js';
import { openaiProvider } from './openaiProvider.js';
import { anthropicProvider } from './anthropicProvider.js';

const registry: Record<ProviderName, AiProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider
};

// Called once at server startup, before listen(). Throws — and the server
// refuses to boot — if any registered provider's consent metadata is
// incomplete. Never serves partial consent copy to a browser.
export function assertProviderRegistryIsConsentReady() {
  for (const provider of Object.values(registry)) {
    providerConsentMetadataSchema.parse(provider);
  }
}

// TENDER_AI_PROVIDER is read exactly once, here, at startup — never from
// request input (headers, query params, body). This is a security
// property, not just simplicity: a per-request provider selector would
// let a client influence where health data is routed.
export function resolveProvider(name: string | undefined): AiProvider {
  if (name !== 'openai' && name !== 'anthropic') {
    throw new Error("TENDER_AI_PROVIDER must be set to 'openai' or 'anthropic'.");
  }
  return registry[name];
}
