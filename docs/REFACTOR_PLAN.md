# DictBox 重构计划

> 文档版本：v1.1  
> 创建日期：2026-07-24  
> 工作分支：`develop`  
> 原始版本归档分支：`V1`  
> 基线提交：`fd21ce94d36a48d4bb6600820d54a222e404bd99`

## 1. 插件作用

DictBox 是一个基于 Chrome Manifest V3 和 Omnibox API 的轻量级翻译扩展。用户在地址栏输入 `db` 加空格后，可直接查询单词或短语，并在地址栏建议列表中查看翻译结果。

当前版本提供：

- MyMemory、Google Translate、Microsoft Translator 三种翻译服务；
- 基于 Unicode 范围的源语言推断和同语言时自动翻译为英文；
- 词性、多义项和匹配质量的统一结果展示；
- 600ms 防抖、请求序号去旧和内存 LRU 缓存；
- `chrome.storage.sync` 设置页和 `chrome.storage.local` 持久化缓存；
- 主翻译服务失败时降级到 MyMemory。

V2 将在上述能力基础上：

- 新增 ChatGPT、Gemini、DeepSeek、Claude 四种大语言模型 Provider；
- 同时支持 Chromium 浏览器和 Firefox；
- 让两个浏览器共享核心业务代码，只在 Manifest、后台运行环境和浏览器 API 访问层保留差异。

大模型必须返回统一的结构化词典数据，经本地解析和校验后才能转换为 Omnibox 建议，不能直接展示未经验证的自然语言响应。

插件的核心价值不是完整的词典页面，而是在不离开当前页面的情况下完成高频、低摩擦的快速查词。

## 2. 当前架构

```text
Omnibox 事件
    |
    v
background.js
    |- 设置读取与监听
    |- 语言检测与语言对解析
    |- 防抖与并发控制
    |- 内存和持久化缓存
    |- 翻译服务调度
    `- Omnibox 结果格式化
             |
             v
      providers/index.js
        |- mymemory.js
        |- google.js
        `- microsoft.js

options.html / options.js
    `- chrome.storage.sync
```

当前实现无构建步骤、无第三方运行时依赖，部署简单；但业务逻辑、浏览器适配和基础设施耦合在同一个后台脚本中，缺少自动化测试和静态检查。

## 3. 主要问题与风险

### P0：正确性与安全

1. `manifest.json` 没有声明外部翻译 API 的 `host_permissions`。跨域请求可能因扩展权限或服务端 CORS 策略失败，应通过实际加载扩展验证并补齐最小权限。
2. API Key 使用 `chrome.storage.sync` 保存，会随 Chrome 账号同步；这与文档中“仅存储在本地”的描述不一致。敏感配置应迁移到 `chrome.storage.local`，普通偏好可继续同步。
3. `getFromPersistentCache()` 已实现但从未接入查询流程，导致“持久化缓存”只写不读，文档描述与实际行为不符。
4. MyMemory 在 `auto` 源语言时直接假设英语，拉丁字母以外已覆盖的语言之外容易产生错误语言对。
5. 远程字体依赖需要核对扩展 CSP、离线体验和 Chrome Web Store 合规性，优先改为本地字体或系统字体栈。
6. 当前 Manifest 只声明 `background.service_worker`。Firefox 不支持该扩展后台模式，必须提供 `background.scripts` 事件页入口。
7. 业务代码直接访问 `chrome.*` 且混用 Promise 写法，缺少稳定的 Firefox `browser.*` 兼容层。

### P1：可维护性与可靠性

1. `background.js` 同时承担事件适配、配置、语言策略、缓存、请求编排和视图格式化，难以独立测试。
2. 默认设置在 `background.js` 和 `options.js` 重复定义，存在配置漂移风险。
3. Provider 的配置和返回值只有注释约定，没有运行时校验；异常响应可能在下游格式化时失败。
4. Provider 降级策略写死为 MyMemory，缺少错误分类、超时、取消和可观测信息。
5. 持久化缓存采用“每次读写整个对象”的方式，数据增长后会增加序列化与并发覆盖风险。
6. 日志可能包含查询文本、响应摘要和服务请求信息，不利于隐私控制和生产环境降噪。

### P2：工程能力

1. 没有单元测试、集成测试、lint、格式化和 CI。
2. 没有可重复的打包与发布校验流程。
3. 产品文档声称的响应时间、错误率和缓存能力没有测量手段。
4. 设置页缺少可访问性与错误状态的系统化验证。

## 4. 重构目标

- 保持 `db + 查询词` 的核心交互和 v1 配置兼容；
- 将纯业务逻辑与 Chrome API、网络请求、存储实现分离；
- 建立统一且可验证的 Provider 契约；
- 修复权限、敏感配置和持久化缓存问题；
- 建立自动化测试、静态检查和可重复的发布流程；
- 从同一份源代码构建 Chromium 与 Firefox 安装包；
- 保持两个浏览器中的 Omnibox、设置、缓存和 Provider 行为一致；
- 在不引入不必要复杂度的前提下，为新增词典服务、历史记录和划词翻译保留扩展点。

## 5. 建议目标结构

```text
src/
  browser/
    webextension-api.js      # browser/chrome API 统一入口
    runtime-capabilities.js  # 浏览器能力检测
  background/
    index.js                 # 注册 WebExtensions 事件
    omnibox-controller.js    # Omnibox 用例编排
  core/
    translation-service.js   # 翻译主流程
    language-policy.js       # 检测与语言对策略
    result-normalizer.js     # 统一结果和去重排序
    errors.js                # 领域错误
  providers/
    registry.js
    mymemory.js
    google.js
    microsoft.js
    openai.js
    gemini.js
    deepseek.js
    claude.js
  llm/
    dictionary-schema.js      # 统一 JSON Schema
    dictionary-prompt.js      # 厂商无关提示词
    response-validator.js     # 解析、校验与规范化
  infrastructure/
    cache/
      memory-cache.js
      persistent-cache.js
    settings/
      defaults.js
      settings-repository.js
    http/
      fetch-client.js
  options/
    index.js
    settings-form.js
  shared/
    constants.js
    logger.js
