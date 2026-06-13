<p align="center">
  <img src="src/asset/img/deepseek.svg" width="120" alt="DeepSeek GUI Logo">
</p>

<h1 align="center">DeepSeek GUI</h1>

<p align="center">
  <strong>🚀 Bring Kun's high-token-ROI agent runtime to your desktop — Code / Write / Connect in one AI workbench</strong>
</p>

<p align="center">
  <a href="https://github.com/20090106-520/DeepSeek-GUI/releases">
    <img src="https://img.shields.io/github/v/release/20090106-520/DeepSeek-GUI?label=latest&color=brightgreen" alt="GitHub Release">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/20090106-520/DeepSeek-GUI?color=blue" alt="License">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-34-blueviolet" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React">
</p>

<p align="center">
  简体中文 | <a href="./README.md">English</a>
</p>

---

<p align="center">
  <img src="src/asset/img/codemode.png" alt="DeepSeek GUI Banner" width="860">
</p>

<p align="center">
  <a href="src/asset/img/code.mp4">
    <img src="src/asset/img/code.gif" width="410" alt="Code mode demo">
  </a>
  <a href="src/asset/img/write.mp4">
    <img src="src/asset/img/write.gif" width="410" alt="Write mode demo">
  </a>
</p>

## ✨ Features

### 💻 Code Mode — Project-Level AI Dev Workbench
- 🧠 **Kun Agent** — Cache-first agent loop, high Token ROI, stable prompt prefix + on-demand tool context
- 📝 **Streaming Reasoning** — Watch thinking chain, tool calls, and file changes in real time
- 🔍 **Code Review** — `/review` inspects uncommitted changes, findings shown as review cards
- 📋 **Requirements & Plans** — Draft requirements → AI clarification → generate implementation plan, `/plan` `/goal` tracking
- ✅ **Change Approval** — Inline diffs + side review panel, approve or deny sensitive operations

### ✍️ Write Mode — Markdown Writing Workbench
- 📂 **Writing Spaces** — Independent file tree, Live / Source / Split / Preview editing modes
- 🤖 **AI Completion** — DeepSeek FIM short + inspiration completion, BM25 cross-document retrieval
- 📤 **Multi-format Export** — HTML / PDF / DOC / DOCX one-click export
- ✏️ **Inline Agent** — Select text to invoke writing assistant, polish/continue/summarize/outline

### 📱 Connect Phone — IM Automation + Scheduled Tasks
- 💬 **Feishu / Lark / WeChat** — Dedicated IM agents, custom profiles, models, and workspaces
- ⏰ **Scheduled Tasks** — One-time / daily / interval / manual, auto-create Kun threads
- 🔗 **Webhook / Relay** — Local webhook for team collaboration or personal automation

### 🎨 AI Multimodal Generation
- 🖼️ **Image Generation** — Agnes Image 2.1 Flash, text-to-image + image editing
- 🎬 **Video Generation** — Agnes Video V2.0, async generation + embedded player
- 🎭 **Drama Studio** — AI short video creation, storyboard + voiceover + subtitles + BGM
- 🔄 **Dual API Fallback** — Auto-switch to backup API on rate limit, zero-interruption experience

### 🔌 Plugins & Extensions
- 🛒 **Plugin Marketplace** — MCP Server / Kun Skill graphical management, category filter + popularity sort
- 🔧 **Computer Use** — @anthropic-ai/computer-use-mcp, screenshot/mouse/keyboard desktop control
- 🌐 **Web Tools** — web_fetch / web_search, online search and page scraping
- 🧩 **Workflow Editor** — Multi-step sequential execution, visual task flow

### 🛡️ Engineering Quality
- 🔐 **Privacy First** — API keys encrypted locally, all data stays on your machine
- 🌍 **Bilingual** — Switch UI language anytime, full i18n coverage
- 🎯 **Zero TypeScript Errors** — 748 unit tests + 11 E2E tests all passing
- 📦 **Cross-platform** — Windows / macOS / Linux pre-built installers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DeepSeek GUI (Electron)               │
├─────────────┬──────────────┬────────────────────────────┤
│   Main      │   Preload    │   Renderer (React 19)      │
│   Process   │   Bridge     │                             │
│             │              │  ┌──────────┐ ┌──────────┐ │
│  ┌───────┐  │              │  │ Code     │ │ Write    │ │
│  │Kun    │  │  dsGui API   │  │ Workbench│ │ Mode     │ │
│  │Adapter│◄─┼──────────────┼─►│          │ │          │ │
│  └───┬───┘  │              │  ├──────────┤ ├──────────┤ │
│      │      │              │  │ Connect  │ │ Drama    │ │
│  ┌───▼───┐  │              │  │ Phone    │ │ Studio   │ │
│  │Kun    │  │              │  ├──────────┤ ├──────────┤ │
│  │Serve  │  │              │  │ Plugin   │ │ Workflow │ │
│  │(HTTP/ │  │              │  │ Market   │ │ Editor   │ │
│  │ SSE)  │  │              │  └──────────┘ └──────────┘ │
│  └───────┘  │              │                             │
├─────────────┴──────────────┴────────────────────────────┤
│  Kun Agent Runtime (TypeScript)                         │
│  Cache-first Loop · MCP · Skills · Memory · Sub-agents  │
└─────────────────────────────────────────────────────────┘
```

**Tech Stack:** Electron 34 · React 19 · TypeScript · Zustand · Vite · Tailwind CSS · Playwright

---

## ⚡ Quick Start

### One-Click Install

Download the latest release from [GitHub Releases](https://github.com/20090106-520/DeepSeek-GUI/releases/latest):

| Platform | Package |
| --- | --- |
| 🪟 Windows | `DeepSeek-GUI-{version}-win-x64.exe` |
| 🍎 macOS | `.dmg` or `.zip` (Intel / Apple Silicon) |
| 🐧 Linux | `.AppImage` |

### Run from Source (Developers)

```bash
git clone https://github.com/20090106-520/DeepSeek-GUI.git
cd DeepSeek-GUI
npm install
npm run dev
```

> 💡 Mainland China: `npm install --registry=https://registry.npmmirror.com`

