import * as claude from './claude.js';
import * as custom from './custom.js';
import * as deepseek from './deepseek.js';
import * as gemini from './gemini.js';
import * as google from './google.js';
import * as microsoft from './microsoft.js';
import * as mymemory from './mymemory.js';
import * as mock from './mock.js';
import * as openai from './openai.js';

const providers = {
  mock,
  mymemory,
  google,
  microsoft,
  openai,
  gemini,
  deepseek,
  claude,
  custom,
};

export async function lookupWithProvider(providerId, request, config, context) {
  const provider = providers[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  return provider.lookup(request, config, context);
}
