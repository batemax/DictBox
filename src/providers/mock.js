import { DictBoxError } from '../core/errors.js';
import { dictionaryResultToTranslations } from '../core/result-normalizer.js';

const WORDS = Object.freeze({
  world: Object.freeze({
    word: 'world',
    phonetic: '/wɜːrld/',
    entries: Object.freeze([
      Object.freeze({
        partOfSpeech: 'n.',
        meanings: Object.freeze(['世界；地球及其上的人类社会', '特定的活动领域或生活圈子']),
      }),
      Object.freeze({
        partOfSpeech: 'phrase',
        meanings: Object.freeze(['the world：全世界；世人']),
      }),
    ]),
    example: 'The discovery changed the way we understand the world.',
    exampleTranslation: '这项发现改变了我们理解世界的方式。',
  }),
  design: Object.freeze({
    word: 'design',
    phonetic: '/dɪˈzaɪn/',
    entries: Object.freeze([
      Object.freeze({
        partOfSpeech: 'n.',
        meanings: Object.freeze(['设计；构思；设计方案', '为特定目的安排事物的方式']),
      }),
      Object.freeze({
        partOfSpeech: 'v.',
        meanings: Object.freeze(['设计；规划；为特定用途而创造']),
      }),
    ]),
    example: 'Good design makes the intended action feel obvious.',
    exampleTranslation: '好的设计会让预期操作显得自然明确。',
  }),
  resilient: Object.freeze({
    word: 'resilient',
    phonetic: '/rɪˈzɪliənt/',
    entries: Object.freeze([
      Object.freeze({
        partOfSpeech: 'adj.',
        meanings: Object.freeze(['有复原力的；能迅速恢复的', '具有弹性、能承受压力的']),
      }),
    ]),
    example: 'The team built a resilient system that recovered quickly.',
    exampleTranslation: '团队构建了一个能够快速恢复的弹性系统。',
  }),
});

const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DictBoxError('REQUEST_ABORTED', '查询已取消。'));
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(new DictBoxError('REQUEST_ABORTED', '查询已取消。'));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export async function lookup(request, config = {}, context = {}) {
  await wait(config.mockDelayMs ?? 180, context.signal);
  const entry = WORDS[String(request.query ?? '').trim().toLocaleLowerCase()];
  if (!entry) {
    throw new DictBoxError(
      'NO_RESULT',
      '未找到该单词，Mock 词库支持 world、design 和 resilient。',
    );
  }

  const dictionary = {
    schemaVersion: '2.0',
    query: entry.word,
    word: entry.word,
    phonetic: entry.phonetic,
    sourceLanguage: request.sourceLanguage === 'auto' ? 'en' : request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    entries: entry.entries.map(({ partOfSpeech, meanings }) => ({
      partOfSpeech,
      meanings: [...meanings],
    })),
    example: entry.example,
    exampleTranslation: entry.exampleTranslation,
    provider: 'Mock',
    isMock: true,
  };

  return { ...dictionary, ...dictionaryResultToTranslations(dictionary) };
}

export { WORDS as MOCK_WORDS };
