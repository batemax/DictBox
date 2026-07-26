# DictBox V2 大语言模型接入设计

> 状态：设计草案  
> 创建日期：2026-07-24  
> 适用 Provider：ChatGPT、Gemini、DeepSeek、Claude  
> 适用浏览器：Chromium、Firefox

## 1. 目标

V2 在 V1 的 Omnibox 翻译体验上增加大语言模型词典能力。用户选择任一 LLM Provider 后，输入词汇或短语，模型返回固定格式的词典数据；扩展在本地解析、校验和规范化，再将词性与释义输出为 Omnibox 建议。

本阶段不把模型回答当作可直接展示的文本。只有通过统一 Schema 校验的数据才能进入缓存和 UI。

LLM Provider、Schema 校验、缓存和 Omnibox 映射均为浏览器无关模块。Chromium 与 Firefox 的差异只能存在于构建后的 Manifest、后台运行入口和 WebExtensions API 适配层。

## 2. 统一领域协议

建议使用以下 JSON 作为四种模型的唯一出口格式：

```json
{
  "schemaVersion": "2.0",
  "query": "beautiful",
  "sourceLanguage": "en",
  "targetLanguage": "zh-CN",
  "entries": [
    {
      "partOfSpeech": "adj.",
      "meanings": [
        "美丽的",
        "出色的"
      ]
    }
  ]
}
```

对应约束：

- 根对象必须包含 `schemaVersion`、`query`、`sourceLanguage`、`targetLanguage`、`entries`；
- `schemaVersion` 固定为 `2.0`；
- `entries` 为 1–6 项；
- `partOfSpeech` 必须来自允许列表：`n.`、`v.`、`adj.`、`adv.`、`pron.`、`prep.`、`conj.`、`det.`、`interj.`、`phrase`、空字符串；
- 每个 entry 的 `meanings` 为 1–4 条非空字符串；
- 单条释义建议不超过 80 个字符；
- 所有对象默认拒绝未声明字段，避免不同模型随意扩展格式；
- 发音、例句和同反义词暂不进入核心 Schema，后续通过新 Schema 版本增加。

建议的 JSON Schema：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DictBoxDictionaryResult",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "query",
    "sourceLanguage",
    "targetLanguage",
    "entries"
  ],
  "properties": {
    "schemaVersion": {
      "const": "2.0"
    },
    "query": {
      "type": "string",
      "minLength": 1
    },
    "sourceLanguage": {
      "type": "string",
      "minLength": 2
    },
    "targetLanguage": {
      "type": "string",
      "minLength": 2
    },
    "entries": {
      "type": "array",
      "minItems": 1,
      "maxItems": 6,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["partOfSpeech", "meanings"],
        "properties": {
          "partOfSpeech": {
            "enum": [
              "",
              "n.",
              "v.",
              "adj.",
              "adv.",
              "pron.",
              "prep.",
              "conj.",
              "det.",
              "interj.",
              "phrase"
            ]
          },
          "meanings": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            }
          }
        }
      }
    }
  }
}
```

## 3. Provider 统一接口

```javascript
/**
 * @returns {Promise<DictionaryResult>}
 */
async function lookup(request, config, context) {}
```

输入：

```javascript
{
  query: "beautiful",
  sourceLanguage: "auto",
  targetLanguage: "zh-CN"
}
```

配置：

```javascript
{
  provider: "openai",
  model: "user-selected-model",
  apiKey: "stored-in-chrome.storage.local",
  baseUrl: ""
}
```

Provider 负责：

- 组装厂商请求；
- 使用厂商支持的结构化输出或 JSON Schema 能力；
- 从厂商响应中提取候选 JSON；
- 将鉴权、限流、超时、拒答和服务错误映射为统一错误。

Provider 不负责：

- 直接创建 Omnibox suggestions；
- 自行更改统一 Schema；
- 缓存未经校验的原始回答；
- 在日志中输出 API Key、完整请求或完整模型回答。

## 4. 提示词约束

四种模型共享一份厂商无关的任务说明：

```text
你是 DictBox 的词典数据生成器。
根据 query、sourceLanguage 和 targetLanguage 返回词典释义。
只返回符合提供的 JSON Schema 的数据。
不要输出 Markdown、解释、前后缀或未声明字段。
保留常见且互不重复的释义，按常用程度排序。
无法可靠判断词性时，partOfSpeech 使用空字符串。
```

Schema 本身必须通过请求参数或等效结构化输出配置传入；提示词只是辅助约束，不能替代本地校验。

## 5. 请求与解析流程

```text
Omnibox query
    |
    v
