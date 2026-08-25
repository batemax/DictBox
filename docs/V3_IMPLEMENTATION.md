# DictBox V3 实现与验收

## 设计来源

实现依据为 Open Design 的 `DictBox` 项目，入口文件 `index.html`，包含：

- `omnibox-preview.html`
- `word-lookup-popup.html`
- `word-result.html`
- `extension-options.html`
- `styles.css`
- `scripts/app.js`
- `chrome-word-lookup-plan.md`

## 页面映射

| Open Design | V3 扩展 | 说明 |
|---|---|---|
| 地址栏演示 | `src/background/index.js` | 真实 Omnibox 监听、500ms 防抖、精简建议与安全错误映射 |
| 插件弹窗 | `popup.html` + `src/popup/index.js` | 查询、加载、结果、错误、重试、复制、最近记录 |
| 完整释义 | `result.html` + `src/result/index.js` | 地址栏 Enter 后打开，支持再次查询和复制 |
| 插件设置 | `options.html` + `src/options/index.js` | 免费查询、模型密钥、渐进式高级设置、语言、测试并保存、危险操作确认 |
| 视觉令牌 | `options.css` | 冷白背景、纯白面板、发丝边框、蓝色强调色、系统字体 |

## 默认模式与测试 Mock

- 发布界面默认使用 MyMemory 免费查询，不要求 API Key。
- Mock 仅用于自动化，内置 `world`、`design`、`resilient`，不在设置页提供开关。
- Mock 适配器不调用网络，不存在词条时返回稳定的 `NO_RESULT` 错误。

## 自动化证据

`npm test` 覆盖：

- Mock 成功、无结果、取消和零网络请求。
- 后台消息查询、安全错误映射和结果页跳转。
- Omnibox 防抖与 Mock 建议。
- 最近记录去重、排序和最多 5 条。
- 完整释义视图与旧服务商结果兼容。
- 原有缓存、语言检测、服务商与 LLM 输出校验。

`npm run build` 验证 Chromium 与 Firefox 均可生成发布目录。

## Open Design 验收对照

- [x] `db world` 可产生简短解释建议。
- [x] Omnibox Enter 打开扩展内部结果页。
- [x] Omnibox 不渲染最近查询。
- [x] 弹窗支持查询、清空、复制、重试和最近 5 条。
- [x] 真实模式缺少 API Key 时不发送请求，并提供设置入口。
- [x] 设置页支持校验、连接测试和保存。
- [x] 连接测试成功后同步保存配置。
- [x] 自定义服务请求精确域名权限。
- [x] 恢复默认前明确确认会删除全部 API Key。
- [x] 支持 OpenAI、Gemini、Claude、DeepSeek 和自定义服务商配置。
- [x] 原语言与目标语言显示在结果页。
- [x] 中文输入在自动检测模式下切换到英语。
- [x] 不包含发音播放控件。
- [x] API Key 默认遮罩，密钥与外部结果不进入 HTML、URL或日志。
- [x] 380px 弹窗使用固定宽度和自然换行，无设计上的横向滚动。
- [x] Chrome 实机加载、视觉检查和逐项点击验证（2026-08-25，用户确认全部通过）。

Chrome 实机验收使用 `dist/chromium` 构建产物完成，并与自动化测试结果共同作为 V3 验收证据。
