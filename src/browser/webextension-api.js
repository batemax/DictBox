const extensionApi = globalThis.browser ?? globalThis.chrome;

if (!extensionApi) {
  throw new Error('WebExtensions API is unavailable.');
}

export default extensionApi;
