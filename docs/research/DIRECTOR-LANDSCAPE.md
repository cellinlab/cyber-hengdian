# Director workstations: useful mechanisms, not a feature-count contest

Research date: 2026-10-13. This is a primary-source desk study, not hands-on testing of every commercial product. Official feature descriptions establish what vendors document; they do not establish comparative quality or integration compatibility. Character and asset research are expanded in [character direction](CHARACTER-DIRECTION.md) and [scenes and licensing](SCENES-ASSETS.md).

## What to borrow

| Reference | Documented mechanism | Cyber Hengdian design implication | Delivery boundary |
| --- | --- | --- | --- |
| [Shot Designer official tutorials](https://www.hollywoodcamerawork.com/shot-designer-videos.html) | Actor/camera tracking, marks, snapping, timeline motion, shot data, wall/door/window layout | Build blocking around spatial relationships; use reusable room and street modules rather than an opaque backdrop | This wave: modules and editable placement. Persistent camera marks, wall drawing and shot schedules remain future work |
| [Wonder Unit Shot Generator](https://wonderunit.com/shot-generator/) | Position and pose figures, arrange cameras, construct shots using simple 3D elements | Lower time to a useful composition; a model library should start a shot, not become a modeling application | This wave: articulated actor, presets, complete starter scenes. The linked article is historical design material, not proof of the latest release |
| [Previs Pro official wiki](https://wiki.previspro.com/) | Script → boards → timeline; 3D sets, characters, optics based on sensor and lens; animatic and editorial exports | Keep story intent next to framing; maintain editable spatial structure alongside generated appearance | Current intent field and reference export retained. Physical lens/sensor controls, screenplay breakdown, audio and NLE sequence export deferred |
| [FrameForge edition comparison](https://support.frameforge.com/article/249-how-do-the-frameforge-editions-compare) and [posing docs](https://support.frameforge.com/category/31-posing-actors) | Actor posing, object interactions and edition-specific camera capabilities | Semantic interactions should eventually express “sit here”, “hold this”, “look at that”, not force every joint to be edited | This wave: explicit FK poses, joint limits and seats/entry anchors in model metadata. Automatic attachment/contact is not implemented |
| [Blender](CHARACTER-DIRECTION.md), [Cascadeur](CHARACTER-DIRECTION.md), [DesignDoll](CHARACTER-DIRECTION.md) | Richer posing and animation workflows, with different constraints and interaction models | Keep our actor description independent of an editor; later import/export adapters can use mature animation tools | Original procedural rig only; no claim of equivalent IK, physics, motion capture or arbitrary retargeting |
| [Cine Tracer, Unreal, Twinmotion and D5](SCENES-ASSETS.md) | Different strengths in shot staging, sequencing and reusable environments | Separate reusable set assets from shot-specific movement and camera instructions | Original browser-ready geometry and reusable assemblies; no engine dependency or imported proprietary asset library |

## First-principles priorities

A useful director workstation must reduce the distance between an intention and a repeatable shot. Four properties matter more than an enormous asset count:

1. **An editable world.** Every person, building and prop has stable identity, units and transforms. A scene preset is a starting point that can be taken apart. An asset is useful when its pivot, scale, front direction and placement anchors are predictable.
2. **An explicit performance.** Root travel, joint pose and camera motion are different tracks. Scrubbing backward and exporting must evaluate the same time identically. Pose keyframes take precedence over procedural movement; that rule must be visible to the creator.
3. **A shared directing language.** Browser, CLI and MCP use the same validated transactions. An AI should discover supported models and joint limits rather than invent fields. Errors and stale revisions are part of this interface, not reasons to silently overwrite.
4. **A testable handoff.** Save the scene, the camera, the exact pose data and the reference frames. A successful video-generation job is insufficient: compare positions, timing, contact and framing against intent.

The previous road experiment retained mannequin appearance in generated footage. Improving the body silhouette and available motion makes previs more expressive, but does not prove that a generation model will produce human skin or natural gait. Spatial reference and appearance reference need separate evaluation; no new paid generation is part of this implementation wave.

## What we should not copy blindly

A full DCC interface would overwhelm the task. Exposing seventeen joint controls is a fallback for precision, while presets and complete scenes should serve the first minute. Photoreal rendering is useful only when it does not obscure spatial reliability or make the browser unusable. A giant third-party library is not automatically redistributable: model download permission and inclusion in an open repository are distinct rights.

Likewise, a single model vendor should not own the saved project. The compatible runtime can recreate our procedural models; external GLBs remain content-addressed files. Skill instructions orchestrate the workflow, while schemas, API and deterministic rendering provide enforceable behavior. A Skill alone cannot replace these layers.

## Evidence limits

This research does not certify market leadership, exhaustive feature coverage, vendor pricing, quality parity or production-grade simulation. Exact integrations, exports and asset rights must be verified at the version actually used. The linked secondary research notes record narrower provenance and licensing constraints; undocumented capabilities remain unknown rather than assumed absent.
