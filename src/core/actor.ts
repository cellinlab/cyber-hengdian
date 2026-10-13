import { z } from 'zod';

export type Angles = [number, number, number];
export const jointDefinitions = [
  {
    id: 'root',
    label: '整体朝向',
    englishName: 'Root',
    min: [-180, -180, -180],
    max: [180, 180, 180],
  },
  { id: 'pelvis', label: '骨盆', englishName: 'Pelvis', min: [-50, -60, -40], max: [60, 60, 40] },
  { id: 'spine', label: '躯干', englishName: 'Spine', min: [-40, -70, -45], max: [65, 70, 45] },
  { id: 'neck', label: '颈部', englishName: 'Neck', min: [-35, -55, -30], max: [40, 55, 30] },
  { id: 'head', label: '头部', englishName: 'Head', min: [-35, -65, -30], max: [40, 65, 30] },
  {
    id: 'leftShoulder',
    label: '左肩',
    englishName: 'Left shoulder',
    min: [-180, -120, -165],
    max: [110, 120, 165],
  },
  {
    id: 'leftElbow',
    label: '左肘',
    englishName: 'Left elbow',
    min: [-155, -80, -5],
    max: [0, 80, 5],
  },
  {
    id: 'leftWrist',
    label: '左腕',
    englishName: 'Left wrist',
    min: [-80, -85, -45],
    max: [80, 85, 45],
  },
  {
    id: 'rightShoulder',
    label: '右肩',
    englishName: 'Right shoulder',
    min: [-180, -120, -165],
    max: [110, 120, 165],
  },
  {
    id: 'rightElbow',
    label: '右肘',
    englishName: 'Right elbow',
    min: [-155, -80, -5],
    max: [0, 80, 5],
  },
  {
    id: 'rightWrist',
    label: '右腕',
    englishName: 'Right wrist',
    min: [-80, -85, -45],
    max: [80, 85, 45],
  },
  {
    id: 'leftHip',
    label: '左髋',
    englishName: 'Left hip',
    min: [-135, -60, -50],
    max: [55, 60, 50],
  },
  { id: 'leftKnee', label: '左膝', englishName: 'Left knee', min: [0, 0, 0], max: [155, 0, 0] },
  {
    id: 'leftAnkle',
    label: '左踝',
    englishName: 'Left ankle',
    min: [-70, -25, -30],
    max: [50, 25, 30],
  },
  {
    id: 'rightHip',
    label: '右髋',
    englishName: 'Right hip',
    min: [-135, -60, -50],
    max: [55, 60, 50],
  },
  { id: 'rightKnee', label: '右膝', englishName: 'Right knee', min: [0, 0, 0], max: [155, 0, 0] },
  {
    id: 'rightAnkle',
    label: '右踝',
    englishName: 'Right ankle',
    min: [-70, -25, -30],
    max: [50, 25, 30],
  },
] as const;
export type JointId = (typeof jointDefinitions)[number]['id'];
export const actorTupleSchemas: z.ZodType[] = [];
const angleSchema = (min: readonly number[], max: readonly number[]) => {
  const tuple = z.tuple(
    [0, 1, 2].map((i) => z.number().finite().min(min[i]).max(max[i])) as [
      z.ZodNumber,
      z.ZodNumber,
      z.ZodNumber,
    ],
  );
  actorTupleSchemas.push(tuple);
  return tuple.default([0, 0, 0]);
};
const jointShape = Object.fromEntries(
  jointDefinitions.map((j) => [j.id, angleSchema(j.min, j.max)]),
) as Record<JointId, ReturnType<typeof angleSchema>>;
const offset = z.tuple([
  z.number().finite().min(-3).max(3),
  z.number().finite().min(-3).max(3),
  z.number().finite().min(-3).max(3),
]);
actorTupleSchemas.push(offset);
export const poseSchema = z
  .object({
    rootOffset: offset.default([0, 0, 0]),
    joints: z.object(jointShape).strict().prefault({}),
  })
  .strict()
  .prefault({});
