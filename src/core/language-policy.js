export function detectSourceLanguage(text) {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\uac00-\ud7af\u1100-\u11ff]/u.test(text)) return 'ko';
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/u.test(text)) return 'zh-CN';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
  if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
  if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
  return 'auto';
}

export function resolveLanguagePair(text, targetLanguage = 'zh-CN') {
  const from = detectSourceLanguage(text);
  let to = targetLanguage;

  if (from === to || (from === 'zh-CN' && ['zh-CN', 'zh-TW'].includes(to))) {
    to = 'en';
  }

  return { from, to };
}
