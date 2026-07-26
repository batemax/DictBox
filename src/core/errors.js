export class DictBoxError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'DictBoxError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

export function providerError(response, provider, detail = '') {
  if (response.status === 401 || response.status === 403) {
    return new DictBoxError(
      'AUTHENTICATION_FAILED',
      `${provider} authentication failed${detail ? `: ${detail}` : '.'}`,
      { retryable: /\bgovernor\b/iu.test(detail) },
    );
  }
  if (response.status === 429) {
    return new DictBoxError('RATE_LIMITED', `${provider} rate limit exceeded.`);
  }
  return new DictBoxError(
    'PROVIDER_UNAVAILABLE',
    `${provider} request failed (${response.status})${detail ? `: ${detail}` : '.'}`,
  );
}
