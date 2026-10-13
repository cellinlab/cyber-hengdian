import { mkdirSync, writeFileSync } from 'node:fs';
import { projectSchema, type Project, type Entity, type Vec3 } from '../src/core/schema';

const entity = (
  id: string,
  name: string,
  kind: Entity['kind'],
  color: string,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
): Entity => ({
  id,
  name,
  kind,
  color,
  transform: { position, scale, rotation: [0, 0, 0, 1] },
  locked: false,
});
const product: Project = {
  schemaVersion: 'hengdian/1',
  id: 'showcase-product',
  name: '静物肖像 · 香水广告预演',
  revision: 0,
  fps: '24',
  aspect: '16:9',
  environment: 'studio',
  packVersion: '1.0.0',
  entities: [
    entity('hero-bottle', '香水瓶 · 主体', 'product', '#667c73', [0, 0.8, 0], [1, 1.3, 1]),
    entity('bottle-neck', '香水瓶 · 颈部', 'cylinder', '#c1af83', [0, 1.8, 0], [0.24, 0.16, 0.24]),
    entity('bottle-cap', '香水瓶 · 瓶盖', 'cylinder', '#343f3b', [0, 1.93, 0], [0.42, 0.2, 0.42]),
    entity('hero-plinth', '石色圆形展台', 'cylinder', '#c9c0ae', [0, 0, 0], [1.7, 0.8, 1.7]),
    entity('low-plinth', '辅助矮展台', 'cylinder', '#bfc1b2', [-1.8, 0, -0.7], [1.1, 0.35, 1.1]),
    entity('sculpture', '构图球体', 'sphere', '#d7c3a5', [-1.8, 0.35, -0.7], [0.55, 0.55, 0.55]),
  ],
  shots: [
    {
      id: 'product-hero',
      name: '01 · 缓移看见轮廓',
      duration: 6,
      intent:
        '香水广告预演：完整保留瓶体与展台，摄影机由右向左缓慢推进，克制留白，辅助几何不遮挡主产品。',
      camera: {
        from: [0.3, 1.85, 5.9],
        to: [-0.5, 1.8, 5.5],
        target: [0, 1.15, 0],
        targetEnd: [0, 1.2, 0],
        fov: 32,
        follow: null,
      },
      tracks: {},
    },
  ],
  notes: [],
};
const travelers = [
  entity('traveler-a', '旅行者 A · 赭红外套', 'actor', '#b46545', [-0.65, 0, -2]),
  entity('traveler-b', '旅行者 B · 青色外套', 'actor', '#577d80', [0.65, 0, -2.9]),
  entity('pack-a', '旅行者 A · 背包', 'box', '#535b48', [-0.65, 0.87, -2.28], [0.4, 0.48, 0.23]),
  entity('pack-b', '旅行者 B · 背包', 'box', '#b4a378', [0.65, 0.87, -3.18], [0.4, 0.48, 0.23]),
];
const road: Project = {
  schemaVersion: 'hengdian/1',
  id: 'showcase-road',
  name: '去远方 · 双人公路跟拍',
  revision: 0,
  fps: '24',
  aspect: '16:9',
  environment: 'exterior',
  packVersion: '1.0.0',
  entities: travelers,
  shots: [
    {
      id: 'road-follow',
      name: '01 · 与旅人同行',
      duration: 6,
      intent:
        '两位旅行者沿旷野公路并肩前行，A领先半步，摄影机与人物同速向前移动。全身保持可见，道路透视与远山交代旅程方向。',
      camera: {
        from: [3.4, 2.2, 5],
        to: [3.4, 2.2, 10],
        target: [0, 1.0, -2.4],
        targetEnd: [0, 1.0, 2.6],
        fov: 36,
        follow: null,
      },
      tracks: Object.fromEntries(
        travelers.map((e) => [
          e.id,
          [
            { ...e.transform, time: 0 },
            {
              ...e.transform,
              position: [
                e.transform.position[0],
                e.transform.position[1],
                e.transform.position[2] + 5,
              ],
              time: 6,
            },
          ],
        ]),
      ),
    },
  ],
  notes: [],
};
mkdirSync('examples/showcase', { recursive: true });
for (const [slug, p] of Object.entries({ product, road })) {
  projectSchema.parse(p);
  writeFileSync(`examples/showcase/${slug}.hengdian.json`, JSON.stringify(p, null, 2) + '\n');
  console.log(`${slug}: ${p.entities.length} entities, 6 seconds, 144 frames`);
}
