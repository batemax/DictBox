# DictBox 系统设计文档

> **文档版本**: v1.0.0  
> **最后更新**: 2026-03-08  
> **状态**: ✅ v1.0 已实现

---

## 1. 系统概览

### 1.1 技术栈

| 层次 | 技术 |
|------|------|
| **运行平台** | Chrome Extension (Manifest V3) |
| **编程语言** | JavaScript (ES Modules) |
| **后台进程** | Service Worker (`background.js`) |
| **存储** | `chrome.storage.sync` (设置) + `chrome.storage.local` (缓存) |
| **UI** | HTML + Vanilla CSS (Glassmorphism 主题) |
| **外部 API** | MyMemory / Google Translate v2 / Microsoft Translator v3 |
| **构建工具** | 无（零依赖，无需构建） |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Browser                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Omnibox (地址栏)                       │   │
│  │  用户输入: db + 空格 + 查询词                        │   │
│  └─────────────────────┬────────────────────────────┘   │
│                        │                                 │
│                        ▼                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │          background.js (Service Worker)            │   │
│  │                                                    │   │
│  │  ┌─────────┐  ┌───────────┐  ┌────────────────┐  │   │
│  │  │ Omnibox │  │ Debounce  │  │ Language        │  │   │
│  │  │ Handler │─▶│ (600ms)   │─▶│ Detection       │  │   │
│  │  └─────────┘  └───────────┘  └────────┬───────┘  │   │
│  │                                        │          │   │
│  │  ┌─────────────────────────────────────┤          │   │
│  │  │                                     │          │   │
│  │  ▼                                     ▼          │   │
│  │  ┌─────────┐  (miss)  ┌────────────────────────┐ │   │
│  │  │   LRU   │─────────▶│   Provider Factory     │ │   │
│  │  │  Cache  │          │   (providers/index.js)  │ │   │
│  │  │ (200条) │◀─────────│                        │ │   │
│  │  └────┬────┘ (write)  └───┬────────┬────────┬──┘ │   │
│  │       │                   │        │        │     │   │
│  │       ▼                   ▼        ▼        ▼     │   │
│  │  ┌─────────┐         ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │  │Persistent│        │MyMem │ │Google│ │MS    │  │   │
│  │  │  Cache   │        │ory   │ │Trans │ │Dict  │  │   │
│  │  │ (500条)  │        │(free)│ │late  │ │ionary│  │   │
│  │  └─────────┘        └──────┘ └──────┘ └──────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         options.html (设置页面)                     │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │  chrome.storage.sync                      │    │   │
│  │  │  ┌─────────┬──────────┬───────────────┐  │    │   │
│  │  │  │provider │targetLang│ apiKeys       │  │    │   │
│  │  │  └─────────┴──────────┴───────────────┘  │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
              ┌───────────────────────┐
              │    External APIs       │
              │                       │
              │  • api.mymemory.      │
              │    translated.net     │
              │  • translation.       │
              │    googleapis.com     │
              │  • api.cognitive.     │
              │    microsofttranslator│
              │    .com               │
              └───────────────────────┘
```

---

## 2. 模块设计

### 2.1 模块依赖关系

```
background.js
    │
    ├── providers/index.js      (Provider 工厂 + Fallback)
    │       ├── providers/mymemory.js
    │       ├── providers/google.js
    │       └── providers/microsoft.js
    │
    └── chrome.storage (设置 + 缓存)

options.js
    └── chrome.storage.sync (读写设置)
```

### 2.2 各模块职责

#### `background.js` — 核心控制器

| 组件 | 职责 | 关键参数 |
|------|------|----------|
| `LRUCache` | 内存缓存，基于 `Map` 的 LRU 淘汰 | maxSize = 200 |
| `loadSettings()` | 从 `chrome.storage.sync` 加载用户配置 | — |
| `detectSourceLang()` | Unicode 范围启发式语言检测 | 支持 CJK/日/韩/俄/阿/泰 |
| `resolveLangPair()` | 解析源/目标语言，同语言自动反转 | — |
| `translateText()` | 翻译调度：缓存检查 → API 调用 → 缓存写入 | — |
| `debouncedTranslate()` | 600ms 防抖 + requestId 防旧结果 | delay = 600ms |
| `formatSuggestions()` | 翻译结果 → Omnibox XML suggestions | max = 8 条 |
| `persistToLocalCache()` | 高频词持久化到 `chrome.storage.local` | max = 500, ttl = 7d |
| Omnibox 事件监听 | `onInputStarted/Changed/Entered` | minLength = 2 |

#### `providers/index.js` — Provider 工厂

| 函数 | 职责 |
|------|------|
| `translate(providerId, text, from, to, config)` | 路由到指定 Provider |
| `translateWithFallback(...)` | 包装 `translate()`，失败时降级到 MyMemory |

#### `providers/mymemory.js` — MyMemory 翻译

| 函数 | 说明 |
|------|------|
| `resolveLangPair(from, to)` | 语言代码处理，`auto` → `en` |
| `translate(text, from, to, config)` | 调用 MyMemory API，解析 matches |
| `mapSubjectToPos(subject)` | MyMemory subject 映射为词性缩写 |

- **API**: `GET https://api.mymemory.translated.net/get?q={text}&langpair={from}|{to}`
- **免费限制**: 5,000 字符/天（匿名），50,000 字符/天（提供 email）
- **语言代码**: ISO 639-1 或 RFC3066 (如 `zh-CN`)

