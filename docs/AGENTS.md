# Connect an Agent

Cyber Hengdian runs one local HTTP service. The director, CLI and MCP server all read and modify that service's saved project. A skill describes the workflow; it does not contain a second project store or a language-model API key.

Start the app with `npm run dev`. Run `npm run cli -- --help` for direct commands. Default service URL is `http://127.0.0.1:4317`; a separate workspace requires its own server port and `HENGDIAN_DATA` directory. Set the client's `HENGDIAN_URL` to that port.

## Codex

Example MCP configuration (replace the repository path with your installation):

```toml
[mcp_servers.hengdian]
command = "node"
args = ["/absolute/path/cyber-hengdian/node_modules/tsx/dist/cli.mjs", "/absolute/path/cyber-hengdian/tools/mcp.ts"]

[mcp_servers.hengdian.env]
HENGDIAN_URL = "http://127.0.0.1:4317"
```

The MCP process does not start the HTTP app. Keep the app running separately. This launch command avoids npm banners on stdout: stdio is reserved for MCP protocol messages. Use an absolute Node executable path if the host cannot resolve `node`.

The workflow skill is in [direct-hengdian](../.agents/skills/direct-hengdian/SKILL.md). Codex can discover repository skills while working here; follow your host's skill installation mechanism for use in other projects. The repository does not alter your personal Codex configuration.

Official reference: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp).

## DeepSeek Harness

Use the official `@deepseek-ai/dsh-mcp-client` plugin in the appropriate Harness configuration. Example plugin entry (merge into the plugin list your installed version uses):

```yaml
- id: mcp-hengdian
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: hengdian
    transport: stdio
    command: node
    args:
      - /absolute/path/cyber-hengdian/node_modules/tsx/dist/cli.mjs
      - /absolute/path/cyber-hengdian/tools/mcp.ts
    env:
      HENGDIAN_URL: http://127.0.0.1:4317
```

Harness plugin configuration is version-dependent. Check the installed release's [MCP client documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md) before applying it. Tools are exposed through its MCP namespace; the underlying tool names and schemas remain the same. Load the same `SKILL.md` through the host's [filesystem skill provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/README.md), or provide its instructions explicitly.

DeepSeek model API compatibility and DeepSeek Harness integration are separate concerns. Image attachments require the active model and attachment capability to support them. The Harness MCP client does not currently consume MCP prompt templates; this service uses tools and a project resource instead. `preview_shot` returns a real PNG image and metadata; other tools return structured JSON. A host that does not support image content can still edit, but cannot claim visual review from metadata.

## Operation contract

1. Read project, catalog and schema.
2. Submit `apply_operations` with observed `baseRevision`, unique `requestId`, label and typed operations.
3. Read project and inspect to verify. For a conflict, read and reconsider; never silently replace newer state.
4. Use `preview_shot` for real PNG frames and the director for playback. CLI can save a frame with `preview --shot ID --time 0 --out frame.png`. Structural validation does not verify visual quality.
5. Create an export and check job status until it completes, fails or is cancelled. Only completed jobs have downloadable artifacts.

`hengdian://project` is a read-only resource for the same live project. `use_pack` replaces the current scene and requires explicit `baseRevision`; pass `version` to pin an external pack from `list_packs` (CLI: `use-pack ID --base-revision N --version X.Y.Z`). Multiple installed versions require selection. Transaction replay is retained for the last 50 accepted request IDs; its original result can be older than the current project, so read back live state after a replay. `use_pack` has no request-ID replay contract. Export creation is likewise a separate non-idempotent task. Read state/jobs after an ambiguous response before deciding to retry.

## Current verification boundary

The automated MCP integration test launches the real local service with an isolated data directory, connects using the official SDK's stdio client, checks discovery/resource reads, applies edits through both MCP and CLI, retries a transaction idempotently, verifies conflict/error handling, and installs/selects two versions of an external pack. Preview protocol tests verify a missing-shot error; rendered-image and export validation belong to the browser/export tests. This proves the protocol and shared-state path. It does not prove actual model behavior, host configuration loading, screenshot understanding or end-to-end use inside Codex/DeepSeek Harness. Those host sessions must be tested separately before claiming native-host certification.

No external generation API, account setup, paid inference, automatic publishing or remote deployment is performed by this integration. An installed model that can call tools can direct structural edits; visual judgment still needs an image-capable model or human review.
