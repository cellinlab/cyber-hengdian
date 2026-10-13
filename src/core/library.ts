import { truckParts } from './parts';
import { identity, uid, type Entity, type Project, type Vec3 } from './schema';
import { newEntity, newShot } from './catalog';
import { sampleActor } from './actor';
import { modelIds, type ModelId } from './model-ids';
export { modelIds } from './model-ids';
export type { ModelId } from './model-ids';

export type LocalizedText = { zh: string; en: string };
export type AssetCategory =
  'landmark' | 'building' | 'street' | 'nature' | 'classroom' | 'hospital' | 'furniture';
export type Anchor = {
  id: string;
  role: 'entry' | 'actor' | 'camera' | 'seat';
  position: Vec3;
  yaw: number;
};
export type AssetDefinition = {
  id: ModelId;
  name: LocalizedText;
  description: LocalizedText;
  category: AssetCategory;
  tags: string[];
  dimensions: Vec3;
  color: string;
  front: Vec3;
  pivot: Vec3;
  anchors: Anchor[];
  source: string;
  license: 'MIT';
  version: '1.0.0';
};
const source = 'Cyber Hengdian original procedural geometry';
const entry = (
  id: ModelId,
  zh: string,
  en: string,
  category: AssetCategory,
  dimensions: Vec3,
  color: string,
  description: LocalizedText,
  tags: string[] = [],
  anchors: Anchor[] = [],
): AssetDefinition => ({
  id,
  name: { zh, en },
  description,
  category,
  dimensions,
  color,
  tags: [zh, en, category, ...tags],
  anchors,
  front: [0, 0, 1],
  pivot: [0, 0, 0],
  source,
  license: 'MIT',
  version: '1.0.0',
});
const text = (zh: string, en: string): LocalizedText => ({ zh, en });
export const assetLibrary: AssetDefinition[] = [
  entry(
    'truck',
    '三部件卡车',
    'Three-part truck',
    'street',
    [2.5, 2.8, 6.5],
    '#b8c0c5',
    text('原创车头、车厢与车轮三部件卡车。', 'Original truck with separate cab, cargo and wheels.'),
    ['vehicle', '车辆', '卡车'],
  ),
  entry(
    'eiffel-tower',
    '埃菲尔铁塔 · 缩尺',
    'Eiffel tower · miniature',
    'landmark',
    [2.7, 6.6, 2.7],
    '#7d7565',
    text(
      '原创简化缩尺轮廓，高约6.45米；非实物扫描。',
      'Original simplified 6.45m miniature silhouette, not a scan.',
    ),
    ['巴黎', 'Paris', '铁塔', '地标'],
  ),
  entry(
    'clock-tower',
    '广场钟楼',
    'Clock tower',
    'landmark',
    [1.6, 6.18, 1.6],
    '#b6a18a',
    text('钟面、塔身与坡屋顶组成的广场地标。', 'Square landmark with clock face and pitched roof.'),
    ['广场', 'tower'],
  ),
  entry(
    'cottage',
    '乡村小屋',
    'Village cottage',
    'building',
    [4.2, 3.65, 3.5],
    '#d8c2a0',
    text('坡屋顶、烟囱、真实门洞；可从前门进入。', 'Pitched roof, chimney and open front doorway.'),
    ['房屋', '乡村', 'house'],
    [{ id: 'entrance', role: 'entry', position: [0, 0, 1.8], yaw: Math.PI }],
  ),
  entry(
    'apartment',
    '城市楼立面',
    'Apartment facade',
    'building',
    [4.25, 7.77, 2.25],
    '#b7b6aa',
    text(
      '四层窗格立面，用于街道纵深；不是可进入室内。',
      'Four-storey street facade; exterior only.',
    ),
    ['楼房', '城市', 'facade'],
  ),
  entry(
    'shopfront',
    '街角店面',
    'Shopfront',
    'building',
    [4.5, 2.9, 2.35],
    '#aa9784',
    text('双橱窗、门与遮阳檐的通用店面。', 'Generic storefront with display windows and awning.'),
    ['商店', '店铺', 'store'],
  ),
  entry(
    'road-straight',
    '双向直路',
    'Straight road',
    'street',
    [6, 0.055, 12],
    '#777d7b',
    text('6米宽、12米长，含车道中线和路缘线。', '6m wide, 12m long road with lane markings.'),
    ['道路', '公路'],
  ),
  entry(
    'sidewalk',
    '人行道',
    'Sidewalk',
    'street',
    [2, 0.19, 12],
    '#c9c1af',
    text('2米宽的人行空间，可沿街连续拼接。', '2m wide pavement for repeated street segments.'),
    ['路肩', 'pavement'],
  ),
  entry(
    'crosswalk',
    '斑马线',
    'Crosswalk',
    'street',
    [6, 0.06, 2.7],
    '#777d7b',
    text('横跨6米车行道的可移动斑马线段。', 'Moveable crossing for a 6m carriageway.'),
    ['过街', 'zebra'],
  ),
  entry(
    'streetlight',
    '路灯',
    'Streetlight',
    'street',
    [1.35, 4.2, 0.4],
    '#616c69',
    text(
      '单臂灯杆，用于街道尺度与节奏；外形道具。',
      'Single-arm street lamp prop; not a light source.',
    ),
    ['灯杆', 'lamp'],
  ),
  entry(
    'tree',
    '阔叶树',
    'Broadleaf tree',
    'nature',
    [2.7, 3.6, 2.4],
    '#839567',
    text('树干与三团树冠，程序化原创建模。', 'Original trunk and three clustered crowns.'),
    ['植被', '绿化'],
  ),
  entry(
    'fence',
    '木围栏',
    'Timber fence',
    'nature',
    [3.12, 1.1, 0.12],
    '#ad9472',
    text('3米节段，适合田边与道路边界。', '3m module for fields and roadside boundaries.'),
    ['乡村', 'fencing'],
  ),
  entry(
    'school-desk',
    '课桌椅',
    'Student desk and chair',
    'classroom',
    [0.95, 0.99, 1.36],
    '#c4a579',
    text('单人桌椅为整体；学生朝+Z方向坐。', 'Single desk and chair assembly, student faces +Z.'),
    ['教室', '桌椅', 'student'],
    [{ id: 'seat', role: 'seat', position: [0, 0.48, -0.53], yaw: 0 }],
  ),
  entry(
    'blackboard',
    '黑板',
    'Blackboard',
    'classroom',
    [3.25, 2.475, 0.3],
    '#3f6059',
    text('带木框、支脚与粉笔痕迹的独立黑板。', 'Freestanding chalkboard with timber frame.'),
    ['讲台', '教学'],
  ),
  entry(
    'bookshelf',
    '书柜',
    'Bookshelf',
    'furniture',
    [1.5, 2.125, 0.45],
    '#ad9472',
    text('四层彩色书本，适合教室与候诊室。', 'Four shelves of books for rooms and waiting areas.'),
    ['书架', 'bookcase'],
  ),
  entry(
    'hospital-bed',
    '病床',
    'Hospital bed',
    'hospital',
    [1.06, 1.0, 2.14],
    '#9bbed0',
    text('床垫、薄被、枕头、护栏和脚轮。', 'Mattress, blanket, pillow, end rails and wheels.'),
    ['医院', '病房', 'bed'],
    [{ id: 'bedside', role: 'actor', position: [1.1, 0, 0], yaw: -Math.PI / 2 }],
  ),
  entry(
    'iv-stand',
    '输液架',
    'IV stand',
    'hospital',
    [0.65, 1.975, 0.65],
    '#bdcec8',
    text('支架和液袋的叙事道具，不模拟治疗。', 'Stand and bag prop; no medical simulation.'),
    ['医院', '病房'],
  ),
  entry(
    'monitor',
    '床边监护仪',
    'Bedside monitor',
    'hospital',
    [0.65, 1.26, 0.42],
    '#b6c7c7',
    text(
      '屏幕波形为固定装饰，不是真实患者数据。',
      'Display waveform is decorative, not patient data.',
    ),
    ['医院', '设备'],
  ),
  entry(
    'reception',
    '接待台',
    'Reception counter',
    'hospital',
    [3.15, 1.41, 0.9],
    '#96b4b7',
    text(
      '通用接待台，可用于医院或办公大厅。',
      'Generic reception counter for clinics and offices.',
    ),
    ['前台', '登记'],
  ),
  entry(
    'wall-panel',
    '墙板',
    'Wall panel',
    'building',
    [3, 3.1, 0.16],
    '#d8d2c2',
    text('3米宽室内墙段，整体可移动。', 'Moveable 3m interior wall section.'),
    ['墙', 'room'],
  ),
  entry(
    'doorway',
    '门洞墙',
    'Open doorway',
    'building',
    [3, 3.1, 0.25],
    '#d8d2c2',
    text('1.1米宽真实开口与木框，无门扇阻挡。', 'Real 1.1m opening with frame, no blocking door.'),
    ['门', '通道'],
    [{ id: 'entrance', role: 'entry', position: [0, 0, 0.35], yaw: Math.PI }],
  ),
  entry(
    'window-wall',
    '开窗墙',
    'Window opening',
    'building',
    [3, 3.1, 0.2],
    '#d8d2c2',
    text('通透窗洞与十字框，保留室内拍摄光线。', 'Open window and mullions for interior staging.'),
    ['窗', '采光'],
  ),
  entry(
    'bench',
    '长椅',
    'Bench',
    'furniture',
    [2, 1.01, 0.58],
    '#aa9271',
    text('双人长椅，座面约0.5米。', 'Two-person bench with approximately 0.5m seat.'),
    ['候诊', '广场'],
  ),
  entry(
    'bollard',
    '隔离桩',
    'Bollard',
    'street',
    [0.23, 0.85, 0.23],
    '#6b7672',
    text('道路边界用短柱，带浅色环。', 'Short street boundary post with pale band.'),
    ['路桩'],
  ),
  entry(
    'planter',
    '绿植花池',
    'Planter',
    'nature',
    [1.1, 1.37, 1.1],
    '#7e9266',
    text('方形花池和低矮灌木。', 'Square planter with low shrub.'),
    ['绿化', 'bush'],
  ),
  entry(
    'bus-stop',
    '公交站亭',
    'Bus shelter',
    'street',
    [3.5, 2.61, 1.8],
    '#697f80',
    text('有顶候车亭和座椅，无品牌标识。', 'Covered shelter with bench, no branding.'),
    ['公交', '候车'],
  ),
  entry(
    'traffic-light',
    '交通灯',
    'Traffic light',
    'street',
    [0.36, 3.09, 0.32],
    '#4f5b57',
    text('三色交通灯造型，当前没有信号逻辑。', 'Three-color signal prop, no traffic logic.'),
    ['红绿灯'],
  ),
  entry(
    'stairs',
    '四级台阶',
    'Four steps',
    'building',
    [2, 0.64, 1.28],
    '#c4b99f',
    text('每级高0.16米，+Z一侧是低阶入口。', '0.16m risers; lower approach is on +Z.'),
    ['楼梯', 'steps'],
  ),
  entry(
    'cafe-table',
    '咖啡圆桌',
    'Cafe table',
    'furniture',
    [1.16, 0.805, 1.16],
    '#b39773',
    text('小型圆桌，适合店外和休息区。', 'Small round table for cafes and rest areas.'),
    ['桌', 'table'],
  ),
  entry(
    'chair',
    '单椅',
    'Chair',
    'furniture',
    [0.5, 0.99, 0.505],
    '#b59a77',
    text('朝+Z的通用座椅，脚底原点。', 'Generic +Z-facing chair with ground pivot.'),
    ['椅子', 'seat'],
  ),
  entry(
    'floor-slab',
    '地板底座',
    'Floor slab',
    'building',
    [12, 0.1, 12],
    '#c4beaa',
    text(
      '12米方形薄板；放在y=-0.1时上表面为地面。',
      '12m square slab; y=-0.1 places top at ground.',
    ),
    ['地面', 'ground'],
  ),
];