#### `providers/google.js` — Google Translate

| 函数 | 说明 |
|------|------|
| `translate(text, from, to, config)` | 调用 Google Cloud Translation v2 |

- **API**: `GET https://translation.googleapis.com/language/translate/v2?key={key}&q={text}&target={to}`
- **认证**: 需要 API Key
- **特点**: 无词性标注

#### `providers/microsoft.js` — Microsoft Dictionary

| 函数 | 说明 |
|------|------|
| `buildHeaders(config)` | 构建含 Subscription Key 的请求头 |
| `detectLanguage(text, config)` | 调用 `/detect` 端点识别语言 |
| `dictionaryLookup(text, from, to, config)` | **主方法** — 调用 `/dictionary/lookup`，返回带 POS 的结果 |
| `translatorTranslate(text, from, to, config)` | 降级方法 — 调用 `/translate` |
| `translate(text, from, to, config)` | 统一入口：detect → dictionary → translate |
| `mapPosTag(tag)` | Microsoft POS 标签映射 (ADJ→adj. NOUN→n. 等) |

- **流程**: `detect语言 → dictionary/lookup → (无结果时) translate`
- **认证**: `Ocp-Apim-Subscription-Key` Header
- **特点**: 词性标注最完整（ADJ/ADV/NOUN/VERB/PREP/PRON/CONJ/DET）

---

## 3. 数据模型

### 3.1 翻译结果 (统一格式)

```javascript
{
  translations: [
    {
      pos: "adj.",           // 词性 (可为空)
      meaning: "美丽的",      // 翻译含义
      quality: 74,           // 匹配质量 0-100
      source: "MyMemory",    // 来源标识
    }
  ]
}
```

### 3.2 用户设置 (chrome.storage.sync)

```javascript
{
  provider: "mymemory",      // "mymemory" | "google" | "microsoft"
  targetLang: "zh-CN",       // ISO 语言代码
  googleApiKey: "",           // Google API Key
  microsoftApiKey: "",        // Microsoft Subscription Key
  microsoftRegion: "",        // Azure Region (如 "eastasia")
  mymemoryEmail: "",          // MyMemory email (提升额度)
}
```

### 3.3 持久化缓存 (chrome.storage.local)

```javascript
{
  _dictbox_cache: {
    "mymemory:en:zh-CN:hello": {
      value: { translations: [...] },
      timestamp: 1709884800000    // 7天过期
    }
  }
}
```

### 3.4 缓存 Key 格式

```
{provider}:{from}:{to}:{text_lowercase_trimmed}
```

示例: `mymemory:en:zh-CN:hello`

---

## 4. 关键流程

### 4.1 翻译请求流程

```
用户输入字符
     │
     ▼
  字符数 ≥ 2?  ─── No ──▶ 显示 "继续输入..."
     │ Yes
     ▼
  清除旧 debounce timer
  启动新 600ms timer
     │
     ▼ (600ms 后)
  resolveLangPair()
  ├─ 检测源语言 (Unicode 启发式)
  ├─ 源 = 目标? → 反转为 en
  └─ 生成 cacheKey
     │
     ▼
  LRU 缓存命中?  ─── Yes ──▶ 直接返回
     │ No
     ▼
  translateWithFallback()
  ├─ 调用主 Provider
  ├─ 失败? → fallback 到 MyMemory
  └─ 返回统一格式结果
     │
     ▼
  写入 LRU 缓存
  写入持久化缓存 (async, 不阻塞)
     │
     ▼
  formatSuggestions()
  ├─ 第 1 条 → setDefaultSuggestion
  └─ 第 2-8 条 → suggest([...])
```

### 4.2 Microsoft Dictionary 流程

```
translate(text, from, to, config)
     │
     ▼
  from === "auto"? ─── Yes ──▶ POST /detect → 获取 sourceLang
     │ No                              │
     │◀────────────────────────────────┘
     ▼
  POST /dictionary/lookup?from={from}&to={to}
     │
     ▼
  有结果?  ─── Yes ──▶ 返回 {pos, meaning} 列表 (按 confidence 排序)
     │ No
     ▼
  POST /translate?to={to}  (降级)
     │
     ▼
  返回翻译结果 (无词性)
```

### 4.3 设置变更流程

```
用户修改设置 → chrome.storage.sync.set()
     │
     ▼
  storage.onChanged 事件
     │
     ▼
  更新 currentSettings 内存变量
  清空 LRU 缓存 (确保使用新 Provider)
```

---

## 5. API 接口规范

### 5.1 MyMemory API

```
GET https://api.mymemory.translated.net/get
  ?q={text}                  // 必填，UTF-8，最大 500 bytes
  &langpair={from}|{to}     // 必填，如 en|zh-CN
  &de={email}               // 可选，提升额度

Response: {
  responseData: { translatedText: "你好" },
  responseStatus: 200,
  matches: [
    { translation: "你好", quality: 74, subject: "", created-by: "MateCat" }
  ]
}
```