tests/
  unit/
  integration/
  e2e/
    chromium/
    firefox/
manifests/
  base.json
  chromium.json
  firefox.json
scripts/
  build-manifest.js
```

保持 Vanilla JavaScript 和 Manifest V3。构建步骤只负责合并浏览器专属 Manifest、复制发布文件和执行校验；是否引入 TypeScript 或完整打包器，应在测试基线完成后单独决策，不作为第一阶段前置条件。

### 5.1 跨浏览器运行策略

| 能力 | Chromium | Firefox |
|---|---|---|
| Manifest | MV3 | MV3 |
| 后台环境 | `background.service_worker` | `background.scripts` 非持久事件页 |
| 模块方式 | `type: "module"` | `type: "module"` |
| 扩展 API | 通过统一适配层访问 | 通过统一适配层访问 |
| Omnibox | `omnibox` | `omnibox` |
| 设置与缓存 | `storage.sync` / `storage.local` | `storage.sync` / `storage.local` |
| 发布标识 | Chrome Web Store 配置 | `browser_specific_settings.gecko.id` |

禁止核心层直接访问 `chrome.*` 或 `browser.*`。浏览器 API 必须通过 `src/browser/webextension-api.js` 注入，以便单元测试和跨浏览器运行。

## 6. 分阶段实施计划

### 阶段 0：冻结基线与建立验证清单

- [x] 将原始版本固定在 `V1` 分支；
- [x] 从同一基线创建并切换到 `develop`；
- [ ] 在 Chrome 开发者模式加载 `V1`，记录三种 Provider、缓存、设置页和 Omnibox 的实际行为；
- [ ] 建立 v1 配置迁移样本和手工冒烟测试清单；
- [ ] 核对 Chrome Web Store 权限与隐私披露要求。

交付标准：能够用明确用例判断重构前后行为是否一致。

### 阶段 1：工程基线与特征测试

- [ ] 添加最小 `package.json`，引入测试、lint 和格式化命令；
- [ ] 为语言检测、语言对解析、XML 转义、结果去重排序和 LRU 缓存补单元测试；
- [ ] 为 Provider 契约建立 mock fetch 集成测试；
- [ ] 用 WebExtensions 通用 mock 覆盖设置加载、变更和 Omnibox 请求去旧；
- [ ] 建立 CI：静态检查、测试、双 Manifest 校验和双扩展包检查。

交付标准：核心纯逻辑具备回归保护，测试不依赖真实 API Key 或公网服务。

### 阶段 2：模块拆分但不改变产品行为

- [ ] 提取共享默认设置与常量；
- [ ] 从 `background.js` 提取语言策略、结果格式化、缓存和翻译服务；
- [ ] 将 WebExtensions 事件监听保留为薄适配层；
- [ ] 增加统一浏览器 API 适配器，消除业务代码中的 `chrome.*` 直接调用；
- [ ] 建立 Provider registry 和统一输入、输出、错误契约；
- [ ] 将传统翻译 Provider 与 LLM Provider 统一到同一领域返回类型；
- [ ] 增加依赖注入点，使 fetch、时钟、存储和日志可测试；
- [ ] 保持 v1 存储字段和用户设置兼容。

交付标准：Omnibox 和设置页行为与 v1 基线一致，核心模块可在无 Chrome 环境下测试。

### 阶段 3：Chromium 与 Firefox 双浏览器基线

- [ ] 将公共 Manifest 与浏览器差异拆分；
- [ ] Chromium 产物声明 `background.service_worker`；
- [ ] Firefox 产物声明 `background.scripts` 和 `browser_specific_settings.gecko.id`；
- [ ] 保持后台入口为 ES Module，并验证两个运行环境的模块加载；
- [ ] 为两个浏览器生成各自的最小 `host_permissions`；
- [ ] 使用系统字体或扩展内字体，移除设置页远程字体依赖；
- [ ] 在 Chromium 和 Firefox 中验证 Omnibox 启动、建议更新、结果选择和取消；
- [ ] 在两个浏览器中验证设置保存、重置、同步字段和本地字段；
- [ ] 生成独立产物：`dist/chromium` 与 `dist/firefox`。

交付标准：不接入真实外部 API 时，两个浏览器均可成功加载扩展，并通过相同的 mock 翻译冒烟测试。

### 阶段 4：修复正确性与安全问题

- [ ] 根据实际请求域补充最小 `host_permissions`；
- [ ] 将 API Key 从同步存储迁移到本地存储，加入一次性兼容迁移；
- [ ] 接通持久化缓存读取，增加 TTL、容量和版本控制；
- [ ] 为网络请求增加超时和可区分的错误类型；
- [ ] 修正语言检测失败和 `auto` 语言的 Provider 策略；
- [ ] 移除远程字体依赖或改为扩展内资源；
- [ ] 默认关闭详细生产日志，避免记录完整查询和响应。

交付标准：权限最小化、密钥不再同步、缓存可跨后台进程生命周期命中，错误可诊断且不泄露敏感信息。

### 阶段 5：体验与韧性优化

- [ ] 使用 `AbortController` 取消过期网络请求，而不只是在返回时丢弃；
- [ ] 将降级策略配置化，区分鉴权错误、额度错误、超时和无结果；
- [ ] 优化默认建议、无结果、错误和离线状态文案；
- [ ] 增加设置连接测试，但避免把真实凭据写入日志；
- [ ] 验证键盘操作、焦点、对比度和屏幕阅读器提示；
- [ ] 为缓存命中率、响应耗时和错误类别提供仅本地的诊断能力。

交付标准：慢网络、服务异常、快速连续输入和后台进程重启场景下仍保持可预测行为。

### 阶段 6：大语言模型词典能力

- [ ] 实现 ChatGPT、Gemini、DeepSeek、Claude Provider；
- [ ] 设置页支持 Provider、模型名称、API Key 和可选 Base URL；
- [ ] 定义并版本化统一词典 JSON Schema；
- [ ] 优先使用厂商原生结构化输出能力，并在本地执行同一套 Schema 校验；
- [ ] 对不支持或未正确遵守 Schema 的响应执行一次受限修复，仍失败则返回结构化错误；
- [ ] 将词性和多条释义稳定映射成 Omnibox 默认项与候选项；
- [ ] 限制输出条数、释义长度和 token 用量，控制地址栏延迟与 API 成本；
- [ ] 缓存 Key 加入 Provider、模型、Schema 版本、语言对和提示词版本；
- [ ] 鉴权失败、限流、超时或格式错误时，可配置是否降级到传统翻译 Provider；
- [ ] 为四个 LLM Provider 建立固定响应、拒答、截断、Markdown 包裹和非法 JSON 测试。

详细协议和数据流见 [`docs/V2_LLM_DESIGN.md`](./V2_LLM_DESIGN.md)。

交付标准：四种大模型都能将同一查询转换为通过统一 Schema 校验的词典结果，并可靠输出到 Omnibox；任何非法模型响应都不会直接进入 UI 或缓存。

### 阶段 7：双浏览器发布准备

- [ ] 更新 `README.md`、PRD、系统设计和隐私说明；
- [ ] 运行全量测试以及 Chromium、Firefox 手工冒烟测试；
- [ ] 构建不包含测试、密钥和开发文件的 Chromium、Firefox 发布包；
- [ ] 分别检查版本号、权限变化、扩展 ID、图标和商店文案；
- [ ] 使用 Firefox `web-ext lint` 或等效检查验证 Firefox 产物；
- [ ] 验证 Chrome Web Store 与 Firefox Add-ons 的隐私和权限披露；
- [ ] 从 `develop` 创建发布候选分支，经验证后再合并到 `main`。

交付标准：形成可复现、可审查、可回滚的 Chromium 与 Firefox V2 发布候选版本。

## 7. 测试矩阵

| 范围 | 必测场景 |
|---|---|
| 语言策略 | 英文到中文、中文到英文、日/韩/俄/阿/泰、目标语言相同、未知语言 |
| Omnibox | 空输入、单字符、连续快速输入、旧请求晚返回、无结果、选择结果 |
| Provider | 正常结果、空结果、错误 JSON、HTTP 4xx/5xx、超时、鉴权失败、额度耗尽 |
| LLM 输出 | 合法 Schema、缺字段、额外字段、Markdown 代码块、拒答、截断、非 JSON、超长释义 |
| 缓存 | 内存命中、持久化命中、TTL 过期、LRU 淘汰、设置变化失效、版本迁移 |
| 设置 | 初次安装、v1 迁移、保存、重置、敏感字段本地化、同步字段兼容 |
| 安全 | 最小主机权限、日志脱敏、发布包无密钥、远程资源检查 |
| Chromium | MV3 Service Worker 唤醒、挂起后缓存恢复、Omnibox、设置页、外部请求权限 |
| Firefox | MV3 Background Script 唤醒、模块加载、Omnibox、设置页、外部请求权限、扩展 ID |
| 跨浏览器一致性 | 同一 mock 输入产生相同领域结果、错误类型和 Omnibox 文案 |

## 8. 分支策略

- `V1`：只读归档，固定当前 v1 原始代码；
- `main`：稳定发布分支；
- `develop`：重构集成分支；
- `codex/refactor-*` 或 `feature/*`：从 `develop` 创建的短生命周期工作分支；
- 每个阶段单独提交，确保可评审和可回滚；
- 未通过阶段验收前，不把重构代码合并到 `main`。

当前只在本地创建了 `V1` 和 `develop`；是否推送远端应在确认远端分支策略后执行。

## 9. 建议的第一批任务

1. 建立测试工具链和 WebExtensions API mock；
2. 为现有纯逻辑补特征测试；
3. 提取共享设置、语言策略、缓存和浏览器 API 适配模块；
4. 建立 Chromium 与 Firefox 双 Manifest 生成流程；
5. 补齐并分别验证两个浏览器的 `host_permissions`；
6. 实现 API Key 本地迁移与持久化缓存读取；
7. 完成三种传统 Provider 的 mock 集成测试；
8. 固化 V2 词典 Schema，并完成四种 LLM Provider 的契约测试；
9. 在真实 Chromium 和 Firefox 中执行回归测试。

这组任务先解决“可验证”和“真实缺陷”，再推进目录与模块重组，能够降低大规模重构造成静默回归的风险。
