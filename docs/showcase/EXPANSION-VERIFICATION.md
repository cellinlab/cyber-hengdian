# Director expansion verification

Date: 2026-10-13. Status: locally verified implementation; no public deployment, release or video-generation outcome is implied.

## Delivered scope

- 17 articulated joint groups, eight original pose presets, five procedural actions plus static, bounded joint angles and shot-local pose keys.
- 30 original procedural models, four insertable assemblies and five complete scene templates.
- Chinese/English UI, language persistence, searchable assets, grid snapping and English getting-started documentation.
- Catalog and MCP scene/assembly tools; existing typed transactions now include pose edits. Export records procedural runtime provenance and preserves pose data.

## Automated checks

`npm run check` passed: formatting, published/runtime schema parity, project/template and author-asset rules, **79 tests**, TypeScript and production build. `npm run test:e2e` passed **12 browser scenarios**, including mobile panels, old GLB/pack import, pose controls and persistence, locale switch/reload, scene replacement, asset search/add/undo, assembly append and deterministic rig rendering.

Earlier integration failures were test-fixture issues: a fixture converting an actor directly into a GLB needed to remove the newly added actor data, and the new scenario had to reopen the library after selecting an added object and use the actual localized assembly name. They were corrected; runtime validation remained strict.

## Real Codex host

The authenticated local Codex CLI ran the [classroom brief](../../examples/actor-classroom/brief.md) through stdio MCP against an isolated service. It discovered the new catalog and schemas, used `use_scene_template`, edited the second classroom shot to two seconds with three pose keys, requested actual previews at 0/1/2 seconds, and read back the final project at revision 5. No discovery-schema rejection or edit-tool denial occurred.

Independent comparison of the template tool result and final snapshot confirmed that only one shot changed. All entity records and the other two shots were identical. This establishes a real host workflow for these capabilities, not universal host/model compatibility. DeepSeek Harness remains untested.

The saved result is [an importable project](../../examples/actor-classroom/classroom.hengdian.json).

## Rendered pack and playback

After the Codex run, an independent export produced a 1280×720 H.264 reference video, 24fps, 48 frames, two seconds; RGB keyframes, 48 depth frames, 48 ID frames, camera data, complete project and provenance/checksums accompanied it. The verifier checked **103 manifest-listed files**, decoded video, frame count/duration, dimensions and control channels. Reimport preserved every entity and shot, including all pose key data; only the saved workspace revision advanced to 6.

The original exported MP4 was opened in the real browser and played to the end: `ended=true`, `currentTime=duration=2`, no media error, 1280×720. The visible sequence changes from standing to lateral gesture to raised-arm greeting; the actor remains fully within the frame as the camera advances. These FK interpolation poses are a motion reference, not evidence of physically natural acting.

![Actual Codex classroom scene with pose keyframes](../../public/readme/director-expanded.png)

## Visual and UI review

The separate [library review](LIBRARY-REVIEW.md) records 28 actual rendered samples across all five templates and the scene fixes they prompted. Additional Chrome UI checks verified language switching/reload, joint presets and numbers, zero/three-second keys, classroom replacement and one-transaction assembly insertion. An action-plus-pose editing bug was found during review: writing an evaluated pose back into a still-active procedural base would apply the action twice. Editing a visible pose while an action is active now creates a pose key that overrides it; the global action and base remain unchanged.

New rig and model data were checked independently of legacy actor rendering. Existing projects without articulated actor data retain the earlier figure and movement path until explicitly upgraded. An additional pose regression fixed a kneeling foot penetrating the ground.

## Evidence and limits

Raw host events, snapshots, media, screenshots and SHA records stay in ignored `.hengdian/expansion-codex`, `.hengdian/director-expansion`, `.hengdian/library-review`, and `.hengdian/i18n-evidence`. Public docs include selected screenshots and reusable non-secret project data. These local evidence paths are not remote backup claims.

No IK, foot lock, arbitrary rig retargeting, full physics, automatic mesh segmentation or Part ID interface was implemented. Five scene templates were reviewed through sampled frames; this does not certify every camera/time/object permutation. A provider-specific workflow must still verify whether it accepts depth/ID/appearance references. [Part structure control](../../specs/PART-CONTROL.md) is a proposed next capability, not a current feature.
