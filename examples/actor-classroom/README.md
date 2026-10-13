# Codex classroom directing case

Import [the saved project](classroom.hengdian.json) to explore the resulting poses and shot.

The [natural-language brief](brief.md) exercises the built-in classroom, catalog poses, shot-local pose keys and actual image previews through the real Codex CLI. Start an isolated local service, point `HENGDIAN_URL` to that port, then run:

```sh
npm run codex:direct -- examples/actor-classroom/brief.md
```

This replaces the selected test workspace. It uses the existing authenticated Codex account and its normal allowance; it does not call a paid video-generation provider. Raw run logs stay local in `.hengdian/`.

On 2026-10-13, the real host discovered the expanded tools, used `use_scene_template`, saved three pose keys through `apply_operations`, rendered three `preview_shot` images, and read back the saved project. Independent comparison with the instantiated template verified that only the intended shot changed: other shots and all entity records were identical.

The root verification subsequently rendered and downloaded a 1280×720, 24fps, 48-frame shooting pack with depth/ID sequences, verified its hashes and decoded video, and reimported exact entity and pose-track data. The images show standing, lateral pointing and a raised-arm greeting. This is original FK previsualization; it does not establish natural human motion, foot locking or photoreal video generation.

Details and review limits are recorded in [expansion verification](../../docs/showcase/EXPANSION-VERIFICATION.md).