export type Pose = z.infer<typeof poseSchema>;
export const actorSchema = z
  .object({
    pose: poseSchema,
    action: z.enum(['none', 'walk', 'run', 'wave', 'talk', 'idle']).default('none'),
    speed: z.number().finite().min(0).max(4).default(1),
    phase: z.number().finite().min(0).max(1).default(0),
  })
  .strict();
export type Actor = z.infer<typeof actorSchema>;
export const poseKeySchema = z
  .object({ time: z.number().finite().min(0).max(120), pose: poseSchema })
  .strict();
export type PoseKey = z.infer<typeof poseKeySchema>;
export const neutralPose = (): Pose => poseSchema.parse({});
const preset = (
  id: string,
  name: string,
  englishName: string,
  joints: Partial<Record<JointId, Angles>> = {},
  rootOffset: Angles = [0, 0, 0],
) => ({ id, name, englishName, pose: poseSchema.parse({ rootOffset, joints }) });

// Staging poses authored for this procedural rig under the repository MIT license.
export const posePresets = [
  preset('stand', '自然站立', 'Stand'),
  preset(
    'sit',
    '坐姿',
    'Sit',
    {
      leftHip: [-90, 0, 0],
      rightHip: [-90, 0, 0],
      leftKnee: [90, 0, 0],
      rightKnee: [90, 0, 0],
      leftElbow: [-75, 0, 0],
      rightElbow: [-75, 0, 0],
    },
    [0, -0.43, 0],
  ),
  preset(
    'kneel',
    '单膝跪地',
    'Kneel',
    {
      leftHip: [-90, 0, 0],
      leftKnee: [90, 0, 0],
      rightKnee: [104, 0, 0],
      rightAnkle: [-70, 0, 0],
      spine: [8, 0, 0],
    },
    [0, -0.43, 0],
  ),
  preset(
    'crouch',
    '蹲伏',
    'Crouch',
    {
      leftHip: [-65, 0, 8],
      rightHip: [-65, 0, -8],
      leftKnee: [110, 0, 0],
      rightKnee: [110, 0, 0],
      leftAnkle: [-45, 0, 0],
      rightAnkle: [-45, 0, 0],
      spine: [28, 0, 0],
      leftShoulder: [-35, 0, 0],
      rightShoulder: [-35, 0, 0],
      leftElbow: [-55, 0, 0],
      rightElbow: [-55, 0, 0],
    },
    [0, -0.37, 0],
  ),
  preset('reach', '向前伸手', 'Reach', {
    rightShoulder: [-80, 0, -10],
    rightElbow: [-10, 0, 0],
    spine: [12, 0, 0],
    head: [5, -10, 0],
  }),
  preset('point', '侧向指示', 'Point', {
    rightShoulder: [-80, -30, -35],
    rightElbow: [-5, 0, 0],
    rightWrist: [0, 0, -15],
    head: [0, -25, 0],
  }),
  preset('wave', '举手招呼', 'Wave', {
    leftShoulder: [-15, 0, 135],
    leftElbow: [-75, 0, 0],
    leftWrist: [0, 0, 15],
  }),
  preset(
    'run',
    '奔跑起势',
    'Run',
    {
      spine: [18, 0, 0],
      leftHip: [-55, 0, 0],
      rightHip: [35, 0, 0],
      leftKnee: [45, 0, 0],
      rightKnee: [90, 0, 0],
      leftShoulder: [40, 0, 0],
      rightShoulder: [-45, 0, 0],
      leftElbow: [-90, 0, 0],
      rightElbow: [-90, 0, 0],
    },
    [0, 0.04, 0],
  ),
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function clampPose(pose: Pose): Pose {
  const result = structuredClone(pose);
  for (const j of jointDefinitions)
    result.joints[j.id] = pose.joints[j.id].map((v, i) => clamp(v, j.min[i], j.max[i])) as Angles;
  result.rootOffset = pose.rootOffset.map((v) => clamp(v, -3, 3)) as Angles;
  return result;
}
function blendPose(a: Pose, b: Pose, t: number): Pose {
  const p = neutralPose();
  p.rootOffset = a.rootOffset.map((v, i) => v + (b.rootOffset[i] - v) * t) as Angles;
  for (const j of jointDefinitions)
    p.joints[j.id] = a.joints[j.id].map((v, i) => {
      let delta = b.joints[j.id][i] - v;
      // Only root's unrestricted axes wrap; constrained joints interpolate inside their allowed interval.
      if (j.id === 'root') delta = ((delta + 540) % 360) - 180;
      let value = v + delta * t;
      if (j.id === 'root' && (value > 180 || value < -180)) value = ((value + 540) % 360) - 180;
      return value;
    }) as Angles;
  return clampPose(p);
}

/** Explicit pose keys override the entire procedural action and hold before/after the keyed interval. */
export function sampleActor(actor: Actor, time: number, poseKeys: readonly PoseKey[] = []): Pose {
  if (!Number.isFinite(time)) throw Error('Actor time must be finite');
  if (poseKeys.length) {
    for (let i = 0; i < poseKeys.length; i++) {
      if (!Number.isFinite(poseKeys[i].time) || (i && poseKeys[i].time <= poseKeys[i - 1].time))
        throw Error('Pose keys must have strictly increasing finite times');
    }
    if (time <= poseKeys[0].time) return structuredClone(poseKeys[0].pose);
    for (let i = 1; i < poseKeys.length; i++)
      if (time <= poseKeys[i].time)
        return blendPose(
          poseKeys[i - 1].pose,
          poseKeys[i].pose,
          (time - poseKeys[i - 1].time) / (poseKeys[i].time - poseKeys[i - 1].time),
        );
    return structuredClone(poseKeys[poseKeys.length - 1].pose);
  }
  const p = structuredClone(actor.pose);
  const phase = (Math.max(0, time) * actor.speed + actor.phase) * Math.PI * 2;
  const add = (joint: JointId, axis: 0 | 1 | 2, value: number) => {
    p.joints[joint][axis] += value;
  };
  if (actor.action === 'walk' || actor.action === 'run') {
    const run = actor.action === 'run',
      amplitude = run ? 48 : 25;
    for (const [side, shift] of [
      ['left', 0],
      ['right', Math.PI],
    ] as const) {
      const cycle = phase + shift;
      const swing = Math.sin(cycle);
      add(`${side}Hip`, 0, -swing * amplitude);
      add(`${side}Knee`, 0, (run ? 12 : 3) + Math.max(0, -swing) * (run ? 95 : 55));
      add(`${side}Ankle`, 0, -Math.max(0, -swing) * (run ? 30 : 20));
      add(`${side}Shoulder`, 0, swing * (run ? 35 : 18));
      add(`${side}Elbow`, 0, run ? -85 : -12 - Math.max(0, swing) * 18);
    }
    add('spine', 0, run ? 13 : 3);
    add('pelvis', 1, Math.sin(phase) * 4);
    p.rootOffset[1] += (run ? 0.045 : 0.015) * (1 - Math.cos(phase * 2));
  } else if (actor.action === 'wave') {
    // Build on a neutral arm or the chosen static pose rather than accumulating transforms frame to frame.
    add('leftShoulder', 2, 125);
    add('leftShoulder', 0, -15);
    add('leftElbow', 0, -70);
    add('leftWrist', 2, Math.sin(phase) * 30);
    add('leftElbow', 1, Math.sin(phase) * 18);
  } else if (actor.action === 'talk') {
    add('rightShoulder', 0, -25 + Math.sin(phase) * 10);
    add('rightElbow', 0, -55 + Math.sin(phase + 0.7) * 18);
    add('leftElbow', 0, -20 + Math.sin(phase + 1.4) * 12);
    add('head', 0, Math.sin(phase * 0.5) * 4);
    add('head', 1, Math.sin(phase * 0.4) * 6);
  } else if (actor.action === 'idle') {
    add('spine', 0, Math.sin(phase * 0.3) * 1.5);
    add('head', 1, Math.sin(phase * 0.2) * 3);
    p.rootOffset[1] += Math.sin(phase * 0.3) * 0.003;
  }
  return clampPose(p);
}
