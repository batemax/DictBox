import api from '../browser/webextension-api.js';
import { formatDictionaryText } from '../core/dictionary-view.js';
import { addHistory } from '../infrastructure/history/history-repository.js';
import { element, renderFullResult, renderStatus } from '../ui/dom.js';

const status = document.getElementById('result-status');
const content = document.getElementById('result-content');
const searchForm = document.getElementById('result-search');
const searchInput = document.getElementById('result-query');

let loadVersion = 0;

function currentQuery() {
  return new URLSearchParams(location.search).get('word')?.trim() || '';
}

function showEmptyState() {
  loadVersion += 1;
  document.title = '查词 · DictBox';
  status.replaceChildren();
  content.replaceChildren(element('p', {
    className: 'result-empty-copy',
    text: '输入内容开始查询；支持中英双向和多语言翻译。',
  }));
  searchInput.value = '';
  searchInput.focus();
}

async function loadResult(term) {
  const query = String(term ?? '').trim();
  if (!query) {
    showEmptyState();
    return;
  }

  const currentLoad = ++loadVersion;
  searchInput.value = query;
  document.title = `${query} · DictBox`;
  status.replaceChildren(renderStatus({
    title: `正在查询“${query}”…`,
    message: '正在准备完整释义。',
  }).panel);
  content.replaceChildren();

  try {
    const response = await api.runtime.sendMessage({ type: 'dictbox:lookup', query });
    if (currentLoad !== loadVersion) return;
    if (!response?.ok) throw Object.assign(new Error(response?.error?.message), response?.error);
    const rendered = renderFullResult(response.result, query);
    const copy = element('button', {
      className: 'ghost-button',
      text: '复制释义',
      attributes: { type: 'button' },
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(formatDictionaryText(rendered.view));
        copy.textContent = '已复制';
        setTimeout(() => { copy.textContent = '复制释义'; }, 1600);
      } catch {
        copy.textContent = '复制不可用';
      }
    });
    rendered.heading.append(element('div', { className: 'result-heading-actions' }, [copy]));
    content.replaceChildren(rendered.node);
    status.replaceChildren();
    await addHistory(rendered.view.word || query);
  } catch (error) {
    if (currentLoad !== loadVersion) return;
    const { panel, action } = renderStatus({
      title: error.code === 'NO_RESULT' ? `未找到“${query}”` : '查询失败',
      message: error.message || '请稍后重试。',
      type: 'error',
      actionLabel: error.code === 'MISSING_API_KEY' ? '前往设置' : '重试',
    });
    action.addEventListener('click', () => {
      if (error.code === 'MISSING_API_KEY') void api.runtime.openOptionsPage();
      else void loadResult(query);
    });
    status.replaceChildren(panel);
  }
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const next = searchInput.value.trim();
  if (!next) {
    searchInput.focus();
    return;
  }
  history.pushState(null, '', `result.html?word=${encodeURIComponent(next)}`);
  void loadResult(next);
});

window.addEventListener('popstate', () => {
  void loadResult(currentQuery());
});

document.getElementById('result-settings').addEventListener('click', () => {
  void api.runtime.openOptionsPage();
});

void loadResult(currentQuery());
