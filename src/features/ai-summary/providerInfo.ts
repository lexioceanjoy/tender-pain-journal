export type ProviderInfo = {
  provider: 'openai' | 'anthropic';
  displayName: string;
  privacyNoticeUrl: string;
  retentionSummary: string;
  ready: boolean;
};

// Shown when the fetch fails or returns something unexpected. Never names
// a specific provider here — guessing wrong would show a stale/wrong
// vendor name, which is worse than a generic message. ready: false keeps
// Generate disabled until a real, successful fetch says otherwise.
export const FALLBACK_PROVIDER_INFO: ProviderInfo = {
  provider: 'openai',
  displayName: 'the configured AI provider',
  privacyNoticeUrl: '',
  retentionSummary: '',
  ready: false
};

function isProviderInfo(value: unknown): value is ProviderInfo {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.provider === 'openai' || candidate.provider === 'anthropic') &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.privacyNoticeUrl === 'string' &&
    typeof candidate.retentionSummary === 'string' &&
    typeof candidate.ready === 'boolean'
  );
}

export async function fetchProviderInfo(): Promise<ProviderInfo> {
  try {
    const response = await fetch('/api/ai-provider-info');
    if (!response.ok) return FALLBACK_PROVIDER_INFO;
    const data = await response.json();
    return isProviderInfo(data) ? data : FALLBACK_PROVIDER_INFO;
  } catch {
    return FALLBACK_PROVIDER_INFO;
  }
}
