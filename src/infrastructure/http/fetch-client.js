import { DictBoxError } from '../../core/errors.js';

export async function fetchJson(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  if (externalSignal?.aborted) {
    throw new DictBoxError('REQUEST_ABORTED', 'Translation request was cancelled.', {
      cause: externalSignal.reason,
    });
  }

  let timedOut = false;
  let abortedExternally = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromExternal = () => {
    abortedExternally = true;
    controller.abort(externalSignal.reason);
  };
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      json: async () => JSON.parse(body),
      text: async () => body,
    };
  } catch (error) {
    if (abortedExternally || externalSignal?.aborted) {
      throw new DictBoxError('REQUEST_ABORTED', 'Translation request was cancelled.', {
        cause: error,
      });
    }
    if (timedOut) {
      throw new DictBoxError('REQUEST_TIMEOUT', 'Translation request timed out.', {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}
