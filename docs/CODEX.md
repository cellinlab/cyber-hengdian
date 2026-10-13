# Direct with a real Codex session

The launcher connects an already authenticated Codex CLI to the running local director through stdio MCP. It invokes a real model; this consumes the account's normal Codex allowance. It does not need a separate API key or modify the user's global Codex configuration.

Requirements: install the repository dependencies, run the director, and have `codex` on PATH with a working login. The tested CLI is `0.162.0-alpha.17.2`. The launcher uses `--no-daemon`, `--ignore-user-config`, JSON events and invocation-scoped MCP configuration; older CLIs must support these switches. Ignoring user configuration keeps this case isolated from unrelated MCP servers while retaining Codex authentication. The CLI's default model is used. The directing brief authorizes local scene edits and shooting-pack export: the launcher sets invocation-scoped `approval_mode="approve"` only for `apply_operations` and `create_export`. The shell remains read-only. Other write tools, user rules and managed policy are not relaxed. The target service and current project are printed before execution.

```sh
npm run dev
# In another terminal:
npm run codex:direct -- examples/codex-courtyard/01-stage.md
```

This edits the service's current scene. For an isolated experiment, start another service with a new `PORT` and `HENGDIAN_DATA`, then set `HENGDIAN_URL` to that port for the launcher. Never point a destructive new-scene brief at a creator's active project by accident.

The launcher supplies its current installation directory explicitly for both new and resumed sessions, so a moved checkout does not silently reuse an old working directory. The terminal prints the actual session ID. After reviewing the first result, resume that exact session for the camera revision and exports:

```sh
HENGDIAN_URL=http://127.0.0.1:4341 npm run codex:direct -- examples/codex-courtyard/01-stage.md
HENGDIAN_URL=http://127.0.0.1:4341 npm run codex:direct -- examples/codex-courtyard/02-reframe-export.md SESSION_ID
```

The first brief describes a three-shot courtyard meeting in natural language. The second asks for a lower, tighter camera in shot two while preserving actor identity, motion and the other cameras. It then requests three independent shooting-pack exports with synchronized depth and object-ID frames. The model constructs schema-valid operations; the briefs do not contain predetermined scene JSON.

The attached [director skill](../.agents/skills/direct-hengdian/SKILL.md) defines the workflow. Read project/schema, apply a revisioned transaction, read back, inspect actual rendered frames, then export and await completion. The repository remains a shared deterministic tool; the model does not own a second scene store.

## Evidence and acceptance

Each run writes ignored local evidence under `.hengdian/codex-case/<timestamp>/`:

- `prompt.md`, `run.json`: brief, target service and resume metadata.
- `events.jsonl`, `stderr.log`: actual Codex events and diagnostics. Image tool results may contain base64, so raw events are intentionally not printed to the terminal or committed.
- `before.json`, `after.json`: service readback before and after the session.
- `final.md`: the model's final report, which is a claim to verify.

Exit code zero proves the CLI finished. It does **not** prove that the creative task succeeded. Require the actual scene change, visible framing/motion, stable-ID preservation, completed export jobs and physical artifact checks. A model may correctly end a blocked task with exit zero.

## Real-host regression discovered

The first live run on 2026-10-13 connected successfully and returned a real preview image, but Codex omitted `apply_operations` during discovery with `invalid type: map, expected a string`. The SDK protocol tests had accepted the schema. The model reported the missing tool and left revision zero unchanged, rather than substituting shell HTTP calls. This is why the real host test is separate from SDK integration tests.

A second real run exposed a separate configuration issue: with read-only shell and approval policy `never`, the discovered write tool still required approval and was rejected. The launcher now represents the user's directing authorization explicitly for the two required MCP tools instead of broadening filesystem access. Both failed runs left the project unchanged and remain part of the local evidence.

## Accepted real-model workflow (2026-10-13)

The corrected test used one real Codex CLI session and resumed that same session for the second natural-language brief. The original creator workspace stayed on its own service; this case used a separate port and data directory.

| Stage | Observed result |
| --- | --- |
| Natural-language staging | Model created a 10-second, three-shot courtyard meeting, 3/4/3 seconds, 16:9, 24fps. It constructed typed transactions without a prewritten target scene. |
| Visual correction | On actual PNGs the model noticed a bench hiding the approaching actor's legs. It moved the meeting area forward, preserved cut continuity and reviewed nine final start/middle/end frames at revision 2. |
| Follow-up camera brief | Same session lowered shot two from approximately 2.1m to 1.35m, tightened FOV from 40° to 38°, and moved the camera forward about 0.85m. Three new PNGs showed both actors and the yellow box in frame. |
| Preservation | Deep comparison proved every entity, every motion track, both other shots and all durations stayed identical. Only revision and the second camera changed, revision 2 → 3. |
| Export | Model sequentially invoked three real 640-wide exports with controls enabled and awaited each `complete` result. The service independently reported all three jobs complete at revision 3. |
| Independent review | A second agent inspected all nine first-round frames and the three revised-camera frames; lower/tighter framing and visibility were confirmed. Physical ZIP/video checks and playback are separate from the model's export-status claims. |
| Physical package validation | All three ZIPs passed file-size and SHA-256 verification (501 manifest-listed files). FFprobe confirmed 72/96/72 frames, 24fps, 640×360: 240 frames and 10 seconds total. All 240 depth and 240 ID frames were decoded and checked; every camera sample matched the saved project. |
| Actual playback | All three director shots played to their ends without browser console errors. A concatenated reference MP4 played to 10 seconds in Chrome with no video error. The concat is a viewing convenience; the individual ZIPs remain the handoff source. |
| Download | Each actual export URL returned HTTP 200; its downloaded bytes had the same SHA-256 as the verified local ZIP. |
| Restore | An actual ZIP was imported through the director UI into an independent workspace. All three shots, five entities, stable IDs, tracks and camera settings matched; only the destination workspace's revision changed. |

The case also exposed parallel preview requests colliding with the single renderer. The service now serializes a bounded preview queue. These fixes came from actual host behavior; the SDK contract suite was expanded afterward.

The delivery check caught another issue that non-hidden temporary test directories had masked: Express refused downloads under the default `.hengdian` path, even though exports were complete on disk. The hash-validated asset route and completed-export route now explicitly allow their selected files under the hidden workspace. A regression creates a real 12-frame video there and downloads the resulting ZIP; the rest of the workspace remains unserved.

Reusable output: [editable case project](../examples/codex-courtyard/project.hengdian.json). Run `npx tsx tools/verify-shooting-pack.ts path/to/pack.zip` to repeat physical artifact checks. This validates bytes, timings and channels, not cinematic quality. The third shot's plant silhouette behind the actor is a remaining composition refinement; no grasping animation or foot IK is claimed.

This proves the **installed Codex CLI + local Chrome/FFmpeg** workflow for this case. It is not certification of native MCP inside a desktop chat, every Codex version, DeepSeek Harness or arbitrary-model vision. The footage remains white-model previsualization, not external AI video generation or publication. Raw local transcripts and images remain ignored; reusable natural-language briefs are in `examples/codex-courtyard/`.

Official references: [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp), [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands).
