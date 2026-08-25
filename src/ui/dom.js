import {
  languageLabel,
  partLabel,
  toDictionaryView,
} from '../core/dictionary-view.js';

export function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}

function definitionSection(entry, index, full = false) {
  const list = element(full ? 'ol' : 'ul', { className: full ? '' : 'definition-list' },
    entry.meanings.map((meaning) => element('li', { text: meaning })),
  );
  const heading = element(full ? 'h3' : 'p', {
    className: full ? '' : 'part-label',
    text: partLabel(entry.partOfSpeech),
  });
  return element('section', {
    className: full ? 'result-definition' : 'definition-group',
    attributes: { 'data-entry-index': index },
  }, [heading, list]);
}

function exampleCard(view) {
  if (!view.example && !view.exampleTranslation) return null;
  return element('div', { className: 'example' }, [
    view.example ? element('p', { text: view.example, attributes: { lang: 'en' } }) : null,
    view.exampleTranslation
      ? element('p', { className: 'translation', text: view.exampleTranslation })
      : null,
  ]);
}

function compactEntries(entries, maxGroups = 2, maxMeanings = 5) {
  const visible = [];
  let remaining = maxMeanings;
  for (const entry of entries.slice(0, maxGroups)) {
    if (remaining <= 0) break;
    const meanings = entry.meanings.slice(0, remaining);
    if (meanings.length) visible.push({ ...entry, meanings });
    remaining -= meanings.length;
  }
  const total = entries.reduce((sum, entry) => sum + entry.meanings.length, 0);
  const shown = visible.reduce((sum, entry) => sum + entry.meanings.length, 0);
  return { visible, hiddenCount: Math.max(0, total - shown) };
}

export function renderCompactResult(result, query) {
  const view = toDictionaryView(result, query);
  const compact = compactEntries(view.entries);
  const badge = element('span', {
    className: 'compact-tag',
    text: view.isMock ? 'Mock 数据' : view.provider,
  });
  const compactMeta = element('div', { className: 'compact-meta' }, [
    badge,
    element('span', {
      className: 'compact-tag',
      text: `${languageLabel(view.sourceLanguage)} → ${languageLabel(view.targetLanguage)}`,
    }),
  ]);
  const titleGroup = element('div', {}, [
    element('h2', { className: 'popup-word', text: view.word }),
    view.phonetic ? element('div', { className: 'phonetic', text: view.phonetic }) : null,
  ]);
  const article = element('article', { className: 'definition-card' }, [
    element('div', { className: 'word-row' }, [titleGroup, compactMeta]),
    ...compact.visible.map((entry, index) => definitionSection(entry, index)),
    compact.hiddenCount
      ? element('p', { className: 'more-definitions', text: `还有 ${compact.hiddenCount} 条释义` })
      : null,
  ]);
  return { node: article, view };
}

export function renderFullResult(result, query) {
  const view = toDictionaryView(result, query);
  const languagePair = element('span', {
    className: 'language-pair',
    text: `${languageLabel(view.sourceLanguage)} → ${languageLabel(view.targetLanguage)}`,
  });
  const heading = element('div', { className: 'result-heading' }, [
    element('div', { className: 'result-title-block' }, [
      element('p', {
        className: 'eyebrow',
        text: view.isMock ? '完整释义 · Mock 数据' : '完整释义',
      }),
      element('h1', { className: 'result-word', text: view.word }),
      element('div', { className: 'result-meta' }, [
        view.phonetic ? element('span', { text: view.phonetic }) : null,
        element('span', { className: 'compact-tag', text: view.provider || '查询服务' }),
        languagePair,
      ]),
    ]),
  ]);
  const definitions = element('section', { className: 'result-section' }, [
    element('h2', { text: '常用释义' }),
    ...view.entries.map((entry, index) => definitionSection(entry, index, true)),
  ]);
  const example = exampleCard(view);
  const examples = example
    ? element('section', { className: 'result-section' }, [
        element('h2', { text: '例句' }),
        example,
      ])
    : null;
  const body = element('div', { className: 'result-content' }, [
    element('div', {}, [definitions, examples]),
  ]);
  return { node: element('div', {}, [heading, body]), view, heading };
}

export function renderStatus({ title, message, type = '', actionLabel = '' }) {
  const panel = element('div', { className: `status-panel ${type}`.trim() }, [
    element('strong', { text: title }),
    message ? element('p', { text: message }) : null,
  ]);
  let action = null;
  if (actionLabel) {
    action = element('button', {
      className: type === 'error' ? 'ghost-button' : 'text-link',
      text: actionLabel,
      attributes: { type: 'button' },
    });
    panel.append(action);
  }
  return { panel, action };
}