**Requirements:** Node.js 20+ · [DeepSeek API Key](https://platform.deepseek.com/api_keys)

### First Run

1. 🚀 Launch DeepSeek GUI
2. 🌍 Choose interface language (Chinese/English)
3. 🔑 Enter your DeepSeek API key (also supports OpenAI-compatible endpoints)
4. 📂 Select a workspace directory
5. 💬 Start a new session and begin!

---

## 🎬 More Demos

<p align="center">
  <a href="src/asset/img/feishu.mp4">
    <img src="src/asset/img/feishu.gif" width="680" alt="Feishu / Lark / WeChat connection demo">
  </a>
</p>
<p align="center"><em>Feishu / Lark / WeChat connection demo</em></p>

<p align="center">
  <a href="src/asset/img/sdd.mp4">
    <img src="src/asset/img/sdd.gif" width="680" alt="Requirement drafting and planning demo">
  </a>
</p>
<p align="center"><em>Requirement drafting and planning demo</em></p>

<p align="center">
  <a href="src/asset/img/web.mp4">
    <img src="src/asset/img/web.gif" width="680" alt="Web tools demo">
  </a>
</p>
<p align="center"><em>Web tools demo</em></p>

---

## 🧠 Kun: High Token ROI Runtime

Kun makes token economy the default behavior of the agent loop, not a cleanup step after the fact:

| Kun Advantage | Where the ROI Comes From |
| --- | --- |
| **Cache-first agent loop** | Stable system prompts + tool schemas, DeepSeek-native cache hits |
| **Tool context on demand** | `mcp_search` → `mcp_describe` → `mcp_call`, avoid full tool catalog |
| **Context hygiene** | Long results / repeated loops / low-value history bounded, preserve code + paths + errors + decisions |
| **Visible usage payback** | Runtime tracks cache hit/miss + token usage, GUI surfaces savings in real time |

> See [Kun Architecture](docs/kun-architecture.en.md) · [Cache Optimization](docs/kun-cache-optimization.en.md)

---

## 👥 Who It Is For

- 🧑‍💻 **Developers** — Want DeepSeek on real codebases without living in a terminal
- 👔 **Teams** — Need to see what the agent did and which files changed
- 📝 **Writers** — Need a dedicated writing space + AI completion + multi-format export
- 🤖 **Automation Enthusiasts** — Want to connect DeepSeek to Feishu/WeChat/scheduled tasks

---

## ⚙️ Settings & Shortcuts

Settings manages: API Key / Base URL / Runtime port / Tool approval policy / Language & theme / Skill & MCP / Connect phone

| Key | Action |
| --- | --- |
| `Enter` | Send message |
| `Shift+Enter` | Newline in composer |
| `Ctrl+Enter` | Send message |
| `Esc` | Close panel / dismiss overlay |

---

## 🔨 Build from Source

```bash
npm run build           # Production build
npm run dist:win        # Windows installer
npm run dist:mac        # macOS packages
npm run dist:linux      # Linux AppImage
npm run test            # Unit tests (748 tests)
npm run test:e2e        # E2E tests (11 tests)
npm run typecheck       # TypeScript type check
```

---

## 📖 Documentation

| Doc | Contents |
| --- | --- |
| [Kun Architecture](docs/kun-architecture.en.md) | Single-runtime plan, HTTP/SSE contract, legacy agent retirement |
| [Kun Cache Optimization](docs/kun-cache-optimization.en.md) | Token economy, MCP search, tool-output compaction |
| [Kun Contributing](docs/kun-contributing.en.md) | Hexagonal architecture, design patterns, PR scenarios |
| [Kun CLI & API](kun/README.md) | CLI, env, data dir, HTTP API |
| [Contributing](docs/CONTRIBUTING.en.md) | Contribution guide |
| [Development](docs/DEVELOPMENT.en.md) | Local development workflow |

---

## 🙏 Thanks

- **Reasonix** — cache-first agent loop design prototype
- **[LobsterAI](https://github.com/netease-youdao/LobsterAI)** — IM management, QR binding inspiration
- **OpenHanako** — Markdown live editing, writing space reference
- **[DeepSeek](https://github.com/deepseek-ai)** — Models and API

<a href="https://github.com/20090106-520/DeepSeek-GUI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=20090106-520/DeepSeek-GUI" />
</a>

> [!NOTE]
> This is a derivative project. Upstream: [XingYu-Zhong/DeepSeek-GUI](https://github.com/XingYu-Zhong/DeepSeek-GUI), original MIT license. Not affiliated with DeepSeek Inc.

## 📄 License

[MIT](./LICENSE)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/chart?repos=20090106-520/DeepSeek-GUI&type=date&legend=top-left)](https://www.star-history.com/?repos=20090106-520%2FDeepSeek-GUI&type=date&logscale=&legend=top-left)