### 5.2 Google Translate API v2

```
GET https://translation.googleapis.com/language/translate/v2
  ?key={apiKey}
  &q={text}
  &target={to}
  &source={from}             // 可选，省略则自动检测
  &format=text

Response: {
  data: {
    translations: [
      { translatedText: "你好", detectedSourceLanguage: "en" }
    ]
  }
}
```

### 5.3 Microsoft Translator API v3

#### 语言检测

```
POST https://api.cognitive.microsofttranslator.com/detect?api-version=3.0
Headers: Ocp-Apim-Subscription-Key: {key}
Body: [{ "Text": "hello" }]

Response: [{ "language": "en", "score": 1.0 }]
```

#### 词典查询 (主方法)

```
POST https://api.cognitive.microsofttranslator.com/dictionary/lookup
  ?api-version=3.0
  &from={from}
  &to={to}
Headers: Ocp-Apim-Subscription-Key: {key}
Body: [{ "Text": "hello" }]

Response: [{
  translations: [{
    displayTarget: "你好",
    posTag: "OTHER",
    confidence: 0.7891
  }]
}]
```

#### 翻译 (降级方法)

```
POST https://api.cognitive.microsofttranslator.com/translate
  ?api-version=3.0
  &to={to}
  &from={from}               // 可选
Headers: Ocp-Apim-Subscription-Key: {key}
Body: [{ "Text": "hello" }]

Response: [{
  translations: [{ "text": "你好", "to": "zh-Hans" }],
  detectedLanguage: { "language": "en", "score": 1.0 }
}]
```

---

## 6. Chrome APIs 使用

| API | 用途 | 权限 |
|-----|------|------|
| `chrome.omnibox` | Omnibox 事件监听和建议推送 | manifest `omnibox.keyword` |
| `chrome.storage.sync` | 跨设备同步用户设置 | `storage` |
| `chrome.storage.local` | 本地持久化翻译缓存 | `storage` |
| `chrome.storage.onChanged` | 监听设置变化实时更新 | `storage` |

---

## 7. 扩展指南

### 7.1 添加新的翻译 Provider

1. 在 `providers/` 下新建 `{name}.js`
2. 导出以下接口：

```javascript
// 必须导出
export async function translate(text, from, to, config = {}) {
  // 返回统一格式
  return {
    translations: [
      { pos: 'n.', meaning: '翻译结果', quality: 100, source: 'ProviderName' }
    ]
  };
}
export const name = 'Provider Display Name';
export const requiresKey = true; // 或 false
```

3. 在 `providers/index.js` 中注册：

```javascript
import * as newProvider from './newprovider.js';
const providers = { mymemory, google, microsoft, newProvider };
```

4. 在 `options.html` 的 `<select id="provider">` 中添加选项
5. 如需 API Key，在 `options.html` 中添加对应配置区块

### 7.2 添加新的目标语言

在 `options.html` 的 `<select id="targetLang">` 中添加 `<option>`：

```html
<option value="vi">Tiếng Việt</option>
```

### 7.3 添加新的语言检测

在 `background.js` 的 `detectSourceLang()` 中添加 Unicode 范围：

```javascript
const hindiPattern = /[\u0900-\u097f]/;
if (hindiPattern.test(text)) return 'hi';
```

### 7.4 Content Script 扩展（划词翻译）

未来添加划词翻译需要：

1. `manifest.json` 中添加 `content_scripts`
2. 新建 `content.js` 监听 `mouseup` 事件
3. 获取选中文本 → 调用 Provider → 显示浮层
4. 新建 `content.css` 定义浮层样式
5. 通过 `chrome.runtime.sendMessage` 与 Service Worker 通信

---

## 8. 已知限制

| 限制 | 说明 | 应对方案 |
|------|------|----------|
| MyMemory 日限 | 匿名 5,000 字符/天 | 配置 email 提升至 50K |
| Service Worker 休眠 | Chrome 会在空闲时终止 SW | 内存缓存会丢失，靠持久化缓存恢复 |
| Omnibox 建议数量 | Chrome 限制最多约 5-6 条建议 | 结果截取 top 8，实际显示取决于 Chrome |
| Omnibox XML 限制 | description 仅支持 `<match>` `<dim>` `<url>` 标签 | 不使用 emoji 或 HTML |
| MyMemory 无自动检测 | langpair 必须指定源语言 | 默认 auto → en |

---

## 9. 安全考虑

| 风险 | 措施 |
|------|------|
| API Key 泄露 | 仅存储在 `chrome.storage.sync`，不上传到任何服务器 |
| 中间人攻击 | 所有 API 调用使用 HTTPS |
| XSS/注入 | Omnibox description 严格 XML 转义 (`escapeXml`) |
| 数据隐私 | 不收集用户数据，不追踪行为，不使用 analytics |
| 权限最小化 | 仅申请 `storage` 权限，不要求 `tabs`/`host_permissions` |
