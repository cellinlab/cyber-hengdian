# Connect an Agent

Cyber Hengdian runs one local HTTP service. The director, CLI and MCP server all read and modify that service's saved project. A skill describes the workflow; it does not contain a second project store or a language-model API key.

Start the app with `npm run dev`. Run `npm run cli -- --help` for direct commands. Default service URL is `http://127.0.0.1:4317`; a separate workspace requires its own server port and `HENGDIAN_DATA` directory. Set the client's `HENGDIAN_URL` to that port.

## Codex

For a real model session with invocation-scoped configuration and local evidence capture, use the [Codex launcher and two-turn example](CODEX.md). It connects to a running service and leaves the user's global configuration untouched.

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

The SDK integration suite runs the real isolated HTTP service and stdio server, checks tool discovery and resources, applies edits through MCP and CLI, verifies replay/conflicts and pack versions, and exercises actual parallel preview images. These checks prove the shared-state protocol; they do not establish model behavior by themselves.

The separate [real Codex case](CODEX.md) uses the installed Codex CLI with its existing ChatGPT authentication and invocation-scoped MCP configuration. It exposed two issues missed by SDK-only testing: Codex rejected tuple-style JSON Schema during tool discovery, and the initial read-only/no-prompt configuration denied the editing tool. The MCP boundary now presents fixed-length numeric arrays while retaining strict core validation; the directing launcher explicitly authorizes only the requested scene-edit and export tools for that invocation. It does not relax shell permissions, change global configuration or bypass managed policy.

The acceptance workflow uses two natural-language turns: build a three-shot courtyard meeting, inspect actual PNGs and correct occlusion, then revise only the second camera while preserving actors and motion, and export all three shots. Actual preview content, project readback, export files and independent playback review determine acceptance. CLI exit zero or a completed tool event alone is insufficient.

This is local **Codex CLI** verification with Chrome/FFmpeg rendering. It does not establish native MCP use inside a Codex desktop chat, DeepSeek Harness compatibility, arbitrary-model vision quality or external video-generation quality. A model without image support cannot claim visual review from framing metadata.

The scene service itself makes no language-model or external video-generation calls. The optional Codex launcher does invoke the authenticated Codex model and consumes the account's normal allowance. Neither path automatically publishes, deploys or sends exported material to a video-generation provider.

## Scene library and joint direction

`list_catalog` now exposes bilingual `assets`, `sceneTemplates`, `assemblies`, `posePresets` and `jointDefinitions` in addition to the original packs/recipes. `use_scene_template` replaces the project with one of five editable spaces and requires the observed revision. `add_assembly` appends independently editable entities with `baseRevision`, `requestId`, optional metre `position`, and safe identical-argument replay. These are built-in factories, not downloaded executable plugins.

For a setpiece, add an entity with `kind: "setpiece"`, a catalog `modelId`, normal transform and the catalog source/license. For an articulated actor, discover joint limits before editing. `pose.set` and `pose.remove` operate on shot-local pose keys; a nonempty pose track overrides procedural action. Root position keys direct travel independently. Use the preset `pose` value as a starting point, not undocumented joint fields. Imported legacy actors need an explicit `actor` definition before pose keys can target them.

Current rigs are FK and procedural. Do not claim foot locking, physical contact, arbitrary retargeting or natural human movement from a valid schema. Check actual frames for joint pose, prop contact, occlusion and camera framing. The built-in geometry is reconstructed by a compatible runtime, while imported GLBs travel inside the shooting pack.

## Parts and appearance references

Use `inspect_meshes` to obtain actual child-index paths and an observed revision. Mark disjoint semantic parts with `part.set`; names are editable, while identity is the entity/part pair. `upload_reference` imports an explicitly supplied absolute local PNG/JPEG/WebP path and returns a content hash. Register it with `reference.add`, then bind its ID to a part or the whole entity in one atomic transaction. The uploading tool alone does not create a saved binding.

`preview_shot` accepts `pass: "part-id"`, or `pass: "mask" | "highlight"` with `selection: {entityId,partId}`. `create_export` optionally takes up to16 `parts` selections. Check complete jobs, original image bytes and the manifest; masks express visible opaque surfaces and do not guarantee downstream generation control. A real Codex parts case is recorded in [the truck example](../examples/truck-parts/README.md) and [verification](showcase/PARTS-VERIFICATION.md).
