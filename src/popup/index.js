import api from '../browser/webextension-api.js';
import { formatDictionaryText } from '../core/dictionary-view.js';
import {
  addHistory,
  clearHistory,
  getHistory,
  removeHistory,
  setHistory,
} from '../infrastructure/history/history-repository.js';
import { loadSettings } from '../infrastructure/settings/settings-repository.js';
import { isLlmProvider } from '../shared/settings.js';
import { element, renderCompactResult, renderStatus } from '../ui/dom.js';

const form = document.getElementById('lookup-form');
const input = document.getElementById('lookup-input');
const submit = document.getElementById('lookup-submit');
const status = document.getElementById('lookup-status');
const historyList = document.getElementById('history-list');
const clearHistoryButton = document.getElementById('clear-history');
const historyFeedback = document.getElementById('history-feedback');

let lastQuery = '';
let lookupVersion = 0;

function replaceStatus(node) {
  status.replaceChildren(node);
}

function loadingPanel() {
  return element('div', {
    className: 'status-panel',
    attributes: { 'aria-label': '正在查询' },
  }, [
    element('strong', { text: `正在查询“${lastQuery}”…` }),
    element('div', { className: 'loading-lines' }, [
      element('span', { className: 'loading-line' }),
      element('span', { className: 'loading-line' }),
      element('span', { className: 'loading-line' }),
    ]),
  ]);
}

async function showInitial() {
  const settings = await loadSettings();
  if (settings.useMockData) {
    replaceStatus(renderStatus({
      title: 'Mock 数据已开启',
      message: '可查询 world、design 或 resilient，全程不发送网络请求。',
    }).panel);
    return;
  }
  const key = settings[`${settings.provider}ApiKey`];
  if (isLlmProvider(settings.provider) && !key) {
    const { panel, action } = renderStatus({
      title: '先完成一次配置',
      message: '添加 API Key 并选择语言后即可查询。',
      actionLabel: '前往设置',
    });
    action.addEventListener('click', () => api.runtime.openOptionsPage());
    replaceStatus(panel);
    return;
  }
  status.replaceChildren();
}

async function renderHistory() {
  const history = await getHistory();
  clearHistoryButton.hidden = history.length === 0;
  if (history.length === 0) {
    historyList.replaceChildren(element('p', {
      className: 'empty-copy',
      text: '查询过的单词会保存在本地，最多显示 5 条。',
    }));
    return;
  }
  historyList.replaceChildren(...history.map((word) => {
    const button = element('button', {
      className: 'history-chip',
      text: word,
      attributes: { type: 'button' },
    });
    button.addEventListener('click', () => {
      input.value = word;
      void runQuery(word);
    });
    const remove = element('button', {
      className: 'history-remove',
      text: '×',
      attributes: { type: 'button', 'aria-label': `删除查询记录 ${word}` },
    });
    remove.addEventListener('click', async () => {
      await removeHistory(word);
      await renderHistory();
    });
    return element('div', { className: 'history-item' }, [button, remove]);
  }));
}

async function runQuery(value) {
  const query = String(value ?? '').trim();
  if (!query) {
    replaceStatus(renderStatus({
      title: '请输入查询内容',
      message: '输入一个单词或短语后再查询。',
      type: 'error',
    }).panel);
    input.focus();
    return;
  }

  lastQuery = query;
  const currentLookup = ++lookupVersion;
  submit.disabled = true;
  submit.textContent = '查询中';
  replaceStatus(loadingPanel());

  try {
    const response = await api.runtime.sendMessage({ type: 'dictbox:lookup', query });
    if (currentLookup !== lookupVersion) return;
    if (!response?.ok) throw Object.assign(new Error(response?.error?.message), response?.error);
    const { node, view } = renderCompactResult(response.result, query);
    const actions = element('div', { className: 'result-actions' });
    const fullResult = element('button', {
      className: 'text-link',
      text: '查看完整释义',
      attributes: { type: 'button' },
    });
    fullResult.addEventListener('click', () => {
      const url = api.runtime.getURL(`result.html?word=${encodeURIComponent(view.word)}`);
      void api.tabs.create({ url });
    });
    const copy = element('button', {
      className: 'quiet-button',
      text: '复制释义',
      attributes: { type: 'button' },
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(formatDictionaryText(view));
        copy.textContent = '已复制';
        setTimeout(() => { copy.textContent = '复制释义'; }, 1600);
      } catch {
        copy.textContent = '复制不可用';
      }
    });
    actions.append(fullResult, copy);
    node.append(actions);
    replaceStatus(node);
    await addHistory(view.word || query);
    await renderHistory();
  } catch (error) {
    if (currentLookup !== lookupVersion) return;
    const { panel, action } = renderStatus({
      title: error.code === 'NO_RESULT' ? '未找到这个单词' : '查询失败',
      message: error.message || '请稍后重试。',
      type: 'error',
      actionLabel: error.code === 'MISSING_API_KEY' ? '前往设置' : '重试',
    });
    action.addEventListener('click', () => {
      if (error.code === 'MISSING_API_KEY') void api.runtime.openOptionsPage();
      else void runQuery(lastQuery);
    });
    replaceStatus(panel);
  } finally {
    if (currentLookup === lookupVersion) {
      submit.disabled = false;
      submit.textContent = '查询';
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void runQuery(input.value);
});

document.getElementById('clear-input').addEventListener('click', () => {
  lookupVersion += 1;
  input.value = '';
  document.getElementById('clear-input').hidden = true;
  input.focus();
  void showInitial();
});

document.getElementById('open-settings').addEventListener('click', () => {
  void api.runtime.openOptionsPage();
});

clearHistoryButton.addEventListener('click', async () => {
  const previous = await getHistory();
  await clearHistory();
  await renderHistory();
  const undo = element('button', {
    className: 'text-link',
    text: '撤销',
    attributes: { type: 'button' },
  });
  undo.addEventListener('click', async () => {
    await setHistory(previous);
    historyFeedback.replaceChildren();
    await renderHistory();
  });
  historyFeedback.replaceChildren(element('span', { text: '最近查询已清空。' }), undo);
});

input.addEventListener('input', () => {
  document.getElementById('clear-input').hidden = !input.value;
});

void Promise.all([showInitial(), renderHistory()]);
document.getElementById('clear-input').hidden = true;
input.focus();
