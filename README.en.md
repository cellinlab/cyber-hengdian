# Cyber Hengdian

**Build a set once. Let people and AI keep directing it.**

[简体中文](README.md) · English

Open virtual-production infrastructure for creators and AI agents. Arrange editable sets, pose actors, plan camera movement, then export a reproducible shooting pack. The browser director, CLI and MCP share one validated project.

This is a local previsualization workstation. It does not generate finished AI videos by itself.

![Director overview](public/readme/module-overview.jpg)

## Run locally

Requires Node.js 22.12+. Image previews and video export require Chrome or Chromium; video encoding also requires FFmpeg.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4317. The interface supports English and Simplified Chinese; choose a language in the header. Your scene names and notes stay as you wrote them.

On macOS, the installed Google Chrome is used by default. Elsewhere, run `npx playwright install chromium` or set `CHROME_PATH`. Set `FFMPEG_PATH` if FFmpeg is not on your PATH. `PORT` chooses another local port; `HENGDIAN_DATA` chooses an independent workspace. Your saved work lives in `.hengdian/` by default—keep it when updating code.

```sh
npm run build
npm start
```

Production mode is still a local service. Public multi-tenant hosting is not configured.

## Direct your first scene

1. Open the library and select a complete scene: **rural road, urban street, classroom, hospital or Paris plaza**. Replacement requires confirmation; undo restores your previous scene.
2. Search the **30 built-in models**, add a prop or insert a reusable assembly. Each inserted object remains independently editable.
3. Select an actor. Choose a pose, adjust individual joints, or select a procedural walk, run, wave, talk or idle action. New actors use a 17-joint hierarchy. Older projects retain their original actor style until explicitly upgraded.
4. Save pose keys at selected times to direct a performance. Pose tracks override procedural actions for that shot. Position keys control travel independently.
5. Select a camera recipe, adjust the frame, play the shot and inspect contact and framing. Export the shooting pack.

The original courtyard, product studio and exterior sets, nine camera recipes and self-contained GLB import remain available. Full transforms, optimistic revision checking, atomic operations, undo/redo, annotations and disk recovery are shared across interfaces.

Built-in models are original MIT-licensed procedural geometry. The Eiffel tower is a simplified miniature, not a scan or an engineering model. See the [asset library](docs/ASSET-LIBRARY.md) for dimensions, pivots, anchors and extension contracts.

![Classroom, articulated actor and pose timeline in the English director](public/readme/director-expanded.png)

## Connect an agent

Start the local service, then launch the MCP server through your agent host:

```sh
npm run mcp
```

MCP uses stdio. Configure `HENGDIAN_URL` when using a non-default service port. The [Agent guide](docs/AGENTS.md) contains host configuration; the [director Skill](.agents/skills/direct-hengdian/SKILL.md) describes the workflow.

Useful tools include `read_project`, `list_catalog`, `use_scene_template`, `add_assembly`, `apply_operations`, `preview_shot`, `create_export` and `list_exports`. Read the current revision before writing; do not silently retry conflicts. Pose operations use the same validated project schema as the UI.

```sh
npm run cli -- --help
npm run cli -- catalog
npm run cli -- status
```

The new [classroom actor case](examples/actor-classroom/README.md) verifies scene setup, pose keys, actual previews and a separately checked 720p export through a real Codex run.

The [Codex example](docs/CODEX.md) records a real natural-language directing run and its limitations. DeepSeek harness compatibility still needs an independent host test; MCP availability alone does not prove it.

## What the shooting pack contains

- Editable project, actor poses and motion tracks.
- Referenced GLB files, reference MP4 and representative keyframes.
- Per-frame camera data and checksums; optional depth and object-ID frames.
- Procedural-runtime provenance for built-in actors and setpieces.

Built-in geometry is reconstructed by a compatible Cyber Hengdian runtime; standalone GLBs for procedural models are not included. A downstream video generator may use the reference video, but camera/depth/ID support depends on that workflow.

![Real previs examples](public/readme/scene-examples.jpg)

The previous [TapNow experiments](docs/showcase/TAPNOW.md) generated product and road clips. The product composition drifted and road characters retained their mannequin appearance. Those results are documented as limitations, not a claim of automatic photoreal conversion. TapNow is not directly integrated into this app.

## Extend and contribute

See [CONTRIBUTING](CONTRIBUTING.md), the [project format](docs/FORMAT.md), [asset library](docs/ASSET-LIBRARY.md), [internationalization](docs/INTERNATIONALIZATION.md) and [expansion plan](specs/DIRECTOR-EXPANSION.md). The [director landscape study](docs/research/DIRECTOR-LANDSCAPE.md) explains which mechanisms informed the design.

Core data and deterministic evaluation live in `src/core/`; Three.js geometry lives in `src/runtime/`; the director lives in `src/ui/`. Resource packs are data, not executable plugins. External models need accurate redistribution rights and provenance.

```sh
npm run check
npm run test:e2e
```

## Current limits

This is an early local workstation, not a full DCC, physics simulator or cloud collaboration platform. Joint controls are FK; there is no IK, automatic foot lock, grip constraint or arbitrary skeleton retargeting. Procedural walking runs in place unless you add root position keys. Camera paths currently interpolate between start and end positions. GLBs preserve their original units/pivots and use their first animation clip. Depth is linear 8-bit; transparent surfaces are treated as opaque in control passes. Full control-channel export is limited to 720 frames.


## Author and license

Created by **Cell**. Visit [cellinlab.com](https://cellinlab.com/), [Maker Matrix](https://zaowujuzhen.com/about), or [@cellinlab](https://x.com/cellinlab). The original author/contact section is preserved in the [Chinese README](README.md#关于作者).

[MIT](LICENSE). Keep the original copyright and license notice when reusing the code.