TranslationService
    |- 读取 Provider / 模型 / 语言配置
    |- 查询版本化缓存
    v
LLM Provider Adapter
    |- 调用厂商 API
    |- 提取结构化结果
    v
Response Validator
    |- JSON 解析
    |- Schema 校验
    |- query / language 一致性检查
    |- 去重、裁剪、规范化
    v
Omnibox Mapper
    |- 第一条设置为默认建议
    `- 其余释义作为候选建议
```

Chromium 使用 Manifest V3 Service Worker 承载入口；Firefox 使用 Manifest V3 Background Script 事件页承载同一个入口模块。两者都通过统一的浏览器 API 适配器注册 Omnibox 和 Storage 事件。

解析策略：

1. 优先消费厂商原生结构化输出字段；
2. 不对正常响应使用正则猜测自然语言中的 JSON；
3. 若厂商只返回文本，可兼容剥离单层 Markdown JSON 代码块后解析；
4. 首次 Schema 校验失败时允许一次低 token 的格式修复请求；
5. 修复仍失败则返回 `INVALID_MODEL_OUTPUT`，不缓存、不展示原文；
6. 对 entries 和 meanings 去重，稳定排序并限制总建议数。

## 6. Omnibox 映射

输入：

```json
{
  "entries": [
    {
      "partOfSpeech": "adj.",
      "meanings": ["美丽的", "出色的"]
    },
    {
      "partOfSpeech": "n.",
      "meanings": ["美人"]
    }
  ]
}
```

映射：

```text
adj. 美丽的
adj. 出色的
n. 美人
```

每一项继续使用现有 XML 转义。建议总数限制为 8；相同的“词性 + 释义”只保留一次。`content` 使用纯释义或稳定的内部标识，`description` 才负责词性高亮展示。

## 7. 设置与密钥

设置页新增：

- Provider：传统翻译服务或四种 LLM；
- Model：用户可编辑，提供非永久绑定的默认建议；
- API Key：每个厂商独立保存；
- Base URL：高级选项，默认使用厂商官方地址；
- LLM 失败时是否降级到传统翻译服务。

API Key 必须写入 `chrome.storage.local`。Provider、目标语言、模型选择等非敏感偏好可写入 `chrome.storage.sync`。所有输入都需要长度和 URL 协议校验。

## 8. 缓存与成本

缓存 Key：

```text
llm:{provider}:{model}:{schemaVersion}:{promptVersion}:{from}:{to}:{normalizedQuery}
```

建议：

- 成功结果缓存 30 天；
- 格式错误、鉴权失败和限流响应不缓存；
- 空结果可短时缓存，避免连续重复请求；
- 每次请求限制最大输出 token；
- Omnibox 600ms 防抖保留，并使用 `AbortController` 取消旧请求；
- 设置变更只失效受影响 Provider 的缓存空间。

## 9. 统一错误

```text
MISSING_API_KEY
AUTHENTICATION_FAILED
RATE_LIMITED
REQUEST_TIMEOUT
PROVIDER_UNAVAILABLE
MODEL_REFUSAL
INVALID_MODEL_OUTPUT
EMPTY_RESULT
UNSUPPORTED_MODEL
```

Omnibox 只显示简短、可操作的错误文案，详细诊断仅写入脱敏后的开发日志。

## 10. 验收标准

- 四个 LLM Provider 对同一输入都返回 `schemaVersion: "2.0"` 的数据；
- 非法 JSON、缺字段、额外字段、超长内容和错误词性均被拒绝；
- 合法结果可稳定展开为最多 8 条 Omnibox 建议；
- 快速连续输入不会展示旧查询结果；
- API Key 不进入同步存储、日志、缓存 Key 或发布包；
- 单个 Provider 失败不会导致 Chromium Service Worker 或 Firefox Background Script 崩溃；
- 传统 Provider 保持兼容，并可作为 LLM 的可配置降级路径。
- 相同 mock 响应在 Chromium 与 Firefox 中生成相同的 Omnibox 建议。
