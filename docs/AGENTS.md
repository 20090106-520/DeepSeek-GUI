# Agent Runtime Notes

DeepSeek GUI has one live agent runtime: **Kun**.

Do not add a second live provider, provider switcher, runtime diagnostics panel,
or legacy CodeWhale/Reasonix process path. Code, Write, and Connect phone all
enter the same Kun HTTP/SSE boundary. Connect phone still uses the internal
`claw` name in code for compatibility.

## Allowed Extension Path

1. Add protocol fields in `kun/src/contracts/`.
2. Add agent behavior in `kun/src/loop/`, `kun/src/services/`, or a
   new port/adapter under `kun/src/ports/` and `kun/src/adapters/`.
3. Add HTTP endpoints under `kun/src/server/routes/`.
4. Map the endpoint/event in `src/renderer/src/agent/kun-runtime.ts` and
   `src/renderer/src/agent/kun-mapper.ts`.
5. Add settings only under `agents.kun`.

## Forbidden Paths

- No `AgentSwitcher`.
- No `ConnectionStatusBar`.
- No `RuntimeDiagnosticsDialog` or runtime self-check UI.
- No CodeWhale/Reasonix adapter, process manager, RPC bridge, updater, or
  importer.
- No drawing/design starter card in the core workbench.
- No `/usage` or `/runtime` slash command that opens a runtime control panel.

## Legacy Data Rule

Old persisted keys may be read only inside settings migration:

- `agentProvider: codewhale | reasonix | deepseek-runtime` maps to `kun`.
- `agents.codewhale`, `agents.reasonix`, and legacy `deepseek` values seed
  `agents.kun` once.
- Saved settings must contain only `agents.kun`.
- Old Connect phone (internal Claw) `agentThreadIds.codewhale/reasonix` fold into
  `agentThreadIds.kun`.

## Verification

Run:

```bash
npm run typecheck
npm test
npm run build
```

Manual smoke:

- Code can create a Kun thread, stream a reply, approve/deny tools, and
  interrupt a turn.
- CodeWhale parity endpoints still work through Kun: thread search/archive
  filters, fork, session resume, request_user_input submit/cancel, and usage.
- Cache telemetry uses DeepSeek native `prompt_cache_hit_tokens` /
  `prompt_cache_miss_tokens`; hot Kun turns should stay above 90% cache
  hit after the stable prefix is warm.
- Immutable prefix drift and malformed tool-call/tool-result history must be
  caught before a request reaches DeepSeek.
- Write can open the workspace, request inline completion, and use selected-text
  assistant actions.
- Connect phone can save settings and run a manual task through a Kun thread.
- Settings -> Agents shows only Kun.

The full plan is in
[`docs/kun-architecture.md`](./kun-architecture.md).

---

## Windows 环境注意事项

本项目在 Windows + PowerShell 环境下开发，以下规则必须严格遵守：

### 路径处理

- 所有文件路径必须用双引号 `"` 包裹，尤其是包含中文、空格或特殊字符的路径
- 优先使用工具的 `workdir` 参数切换目录，禁止使用 `cd <dir> && <cmd>` 模式
- 路径分隔符：代码中统一用 `/`（Node.js 兼容），PowerShell 命令中用 `\` 或 `/` 均可但必须一致
- 禁止使用 `mkdir -p`，PowerShell 下使用 `New-Item -ItemType Directory -Force`

### 编码

- 写入中文内容时必须确保 UTF-8 编码
- PowerShell 中避免用 `echo`/`Set-Content` 写文件（默认编码可能不是 UTF-8）
- 优先使用 Write/Edit 工具而非 bash 命令来创建或修改文件

### 命令执行

- 每步操作独立执行，检查结果后再继续下一步
- 禁止将多个依赖操作塞进一条命令
- PowerShell 不支持 `&&`，用 `; if ($?) { }` 替代
- 命令失败时不要盲目重试，先分析错误原因

### Edit 工具使用

- edit 后必须验证返回结果是否成功
- 失败时先 read 文件确认当前内容，再重新编辑
- 不要假设 edit 成功就跳过验证步骤

### 构建与发布流程

1. 修改代码后升级版本号：`npm version patch --force`
2. 构建：`npm run dist:win`
3. 提交：`git add` + `git commit` + `git push origin master`
4. 创建 GitHub Release 并上传 exe + blockmap + latest.yml
5. 禁止在代码或提交中包含硬编码的 GitHub Token

---

## 工具使用策略

### 并行调用

- **硬性规则**：同一消息中，所有无依赖关系的工具调用必须并行发出
- 读取多个文件 → 一条消息发多个 `read`
- git status + git diff + git log → 一条消息发多个 `bash`
- glob 搜索 + grep 搜索 → 一条消息并行
- 唯一例外：后一步依赖前一步结果（如 read → edit，构建 → 测试）
- **反模式**：先 read A，等结果，再 read B，等结果，再 read C — 浪费 3 轮对话

### 减少冗余读取

- 已读取过的文件内容必须记住，同一会话内禁止重复 read 同一文件的同一区域
- grep 搜索必须带 `include` 过滤缩小范围，禁止全目录扫描
- 按文件名查找用 `glob`，按内容查找用 `grep`，不要用 `bash ls | grep`

### 工具选择优先级

| 场景 | 首选 | 禁止 |
|------|------|------|
| 按文件名查找 | `glob` | `bash ls \| grep` |
| 按内容搜索 | `grep`（带 include） | `bash rg` 无过滤 |
| 读取文件 | `read` | `bash cat` |
| 修改已有文件 | `edit`（局部替换） | `write` 全量重写 |
| 创建新文件 | `write` | — |
| 创建目录 | `bash New-Item -ItemType Directory -Force` | `mkdir -p` |

### 编辑策略

- `edit`：修改已有文件的局部内容（绝大多数场景）
- `write`：仅用于创建新文件
- edit 失败时：先 read 确认当前内容，找到精确匹配字符串，再重新 edit
- **禁止**因为 edit 失败就退化为 write 全量重写（丢失未修改部分的风险）

### 错误恢复

- 命令失败时**先读错误信息**，定位根因，不要盲目重试
- 分类处理：路径问题→检查引号/分隔符；类型错误→检查接口定义；语法错误→检查拼写
- 一次失败后**必须调整策略**再尝试，禁止相同命令连续执行 2 次以上
- edit 报 "oldString not found" → read 文件确认实际内容，不要猜
