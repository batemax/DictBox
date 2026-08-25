export const DEFAULT_SETTINGS = Object.freeze({
  provider: 'mymemory',
  useMockData: false,
  sourceLang: 'auto',
  targetLang: 'zh-CN',
  mymemoryEmail: '',
  microsoftRegion: '',
  openaiModel: 'gpt-5.6-luna',
  openaiBaseUrl: 'https://api.openai.com/v1',
  geminiModel: 'gemini-3.6-flash',
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  deepseekModel: 'deepseek-v4-flash',
  deepseekBaseUrl: 'https://api.deepseek.com',
  claudeModel: 'claude-sonnet-5',
  claudeBaseUrl: 'https://api.anthropic.com/v1',
  customModel: '',
  customBaseUrl: '',
  fallbackProvider: 'mymemory',
  enableFallback: true,
});

export const DEFAULT_SECRETS = Object.freeze({
  googleApiKey: '',
  microsoftApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  deepseekApiKey: '',
  claudeApiKey: '',
  customApiKey: '',
});

export const SENSITIVE_SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SECRETS));

export const PROVIDERS = Object.freeze([
  { id: 'mymemory', label: '免费查询', detail: '无需 API Key', kind: 'traditional' },
  { id: 'google', label: 'Google Translate', kind: 'traditional' },
  { id: 'microsoft', label: 'Microsoft Dictionary', kind: 'traditional' },
  { id: 'openai', label: 'ChatGPT / OpenAI', kind: 'llm' },
  { id: 'gemini', label: 'Gemini', kind: 'llm' },
  { id: 'deepseek', label: 'DeepSeek', kind: 'llm' },
  { id: 'claude', label: 'Claude', kind: 'llm' },
  { id: 'custom', label: '自定义服务商', kind: 'llm' },
]);

export const LANGUAGE_OPTIONS = Object.freeze([
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'it', label: '意大利语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'ru', label: '俄语' },
  { value: 'ar', label: '阿拉伯语' },
  { value: 'th', label: '泰语' },
  { value: 'zh-TW', label: '繁体中文' },
]);

export const LANGUAGE_LABELS = Object.freeze({
  auto: '自动检测',
  ...Object.fromEntries(LANGUAGE_OPTIONS.map(({ value, label }) => [value, label])),
});

export const isLlmProvider = (providerId) =>
  PROVIDERS.some((provider) => provider.id === providerId && provider.kind === 'llm');

export const LLM_MODEL_OPTIONS = Object.freeze({
  openai: Object.freeze([
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna（快速、低成本，默认）' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra（均衡）' },
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol（最高能力）' },
  ]),
  gemini: Object.freeze([
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash（默认）' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite（低成本）' },
  ]),
  deepseek: Object.freeze([
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（默认）' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ]),
  claude: Object.freeze([
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5（均衡，默认）' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5（快速）' },
    { value: 'claude-opus-5', label: 'Claude Opus 5（高能力）' },
    { value: 'claude-fable-5', label: 'Claude Fable 5（最高能力）' },
  ]),
});