export function newSetpiece(id: ModelId, position: Vec3 = [0, 0, 0]): Entity {
  const asset = assetLibrary.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown setpiece: ${id}`);
  return {
    id: uid(),
    kind: 'setpiece',
    ...(id === 'truck' ? { parts: structuredClone(truckParts) } : {}),
    modelId: id,
    name: asset.name.zh,
    color: asset.color,
    transform: identity(position),
    locked: false,
    source: asset.source,
    license: asset.license,
  };
}
function placed(id: ModelId, position: Vec3, yaw = 0, scale: Vec3 = [1, 1, 1]) {
  const e = newSetpiece(id, position);
  e.transform.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  e.transform.scale = scale;
  return e;
}
export const assemblies = [
  {
    id: 'classroom-row',
    name: text('四人课桌排', 'Four-desk row'),
    description: text('四张课桌，带中央走道。', 'Four desks with a center aisle.'),
    category: 'classroom',
    dimensions: [6.0, 0.99, 1.32] as Vec3,
  },
  {
    id: 'hospital-bay',
    name: text('完整病床位', 'Hospital bedside bay'),
    description: text(
      '病床、输液架、监护仪与访客椅。',
      'Bed, IV stand, monitor and visitor chair.',
    ),
    category: 'hospital',
    dimensions: [3.2, 1.975, 2.4] as Vec3,
  },
  {
    id: 'street-lighting',
    name: text('街道两侧灯列', 'Street lighting row'),
    description: text(
      '两侧共六盏路灯，12米纵深。',
      'Six street lights across both sides of a 12m segment.',
    ),
    category: 'street',
    dimensions: [9, 4.2, 12] as Vec3,
  },
  {
    id: 'cafe-corner',
    name: text('街角咖啡座', 'Cafe corner'),
    description: text('圆桌、两把椅子与花池。', 'Round table, two chairs and planter.'),
    category: 'furniture',
    dimensions: [3.5, 1.37, 2.4] as Vec3,
  },
] as const;
export type AssemblyId = (typeof assemblies)[number]['id'];
/** Appends independent entities. Yaw rotates every position and orientation around the assembly pivot. */
export function instantiateAssembly(
  id: AssemblyId | string,
  position: Vec3 = [0, 0, 0],
  rotationYaw = 0,
): Entity[] {
  let entities: Entity[];
  switch (id) {
    case 'classroom-row':
      entities = [-2.4, -1.2, 1.2, 2.4].map((x) => placed('school-desk', [x, 0, 0]));
      break;
    case 'hospital-bay':
      entities = [
        placed('hospital-bed', [0, 0, 0]),
        placed('iv-stand', [-0.9, 0, -0.55]),
        placed('monitor', [0.95, 0, -0.65]),
        placed('chair', [1.05, 0, 0.75], -Math.PI / 2),
      ];
      break;
    case 'street-lighting':
      entities = [];
      for (const x of [-4.3, 4.3])
        for (const z of [-5, 0, 5])
          entities.push(placed('streetlight', [x, 0, z], x > 0 ? Math.PI : 0));
      break;
    case 'cafe-corner':
      entities = [
        placed('cafe-table', [0, 0, 0]),
        placed('chair', [0, 0, -0.8]),
        placed('chair', [0, 0, 0.8], Math.PI),
        placed('planter', [1.35, 0, 0]),
      ];
      break;
    default:
      throw new Error(`Unknown assembly: ${id}`);
  }
  const c = Math.cos(rotationYaw),
    s = Math.sin(rotationYaw);
  for (const e of entities) {
    const [x, y, z] = e.transform.position;
    e.transform.position = [
      position[0] + x * c + z * s,
      position[1] + y,
      position[2] - x * s + z * c,
    ];
    const yaw = 2 * Math.atan2(e.transform.rotation[1], e.transform.rotation[3]) + rotationYaw;
    e.transform.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  }
  return entities;
}
export const sceneTemplates = [
  {
    id: 'rural-road',
    name: text('乡野归途', 'Country road'),
    description: text(
      '小屋、围栏、田边树列与双人道路镜头。',
      'Cottages, fences, trees and a two-person road scene.',
    ),
    category: 'rural',
    color: '#a7ad86',
  },
  {
    id: 'urban-street',
    name: text('城市转角', 'City corner'),
    description: text(
      '店面、楼立面、过街设施与街角对话。',
      'Storefronts, facades, crossing and street dialogue.',
    ),
    category: 'urban',
    color: '#9fa9a9',
  },
  {
    id: 'classroom',
    name: text('窗边教室', 'Classroom'),
    description: text(
      '课桌阵列、黑板、门窗和保留走道的教室。',
      'Desk rows, chalkboard, windows and clear aisles.',
    ),
    category: 'classroom',
    color: '#c1b297',
  },
  {
    id: 'hospital',
    name: text('安静病房', 'Hospital ward'),
    description: text(
      '双床位、等候区与接待台，开口室内机位。',
      'Two bedside bays, waiting area and reception.',
    ),
    category: 'hospital',
    color: '#a8c0c1',
  },
  {
    id: 'paris-plaza',
    name: text('巴黎印象广场', 'Paris-inspired plaza'),
    description: text(
      '原创缩尺铁塔、咖啡座与广场行人。',
      'Original miniature tower, cafe and plaza actors.',
    ),
    category: 'landmark',
    color: '#c3b9a1',
  },
] as const;
export type SceneTemplateId = (typeof sceneTemplates)[number]['id'];
function actor(name: string, p: Vec3, color: string, yaw = 0) {
  const e = newEntity('actor', p);
  e.name = name;
  e.color = color;
  e.transform.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  return e;
}
function shot(name: string, from: Vec3, to: Vec3, target: Vec3, fov = 42) {
  const s = newShot();
  s.name = name;
  s.duration = 6;
  s.intent = name;
  s.camera = { from, to, target, targetEnd: target, fov, follow: null };
  return s;
}
function floor(color: string, scale: Vec3 = [1, 1, 1]) {
  const e = placed('floor-slab', [0, -0.1, 0], 0, scale);
  e.color = color;
  return e;
}
function roomWalls(): Entity[] {
  const es: Entity[] = [];
  for (const x of [-4.5, -1.5, 1.5, 4.5])
    es.push(placed(x === 4.5 ? 'doorway' : 'wall-panel', [x, 0, -5.5]));
  for (const z of [-4, -1, 2]) es.push(placed('window-wall', [-6, 0, z], Math.PI / 2));
  return es;
}
/** Complete independent scene; no network, third-party assets or executable pack code. */
export function createSceneTemplate(id: SceneTemplateId | string): Project {
  const meta = sceneTemplates.find((s) => s.id === id);
  if (!meta) throw new Error(`Unknown scene template: ${id}`);
  let entities: Entity[] = [];
  let shots: Project['shots'] = [];
  if (id === 'rural-road') {
    entities = [
      floor('#aab18b', [3, 1, 4]),
      placed('cottage', [-8, 0, -5], 0.3),
      placed('cottage', [8, 0, -14], -0.6),
    ];
    for (const z of [-18, -6, 6, 18]) entities.push(placed('road-straight', [0, 0, z]));
    for (const x of [-5, 5])
      for (const z of [-17, -11, -5, 1, 7, 13]) {
        entities.push(placed('tree', [x + (z % 3) * 0.3, 0, z]));
        entities.push(placed('fence', [x * 0.75, 0, z], Math.PI / 2));
      }
    const a = actor('旅行者 A', [-0.65, 0.045, 0], '#b96c4c');
    const b = actor('旅行者 B', [0.65, 0.045, -0.8], '#66898d');
    entities.push(a, b);
    shots = [
      shot('01 · 乡村道路全景', [2.6, 3.6, 10], [2.1, 3.2, 9], [0, 1, -2], 46),
      shot('02 · 旅人正面跟拍', [3.2, 2.2, 7], [3.2, 2.2, 12], [0, 1, -0.4], 38),
      shot('03 · 路边小屋', [-11, 2.4, 4], [-10.3, 2.2, 3], [-8, 1.6, -5], 48),
    ];
    shots[1].camera.targetEnd = [0, 1, 4.6];
    for (const e of [a, b])
      shots[1].tracks[e.id] = [
        { ...e.transform, time: 0 },
        {
          ...e.transform,
          position: [e.transform.position[0], e.transform.position[1], e.transform.position[2] + 5],
          time: 6,
        },
      ];
    shots[1].poseTracks = Object.fromEntries(
      [a, b].map((e, index) => [
        e.id,
        Array.from({ length: 49 }, (_, i) => ({
          time: i / 8,
          pose: sampleActor({ ...e.actor!, action: 'walk', phase: index * 0.3 }, i / 8),
        })),
      ]),
    );
  } else if (id === 'urban-street') {
    entities = [floor('#b9b8ac', [3, 1, 4])];
    for (const z of [-12, 0, 12]) {
      entities.push(
        placed('road-straight', [0, 0, z]),
        placed('sidewalk', [-4, 0, z]),
        placed('sidewalk', [4, 0, z]),
      );
    }
    for (const x of [-8, 8])
      for (const z of [-12, -5, 2, 9])
        entities.push(
          placed(
            z === 2 ? 'shopfront' : 'apartment',
            [x, 0, z],
            x < 0 ? Math.PI / 2 : -Math.PI / 2,
          ),
        );
    entities.push(
      placed('crosswalk', [0, 0.006, 3]),
      placed('bus-stop', [4.6, 0.18, -7], -Math.PI / 2),
      placed('traffic-light', [3.4, 0.18, 4.7]),
      ...instantiateAssembly('street-lighting', [0, 0.18, 0]),
      ...instantiateAssembly('cafe-corner', [-4, 0.18, 3], Math.PI / 2),
    );
    entities.push(
      actor('行人 A', [-3.4, 0.18, 0], '#b96c4c', 0),
      actor('行人 B', [-3.4, 0.18, 1.5], '#648890', Math.PI),
    );
    shots = [
      shot('01 · 城市转角全景', [1.0, 4.8, 16], [0.7, 4.2, 14], [0, 1.4, -2], 49),
      shot('02 · 街边对话', [-0.5, 1.9, 5], [-1.2, 1.85, 4.5], [-3.4, 1.18, 0.75], 46),
      shot('03 · 沿街推进', [0.7, 1.6, 12], [0.7, 1.6, 6], [0, 1.2, -7], 46),
    ];
  } else if (id === 'classroom') {
    entities = [
      floor('#c3b596'),
      ...roomWalls(),
      placed('blackboard', [0, 0, -5]),
      placed('bookshelf', [5, 0, -4.8]),
      placed('reception', [-3.5, 0, -3.8]),
    ];
    entities[entities.length - 1].name = '教师讲台';
    entities[entities.length - 1].color = '#ac9473';
    for (const z of [-1.8, 0, 1.8])
      entities.push(...instantiateAssembly('classroom-row', [0, 0, z], Math.PI));
    entities.push(
      actor('教师', [0, 0, -3.2], '#6c8991'),
      actor('学生', [0.1, 0, 2.5], '#bb7758', Math.PI),
    );
    shots = [
      shot('01 · 从后排看教室', [4.5, 3.8, 8.8], [4, 3.3, 8], [0, 1, -1.3], 51),
      shot('02 · 讲台与黑板', [0.5, 1.7, 1.3], [0.2, 1.65, 0.7], [0, 1.3, -3.4], 51),
      shot('03 · 窗边走道', [-4.4, 1.8, 4.5], [-4.4, 1.8, 2.5], [-3.7, 1, -2], 50),
    ];
  } else if (id === 'hospital') {
    entities = [
      floor('#bfc9c5'),
      ...roomWalls(),
      ...instantiateAssembly('hospital-bay', [-2, 0, -2]),
      ...instantiateAssembly('hospital-bay', [2, 0, -2]),
      placed('reception', [3.3, 0, 3.2], Math.PI),
      placed('bench', [-3.9, 0, 3], Math.PI / 2),
      placed('planter', [-4.7, 0, -4.7]),
    ];
    entities.push(
      actor('来访者', [-0.3, 0, -1.5], '#bd805c', -Math.PI / 2),
      actor('医护人员', [-0.7, 0, 0.5], '#87b8be', Math.PI),
    );
    shots = [
      shot('01 · 病房全景', [7, 4.4, 8.5], [6.5, 3.8, 7.7], [0, 1, -1], 51),
      shot('02 · 床边交谈', [1.4, 1.8, 3], [1, 1.7, 2.5], [-1.6, 1, -1.5], 46),
      shot('03 · 等候与接待', [-2.5, 1.7, 6.5], [-2, 1.7, 5.8], [2.3, 1, 2.2], 47),
    ];
  } else {
    entities = [
      floor('#c9c1ab', [2.5, 1, 2.5]),
      placed('eiffel-tower', [0, 0, -4]),
      placed('clock-tower', [-9, 0, -8]),
      placed('shopfront', [8, 0, -6], -0.4),
      ...instantiateAssembly('cafe-corner', [-4.5, 0, 1]),
      ...instantiateAssembly('cafe-corner', [4.5, 0, 1]),
    ];
    for (const x of [-8, 8])
      for (const z of [-1, 6])
        entities.push(
          placed('tree', [x, 0, z]),
          placed('bench', [x * 0.72, 0, z], x < 0 ? Math.PI / 2 : -Math.PI / 2),
        );
    entities.push(
      actor('广场旅人 A', [-0.8, 0, 1.1], '#b96b4b'),
      actor('广场旅人 B', [0.6, 0, 0.3], '#638b90'),
    );
    shots = [
      shot('01 · 铁塔与广场', [9, 5.2, 14], [8, 4.6, 13], [0, 2.2, -2], 50),
      shot('02 · 地标低机位', [2.5, 1.3, 7], [1.6, 1.35, 6], [0, 2.8, -3], 55),
      shot('03 · 咖啡座看广场', [-5, 2, 6.5], [-4.5, 1.9, 6], [0, 2.5, -2], 55),
    ];
  }
  return {
    schemaVersion: 'hengdian/1',
    id: uid(),
    name: meta.name.zh,
    revision: 0,
    fps: '24',
    aspect: '16:9',
    environment: 'empty',
    packVersion: '1.0.0',
    entities,
    shots,
    notes: [],
  };
}
