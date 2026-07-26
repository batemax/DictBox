export function escapeXml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

export function formatSuggestions(result, query, { useMarkup = true } = {}) {
  if (!result?.translations?.length) {
    return [{
      content: `dictbox-no-result-${query}`,
      description: escapeXml(`[无结果] 未找到 "${query}" 的释义`),
    }];
  }

  return result.translations.slice(0, 8).map((translation, index) => {
    const pos = translation.pos ? `${escapeXml(translation.pos)} ` : '';
    const meaning = escapeXml(translation.meaning);
    return {
      content: `dictbox-result-${index}-${translation.meaning}`,
      description: useMarkup ? `${pos}<match>${meaning}</match>` : `${pos}${meaning}`,
    };
  });
}

export function formatFirefoxSummary(result, query) {
  if (!result?.translations?.length) {
    return escapeXml(`[无结果] 未找到 "${query}" 的释义`);
  }

  const groups = new Map();
  for (const translation of result.translations.slice(0, 6)) {
    const pos = translation.pos || '';
    const meanings = groups.get(pos) ?? [];
    meanings.push(translation.meaning);
    groups.set(pos, meanings);
  }

  return [...groups.entries()]
    .map(([pos, meanings]) => {
      const prefix = pos ? `${escapeXml(pos)} ` : '';
      return `${prefix}${meanings.map(escapeXml).join('、')}`;
    })
    .join('；');
}
