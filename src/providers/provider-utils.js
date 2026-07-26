import { DictBoxError, providerError } from '../core/errors.js';

export async function readProviderJson(response, provider) {
  if (!response.ok) {
    let detail = '';
    const textResponse = typeof response.clone === 'function' ? response.clone() : response;
    try {
      const body = await response.json();
      detail = body?.error?.message ?? body?.message ?? '';
    } catch {
      try {
        detail = await textResponse.text();
      } catch {
        // Ignore unreadable error bodies.
      }
    }
    throw providerError(
      response,
      provider,
      typeof detail === 'string' ? detail.replace(/\s+/gu, ' ').trim().slice(0, 160) : '',
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new DictBoxError('PROVIDER_UNAVAILABLE', `${provider} returned invalid JSON.`, {
      cause: error,
    });
  }
}

export function requireApiKey(apiKey, provider) {
  if (!apiKey) {
    throw new DictBoxError('MISSING_API_KEY', `${provider} API Key is required.`);
  }
}
