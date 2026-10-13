# Director infrastructure expansion

Status: implementation wave, 2026-10-13. The long-term target is broad creative freedom with reusable open assets and provider-independent directing. “Best and most complete” is an ambition, not a verified product claim.

## Architecture and interaction

`Intent → editable project → deterministic time sample → visual inspection → shooting pack → downstream generation → comparison`

- `core/actor.ts`: bounded pose data, original pose presets and procedural actions. Pose keys belong to a shot. Root travel stays in transform tracks. New actors use a hierarchical rig; old actor records without a rig retain legacy rendering until explicitly upgraded.
- `core/model-ids.ts`: independent stable identifiers. `core/library.ts`: bilingual metadata, metre dimensions, floor pivot, +Z front, placement anchors, scene and assembly factories. An assembly inserts individual editable entities atomically; it is not a persistent group hierarchy.
- `runtime/actor.ts` and `runtime/setpieces.ts`: geometry only. They consume evaluated state and do not own project history or animation time.
- `core/schema.ts`, `core/project.ts`, server Store: validate and apply versioned atomic edits; undo/redo and complete project save include actor and setpiece data. Concurrent edits fail visibly.
- Director UI: search → add model / insert assembly / confirm scene replacement → select entity → edit transform or pose → key the pose at current time → play and inspect → export.
- MCP: discover catalog, use scene template, add assembly, apply typed pose operations, render actual previews, export and poll. CLI can submit the same operation JSON. No hidden provider-specific world state.
- Locale: Chinese and English UI with a persistent selector; metadata supports both languages. Saved user-authored names, notes and intents are not translated automatically.

## This wave

| Workstream | Concrete scope | Required proof |
| --- | --- | --- |
| Character | 17 joint groups, bounded XYZ angles, 8 pose presets, 5 procedural actions plus static, shot pose keyframes | Joint hierarchy, constraints, deterministic seeking, real render and save/reload |
| Set library | 30 original procedural models; countryside, city street, classroom, hospital, Paris plaza; 4 assemblies | Valid template data, useful initial cameras, editable entities and correct scale/pivots |
| Agent interface | Catalog metadata, scene/assembly operations and pose schema | Real MCP discovery and transaction, conflict/replay behavior, actual preview |
| Internationalization | Chinese/English director and English getting-started documentation | Switch and reload, translated controls, preserve user text |
| Delivery | Extend existing shooting pack with procedural runtime provenance | Rendered frames/video, pose data round-trip, schema/build/functional/browser checks |

## Next capability tiers (not implemented by this wave)

1. **Contact and intention.** Ground foot lock, two-bone IK, hand/prop attachment, look-at constraints, seat anchors and automatic placement. Acceptance: sitting, drinking and door interaction remain in contact at arbitrary seek times and after export. Do this before claiming physically natural motion.
2. **Camera and staging depth.** Curved paths/easing, dolly/orbit rigs, lens and sensor models, focus plane, editable lights, top-down blocking diagrams, wall drawing, multi-select and persistent prefab groups. Acceptance: camera geometry and timing match exported data and undo restores group relations.
3. **Characters and motion interchange.** Rigged GLB animation selection, humanoid mapping, retargeting, pose/motion capture imports, layered clips and appearance references. Acceptance: three structurally different licensed rigs, with round-trip and contact tests; no universal-retargeting claim from one demo.
4. **Production orchestration.** Script breakdown, coverage alternatives, continuity checks, sound/dialogue timing, sequence exports, generation-provider adapters and side-by-side intention compliance review. Acceptance: provider errors, cost limits, retries and final media verified separately.
5. **Community infrastructure.** Versioned asset registry, reusable director recipes, catalog thumbnails, linting for units/pivot/license, manifest compatibility and measured asset budgets. Acceptance: a new contributor publishes a pack that another user imports without custom code. Provider-specific credentials stay local.

## Contribution contracts

New setpieces need a stable ID, original or documented redistributable source, bilingual metadata, correct bounding dimensions and a ground pivot. New poses need bounded joint data and a visual contact review. New actions must sample time directly, never accumulate deltas. New locale keys need typed coverage and accessible labels. New adapters must show real host execution separately from protocol tests.

The initial 30 assets are compact original stage models. They are not a photoreal city kit, engineering models or scans of landmarks. Built-in geometry is recreated by the compatible Cyber Hengdian runtime; shooting packs do not yet contain standalone GLBs for these procedural models.

## New priority: parts and appearance references

The creator's vehicle example exposes a gap between object-level IDs and controllable semantic parts. The proposed next capability is [part structure control](PART-CONTROL.md): stable part labels, visible-surface mask sequences and part-bound appearance references, with honest downstream capability reporting. This is a proposed extension, not an implemented feature of the current wave.
