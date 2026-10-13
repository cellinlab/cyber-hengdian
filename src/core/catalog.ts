import { identity, uid, type Project, type Entity, type Shot, type Vec3 } from './schema';
export const packs = [
  {
    id: 'courtyard',
    name: '午后庭院',
    subtitle: '人物 · 对白 · 日常',
    description: '暖色建筑、树影与长椅。用共享片场组织不同视角。',
    color: '#cfbfa4',
    version: '1.0.0',
    license: 'MIT',
  },
  {
    id: 'studio',
    name: '无界摄影棚',
    subtitle: '产品 · 展示 · 广告',
    description: '弧面背景、展台与柔光。把注意力留给你的主角。',
    color: '#adbbc4',
    version: '1.0.0',
    license: 'MIT',
  },
  {
    id: 'exterior',
    name: '旷野公路',
    subtitle: '运动 · 旅程 · 奇遇',
    description: '地形、道路与远山。空间路径和摄影机共同叙事。',
    color: '#b8bd9b',
    version: '1.0.0',
    license: 'MIT',
  },
] as const;
export const props = [
  { kind: 'actor', name: '演员', color: '#bc684e' },
  { kind: 'product', name: '产品', color: '#75929a' },
  { kind: 'box', name: '方块', color: '#d6c5a9' },
  { kind: 'sphere', name: '球体', color: '#9ba880' },
  { kind: 'cylinder', name: '圆柱', color: '#bbb7ab' },
  { kind: 'plant', name: '绿植', color: '#69806a' },
  { kind: 'chair', name: '椅子', color: '#947860' },
  { kind: 'table', name: '圆桌', color: '#a0896b' },
] as const;
export const recipes = [
  {
    id: 'wide',
    name: '建立空间',
    note: '完整交代主体与环境',
    from: [7, 4, 9],
    to: [6, 3.5, 8],
    target: [0, 1, 0],
  },
  {
    id: 'push',
    name: '缓慢推进',
    note: '从环境走向主体',
    from: [3, 2, 7],
    to: [1.5, 1.7, 4],
    target: [0, 1, 0],
  },
  {
    id: 'profile',
    name: '侧面观察',
    note: '以横向关系组织人物',
    from: [7, 2, 1],
    to: [6, 2, 1],
    target: [0, 1, 0],
  },
  {
    id: 'reveal',
    name: '横移揭示',
    note: '通过横向移动打开空间',
    from: [-5, 2, 6],
    to: [4, 2, 6],
    target: [0, 1, 0],
  },
  {
    id: 'high',
    name: '升起俯瞰',
    note: '从人物回到整体',
    from: [3, 3, 5],
    to: [3, 9, 5],
    target: [0, 0, 0],
  },
  {
    id: 'close',
    name: '主体特写',
    note: '集中于一个人的动作',
    from: [1.4, 1.8, 3],
    to: [1.2, 1.7, 2.6],
    target: [0, 1.2, 0],
  },
  {
    id: 'reverse',
    name: '反向视角',
    note: '从空间另一侧重新观察',
    from: [-5, 2, -5],
    to: [-4, 2, -4],
    target: [0, 1, 0],
  },
  {
    id: 'product',
    name: '产品弧移',
    note: '在一段弦线中展示轮廓',
    from: [3, 2, 4],
    to: [-3, 2, 4],
    target: [0, 1, 0],
  },
  {
    id: 'static',
    name: '固定机位',
    note: '让场内动作成为叙事',
    from: [0, 2.2, 7],
    to: [0, 2.2, 7],
    target: [0, 1, 0],
  },
] as const;
export function newEntity(kind: Entity['kind'], position: Vec3 = [0, 0, 0]): Entity {
  const preset = props.find((p) => p.kind === kind);
  return {
    id: uid(),
    kind,
    name: preset?.name ?? '模型',
    color: preset?.color ?? '#bcbcbc',
    transform: identity(position),
    locked: false,
  };
}
export function newShot(recipeId = 'wide', target: Vec3 = [0, 0, 0]): Shot {
  const r = recipes.find((r) => r.id === recipeId) ?? recipes[0];
  const offset = (v: readonly number[]) => v.map((x, i) => x + target[i]) as Vec3;
  return {
    id: uid(),
    name: r.name,
    duration: 6,
    intent: r.note,
    tracks: {},
    camera: {
      from: offset(r.from),
      to: offset(r.to),
      target: offset(r.target),
      targetEnd: offset(r.target),
      fov: 42,
      follow: null,
    },
  };
}
export function createProject(environment: Project['environment'] = 'courtyard'): Project {
  const entities =
    environment === 'studio'
      ? [newEntity('product', [0, 0.8, 0]), newEntity('cylinder', [0, 0, 0])]
      : [
          newEntity('actor', [-1.3, 0, 0]),
          newEntity('actor', [1.2, 0, 0.1]),
          newEntity('table', [0, 0, -1.6]),
          newEntity('plant', [-3.3, 0, -2.3]),
        ];
  if (environment === 'studio') entities[1].transform.scale = [1.8, 0.8, 1.8];
  else {
    entities[0].name = '演员 A';
    entities[1].name = '演员 B';
    entities[1].color = '#738e91';
    entities[1].transform.rotation = [0, 1, 0, 0];
  }
  const shots = [
    newShot('wide'),
    newShot(environment === 'studio' ? 'product' : 'push'),
    newShot('close', entities[0].transform.position),
  ];
  return {
    schemaVersion: 'hengdian/1',
    id: uid(),
    name:
      environment === 'studio'
        ? '一件物品的肖像'
        : environment === 'exterior'
          ? '去远方的路上'
          : '午后的一次相遇',
    revision: 0,
    fps: '24',
    aspect: '16:9',
    environment,
    packVersion: '1.0.0',
    entities,
    shots,
    notes: [],
  };
}
