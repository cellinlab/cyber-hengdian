# Cyber Hengdian

**Build a set once. Let people and AI keep directing it.**

[简体中文](README.md) · [Quick start](#quick-start) · [Three-part truck](examples/truck-parts/README.md) · [Agent setup](docs/AGENTS.md) · [Contributing](CONTRIBUTING.md)

Open virtual-production infrastructure for video creators and AI agents. Arrange a set, direct actors and cameras, assign semantic parts and appearance references, then export an editable shooting pack for your video workflow.

![Complete director workstation with asset library, scene preview, parts and appearance references, and shot timeline](public/readme/workstation-overview.png)

## Quick start

Requires **Node.js 22.12+**. Image previews require Chrome / Chromium; video encoding also requires FFmpeg.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4317**. The interface supports English and Simplified Chinese.

On macOS, installed Google Chrome is used by default. Elsewhere, run `npx playwright install chromium` or set `CHROME_PATH`. Set `FFMPEG_PATH` to choose FFmpeg, `PORT` to choose a service port, and `HENGDIAN_DATA` to choose a workspace. Saved work lives in the Git-ignored `.hengdian/` directory by default; preserve it when updating code.

```sh
npm run build
npm start
```

## From an idea to a shooting pack

1. **Build a set.** Choose a complete scene, add models or assemblies, or import a self-contained GLB.
2. **Direct the performance.** Adjust joints and poses. Save position and pose keys for each shot.
3. **Plan the camera.** Choose a recipe, set the opening and closing frame, and follow a stable subject.
4. **Assign parts and appearance.** Group meshes into a cab, cargo body or wheels, then bind appearance images to the object or individual parts.
5. **Inspect and export.** Play the previs, inspect part IDs and black-and-white masks, then export the project, motion, control passes and reference assets.

![Actual director with part selection, mask preview and appearance references](public/readme/parts-director.png)

## Features

| Task | Available tools |
| --- | --- |
| Set building | Courtyard, product studio and exterior sets; rural road, urban street, classroom, hospital and Paris plaza templates; original procedural models, 4 assemblies and GLB import |
| Actor direction | 17 joint groups, 8 pose presets, walk/run/wave/talk/idle actions; separate position and pose tracks |
| Camera direction | 9 camera recipes, free-layout and camera views, stable subject following and timed notes |
| Local constraints | Semantic parts, colored Part ID, individual black-and-white masks, object and part appearance references; [guide](docs/PARTS.md) |
| Continued editing | Atomic versioned operations, undo/redo, conflict detection and disk recovery; browser, CLI and MCP share one project |
| Tool handoff | Editable project, referenced assets, MP4 previs, keyframes, per-frame camera data and checksums; optional depth, object-ID and part-mask frames |

Masks describe visible boundaries; appearance images describe materials, colors and style. Downstream acceptance and structural consistency need their own validation. Hand off appearance references alongside previs so the generator has a visual target beyond the blockout geometry and procedural motion.

## Reusable examples

| Example | What to explore |
| --- | --- |
| [Three-part truck](examples/truck-parts/README.md) | Mesh grouping, occlusion, part masks, appearance binding and shooting-pack recovery |
| [Classroom actors](examples/actor-classroom/README.md) | Real Codex setup, joint-pose tracks, visual inspection and 720p export |
| [Courtyard meeting](docs/CODEX.md) | Natural-language scene building, camera changes and export |
| [Product and road scenes](examples/showcase/README.md) | Product framing, two-person blocking, camera movement and generator handoff |

The previous [TapNow experiments](docs/showcase/TAPNOW.md) record composition drift, mannequin appearance and mechanical walking. Completion and fulfillment of directing intent are documented separately.

## Direct with an agent

Start the local service, then have your agent host launch the stdio MCP server:

```sh
npm run mcp
```

Set `HENGDIAN_URL` when using another service port. The [Agent guide](docs/AGENTS.md) covers host configuration; the [director Skill](.agents/skills/direct-hengdian/SKILL.md) organizes reading, editing, previewing and exporting. Projects and assets remain independent open data.

```sh
npm run cli -- --help
npm run cli -- status
npm run cli -- catalog
```

An authenticated Codex CLI can run `npm run codex:direct -- examples/codex-courtyard/01-stage.md`. It invokes a real model and changes the connected workspace; use an independent directory for experiments. See [Codex verification](docs/CODEX.md) for tested scope. Other MCP hosts and DeepSeek Harness still need independent testing.

## Extend and contribute

Contribute a model, scene, camera recipe or reusable example. Resource packs contain data only. External models need accurate source and redistribution-license records.

- [Asset library](docs/ASSET-LIBRARY.md): units, pivots, assemblies and original procedural geometry.
- [Parts and references](docs/PARTS.md): grouping, mask semantics and reference handoff.
- [Project format](docs/FORMAT.md) · [Architecture](specs/ARCHITECTURE.md): shared data and deterministic rendering.
- [Contributing](CONTRIBUTING.md) · [Internationalization](docs/INTERNATIONALIZATION.md): development, verification and translation.
- [Expansion plan](specs/DIRECTOR-EXPANSION.md) · [Director research](docs/research/DIRECTOR-LANDSCAPE.md): current capabilities and future directions.

```sh
npm run check
npm run test:e2e
```

## Current limits

This is an early local workstation. Finished video generation happens in external tools; TapNow automation and public cloud collaboration are not built in. Actor controls use FK, with no IK, automatic foot lock, grip constraint or general skeleton retargeting. Procedural walking needs position keys for travel. Camera paths interpolate between start and end positions.

Control passes output visible surfaces and treat transparent geometry as opaque. Depth is linear 8-bit; full control-channel export is limited to 720 frames. GLBs retain their units and pivots and use the first animation by default. Built-in sets are previs geometry reconstructed by a compatible runtime; standalone GLBs are not included in shooting packs. See the [format guide](docs/FORMAT.md).


## Author and license

Created by **Cell**. Visit [cellinlab.com](https://cellinlab.com/), [Maker Matrix](https://zaowujuzhen.com/about), or [@cellinlab](https://x.com/cellinlab). The original contact and sponsorship section is preserved in the [Chinese README](README.md#关于作者).

[MIT](LICENSE). Keep the original copyright and license notice when reusing the code.
