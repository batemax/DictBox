<div align="center">

# 📖 DictBox

**Chrome 地址栏字典翻译插件 — 输入即译，无需切换页面**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<img src="icons/icon128.png" width="96" alt="DictBox Icon">

**[English](#english)** · **[中文](#中文)**

</div>

---

## 中文

### 🎬 快速开始

在 Chrome 地址栏中：

```
db hello
```

翻译结果立即显示在下拉列表中 — 无需打开新标签页，无需离开当前页面。

### ✨ 功能特性

| 功能 | 说明 |
|------|------|
| ⌨️ **Omnibox 快速翻译** | 地址栏输入 `db` + 空格 + 单词，即刻翻译 |
| 🏷️ **词性标注** | 显示 adj. / n. / v. / adv. 等词性分类 |
| 📋 **多义词展示** | 每个含义单独一行，按匹配度排序 |
| 🌍 **智能语言检测** | 自动识别中日韩俄阿泰等语言 |
| 🔄 **三大翻译引擎** | MyMemory（免费默认）/ Google / Microsoft Dictionary |
| ⚡ **多级缓存** | 内存 LRU 200 条 + 本地持久化 500 条 |
| 🛡️ **智能降级** | 主引擎失败自动切换 MyMemory |
| ⏱️ **防抖优化** | 600ms 防抖 + 最少 2 字符触发 |

### 📦 安装

#### 从源码安装（开发模式）

1. 下载或克隆本仓库
   ```bash
   git clone https://github.com/batemax/DictBox.git
   ```
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 开启右上角 **开发者模式** 开关
4. 点击 **加载已解压的扩展程序**
5. 选择 `DictBox` 项目文件夹
6. 完成！在地址栏输入 `db` 试试吧 🎉

### 🚀 使用方法

<table>
<tr>
<td width="60">

**步骤 1**

</td>
<td>

在地址栏输入 `db`，按 `空格` 或 `Tab` 激活 DictBox 模式

</td>
</tr>
<tr>
<td>

**步骤 2**

</td>
<td>

输入要翻译的单词或短语，如 `beautiful`

</td>
</tr>
<tr>
<td>

**步骤 3**

</td>
<td>

翻译结果自动显示在下拉列表中，包含词性和多个释义

</td>
</tr>
</table>

> 💡 **提示**：输入中文（如 `你好`）会自动翻译为英文。当输入语言与目标语言相同时，自动切换为英文翻译。

### ⚙️ 设置

右键点击插件图标 → **选项**，可配置：

- **翻译引擎** — MyMemory（免费，默认）/ Google Translate / Microsoft Dictionary
- **API Key** — Google / Microsoft 引擎需要配置对应 API 密钥
- **目标语言** — 支持中/英/日/韩/法/德/西/葡/俄等 13 种语言
- **MyMemory Email** — 填写后免费额度从 5,000 提升至 50,000 字符/天

### 🔌 翻译引擎对比

| 引擎 | 免费额度 | 词性标注 | API Key |
|------|---------|---------|---------|
| **MyMemory** | 5K 字符/天（默认） | ⚠️ 有限 | 不需要 |
| **Google Translate** | 按 API 计费 | ❌ 无 | 需要 |
| **Microsoft Dictionary** | 2M 字符/月免费 | ✅ 完整 | 需要 |

> 🎯 **推荐**：如需精确词性标注，建议配置 Microsoft Dictionary（Azure 免费额度每月 200 万字符）。

---

## English

### 🎬 Quick Start

In Chrome's address bar:

```
db hello
```

Translation results appear instantly in the dropdown — no new tabs, no page switching.

### ✨ Features

- **⌨️ Omnibox Translation** — Type `db` + space + word in the address bar for instant translation
- **🏷️ Part-of-Speech Tags** — Shows adj. / n. / v. / adv. classifications
- **📋 Multiple Meanings** — Each definition on a separate line, sorted by relevance
- **🌍 Smart Language Detection** — Auto-detects CJK, Cyrillic, Arabic, Thai, and more
- **🔄 Three Translation Engines** — MyMemory (free, default) / Google / Microsoft Dictionary
- **⚡ Multi-layer Caching** — In-memory LRU (200 entries) + persistent local cache (500 entries)
- **🛡️ Auto Fallback** — Gracefully falls back to MyMemory if the primary engine fails
- **⏱️ Debounce** — 600ms debounce + minimum 2-character input to reduce API calls

### 📦 Installation

#### From Source (Developer Mode)

1. Clone this repository
   ```bash
   git clone https://github.com/batemax/DictBox.git
   ```
2. Open Chrome → navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `DictBox` folder
6. Done! Type `db` in the address bar to get started 🎉

### ⚙️ Configuration

Right-click the extension icon → **Options** to configure:

- **Translation Engine** — MyMemory (free, default) / Google Translate / Microsoft Dictionary
- **API Keys** — Required for Google and Microsoft engines
- **Target Language** — 13 languages supported (Chinese, English, Japanese, Korean, French, German, etc.)

### 🔌 Engine Comparison

| Engine | Free Tier | POS Tags | API Key |
|--------|-----------|----------|---------|
| **MyMemory** | 5K chars/day (default) | ⚠️ Limited | Not required |
| **Google Translate** | Pay-per-use | ❌ None | Required |
| **Microsoft Dictionary** | 2M chars/month free | ✅ Full | Required |

---

## 📁 Project Structure

```
DictBox/
├── manifest.json            # Chrome Extension Manifest V3
├── background.js            # Service Worker — Omnibox, caching, language detection
├── options.html             # Settings page
├── options.css              # Settings page styles (dark glassmorphism theme)
├── options.js               # Settings page logic
├── providers/
│   ├── index.js             # Provider factory with auto-fallback
│   ├── mymemory.js          # MyMemory free translation API
│   ├── google.js            # Google Cloud Translation API v2
│   └── microsoft.js         # Microsoft Dictionary + Translator API
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🏗️ Architecture

```
User Input (db + word)
        │
        ▼
   ┌─────────────┐     ┌──────────────┐
   │   Omnibox    │────▶│  LRU Cache   │──▶ Cache Hit → Return
   │  Listener    │     │  (200 items)  │
   └─────────────┘     └──────────────┘
        │                      │
        │ (Cache Miss)         │
        ▼                      │
   ┌─────────────┐            │
   │  Debounce   │            │
   │   600ms     │            │
   └─────────────┘            │
        │                      │
        ▼                      │
   ┌─────────────┐            │
   │  Provider   │            │
   │  Factory    │            │
   └─────────────┘            │
        │                      │
   ┌────┼────┐                │
   ▼    ▼    ▼                │
  MM  Google  MS              │
   │    │     │               │
   └────┼────┘                │
        │                      │
        ▼                      │
   ┌─────────────┐            │
   │  Format &   │────────────┘
   │  Cache      │   (Write back)
   └─────────────┘
        │
        ▼
   Omnibox Suggestions
```

## 🔧 Development

This is a pure JavaScript Chrome extension with no build step required.

```bash
# Clone
git clone https://github.com/batemax/DictBox.git

# Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select DictBox/

# Debug
# chrome://extensions → DictBox → "Service Worker" link → Console tab
```

## 📄 License

[MIT](LICENSE) © 2026

