import * as THREE from 'three';

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
function shape(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, c: string, x = 0, y = h / 2, z = 0) =>
  shape(new THREE.BoxGeometry(w, h, d), c, x, y, z);
const cyl = (r: number, h: number, c: string, x = 0, y = h / 2, z = 0) =>
  shape(new THREE.CylinderGeometry(r, r, h, 20), c, x, y, z);
function beam(a: number[], b: number[], width: number, color: string) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b);
  const m = box(width, start.distanceTo(end), width, color, 0, 0);
  m.position.copy(start.add(end).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.sub(new THREE.Vector3(...a)).normalize(),
  );
  return m;
}
function roof(w: number, h: number, d: number, color: string, y: number) {
  const v = [
    -w / 2,
    0,
    -d / 2,
    w / 2,
    0,
    -d / 2,
    0,
    h,
    -d / 2,
    -w / 2,
    0,
    d / 2,
    w / 2,
    0,
    d / 2,
    0,
    h,
    d / 2,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
  geo.computeVertexNormals();
  return shape(geo, color, 0, y, 0);
}
function legs(g: THREE.Group, width: number, depth: number, height: number, color: string) {
  for (const x of [-width / 2, width / 2])
    for (const z of [-depth / 2, depth / 2])
      g.add(box(0.07, height, 0.07, color, x, height / 2, z));
}
function chair(color: string) {
  const g = new THREE.Group();
  legs(g, 0.4, 0.4, 0.45, '#6b6e66');
  g.add(box(0.5, 0.07, 0.5, color, 0, 0.47), box(0.5, 0.5, 0.065, color, 0, 0.74, -0.22));
  return g;
}
function tree(color: string) {
  const g = new THREE.Group();
  g.add(cyl(0.14, 2.1, '#7c6650'));
  for (const [x, y, z, r] of [
    [-0.45, 2.2, 0, 0.9],
    [0.45, 2.55, 0, 0.85],
    [0, 2.7, 0.3, 0.8],
  ])
    g.add(shape(new THREE.IcosahedronGeometry(r, 2), color, x, y, z));
  return g;
}
function pane(g: THREE.Group, x: number, y: number, z: number, w = 0.72, h = 1.05) {
  g.add(
    box(w + 0.14, h + 0.14, 0.12, '#ede1cb', x, y, z),
    box(w, h, 0.14, '#68898f', x, y, z + 0.02),
    box(0.045, h, 0.17, '#e4dcc6', x, y, z + 0.04),
  );
}
function clock(g: THREE.Group, z: number, color: string) {
  const face = cyl(0.47, 0.06, '#f2ead7', 0, 4.55, z);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  g.add(
    box(0.045, 0.34, 0.08, color, 0, 4.66, z + 0.06),
    box(0.28, 0.045, 0.08, color, 0.12, 4.55, z + 0.06),
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    g.add(box(0.035, 0.045, 0.08, color, Math.sin(a) * 0.39, 4.55 + Math.cos(a) * 0.39, z + 0.06));
  }
}

/** Original deterministic geometries. Meters, ground pivot, nominal front +Z. */
export function createSetpiece(modelId: string, color: string): THREE.Group {
  const g = new THREE.Group();
  g.name = modelId;
  const metal = '#555f5e',
    pale = '#e1d8c5',
    wood = '#ae8d60';
  switch (modelId) {
    case 'eiffel-tower': {
      const levels = [
        [0, 1.25],
        [2, 0.7],
        [3.7, 0.38],
        [5.8, 0.06],
      ];
      for (let i = 0; i < levels.length - 1; i++) {
        const [y0, r0] = levels[i],
          [y1, r1] = levels[i + 1];
        for (const sx of [-1, 1])
          for (const sz of [-1, 1])
            g.add(beam([sx * r0, y0, sz * r0], [sx * r1, y1, sz * r1], 0.12, color));
        for (const side of [-1, 1]) {
          g.add(
            beam([-r0, y0, side * r0], [r1, y1, side * r1], 0.055, color),
            beam([r0, y0, side * r0], [-r1, y1, side * r1], 0.055, color),
          );
          g.add(
            beam([side * r0, y0, -r0], [side * r1, y1, r1], 0.055, color),
            beam([side * r0, y0, r0], [side * r1, y1, -r1], 0.055, color),
          );
        }
        if (i < 2) g.add(box(r1 * 2 + 0.3, 0.13, r1 * 2 + 0.3, color, 0, y1));
      }
      g.add(cyl(0.04, 0.65, color, 0, 6.12));
      break;
    }
    case 'clock-tower':
      g.add(
        box(1.6, 0.22, 1.6, pale),
        box(1.12, 5, 1.12, color, 0, 2.7),
        box(1.45, 0.15, 1.45, pale, 0, 5.3),
        roof(1.6, 0.8, 1.6, '#56666c', 5.38),
      );
      clock(g, 0.59, metal);
      pane(g, 0, 1.15, 0.58, 0.48, 1.4);
      break;
    case 'cottage': {
      g.add(
        box(3.8, 2.5, 0.16, color, 0, 1.25, -1.45),
        box(0.16, 2.5, 3, color, -1.82, 1.25),
        box(0.16, 2.5, 3, color, 1.82, 1.25),
      );
      g.add(
        box(1.45, 2.5, 0.16, color, -1.175, 1.25, 1.45),
        box(1.45, 2.5, 0.16, color, 1.175, 1.25, 1.45),
        box(0.9, 0.55, 0.16, color, 0, 2.225, 1.45),
      );
      g.add(roof(4.2, 1.1, 3.5, '#a36f53', 2.5), box(0.32, 1.1, 0.36, '#b7a58d', 1, 3.1, -0.5));
      pane(g, -1.13, 1.45, 1.54, 0.7, 0.8);
      pane(g, 1.13, 1.45, 1.54, 0.7, 0.8);
      break;
    }
    case 'apartment':
      g.add(box(4, 7.6, 2, color), box(4.25, 0.18, 2.2, pale, 0, 7.68));
      for (let row = 0; row < 4; row++)
        for (const x of [-1.25, 0, 1.25]) pane(g, x, 0.95 + row * 1.7, 1.02, 0.68, 1.0);
      for (let row = 1; row < 4; row++) g.add(box(4.08, 0.12, 2.08, pale, 0, row * 1.7));
      break;
    case 'shopfront':
      g.add(
        box(4, 2.9, 1.5, color),
        box(4.25, 0.45, 0.18, pale, 0, 2.55, 0.84),
        box(4.5, 0.1, 1.0, '#917651', 0, 2.3, 1.1),
      );
      pane(g, -1.1, 1.1, 0.78, 1.35, 1.85);
      pane(g, 1.1, 1.1, 0.78, 1.35, 1.85);
      g.add(
        box(0.65, 2.1, 0.17, metal, 0, 1.05, 0.85),
        box(0.52, 1.8, 0.18, '#779395', 0, 1.13, 0.88),
      );
      break;
    case 'road-straight':
      g.add(box(6, 0.045, 12, color));
      for (let i = -2; i <= 2; i++) g.add(box(0.1, 0.006, 1.0, '#e4d9b2', 0, 0.049, i * 2.3));
      for (const x of [-2.8, 2.8]) g.add(box(0.08, 0.006, 12, '#e8dfcb', x, 0.049));
      break;
    case 'sidewalk':
      g.add(box(2, 0.18, 12, color));
      for (let z = -5; z <= 5; z++) g.add(box(1.96, 0.006, 0.012, '#b0a794', 0, 0.183, z));
      break;
    case 'crosswalk':
      g.add(box(6, 0.05, 2.7, color));
      for (let x = -2.7; x <= 2.7; x += 0.6) g.add(box(0.32, 0.006, 2.45, '#eee8d9', x, 0.054));
      break;
    case 'streetlight':
      g.add(
        cyl(0.2, 0.18, metal),
        cyl(0.07, 4.1, color, 0, 2.1),
        beam([0, 4.05, 0], [0.85, 4.15, 0], 0.08, color),
        box(0.55, 0.12, 0.3, '#e5d5a8', 0.85, 4.1),
      );
      break;
    case 'tree':
      g.add(tree(color));
      break;
    case 'fence':
      for (const x of [-1.5, 0, 1.5]) g.add(box(0.12, 1.1, 0.12, color, x, 0.55));
      for (const y of [0.4, 0.85]) g.add(box(3, 0.1, 0.09, color, 0, y));
      break;
    case 'school-desk': {
      g.add(box(0.95, 0.08, 0.6, color, 0, 0.76, 0.27));
      for (const x of [-0.36, 0.36])
        for (const z of [0.04, 0.49]) g.add(box(0.06, 0.73, 0.06, metal, x, 0.365, z));
      const c = chair(color);
      c.position.z = -0.53;
      g.add(c);
      break;
    }
    case 'blackboard':
      g.add(
        box(3.2, 1.45, 0.15, wood, 0, 1.75),
        box(3.0, 1.26, 0.16, color, 0, 1.75, 0.015),
        box(3.25, 0.06, 0.25, wood, 0, 1.02, 0.08),
      );
      for (const x of [-1.25, 1.25]) g.add(box(0.07, 1.3, 0.08, metal, x, 0.65));
      g.add(
        box(0.8, 0.025, 0.018, '#dad9bd', -0.7, 1.95, 0.11),
        box(0.4, 0.025, 0.018, '#dad9bd', -0.9, 1.72, 0.11),
      );
      break;
    case 'bookshelf':
      g.add(
        box(0.08, 2.1, 0.42, color, -0.71),
        box(0.08, 2.1, 0.42, color, 0.71),
        box(1.5, 2.1, 0.07, color, 0, 1.05, -0.18),
      );
      for (const y of [0.05, 0.55, 1.05, 1.55, 2.05]) g.add(box(1.5, 0.07, 0.45, color, 0, y));
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < 7; i++)
          g.add(
            box(
              0.12,
              0.25 + (i % 3) * 0.05,
              0.23,
              ['#768d91', '#ac775d', '#b8a877'][i % 3],
              -0.55 + i * 0.18,
              0.22 + row * 0.5,
              0.01,
            ),
          );
      break;
    case 'hospital-bed':
      g.add(
        box(1.02, 0.17, 2.08, metal, 0, 0.47),
        box(0.95, 0.22, 2, '#e8e5d7', 0, 0.65),
        box(0.86, 0.07, 1.2, color, 0, 0.795, 0.31),
        box(0.67, 0.13, 0.38, '#f1eee1', 0, 0.84, -0.66),
      );
      for (const z of [-1.03, 1.03]) g.add(box(1.06, 0.55, 0.065, '#bec9c9', 0, 0.72, z));
      for (const x of [-0.43, 0.43])
        for (const z of [-0.8, 0.8]) {
          g.add(cyl(0.055, 0.35, metal, x, 0.27, z));
          const w = cyl(0.1, 0.08, metal, x, 0.1, z);
          w.rotation.z = Math.PI / 2;
          g.add(w);
        }
      break;
    case 'iv-stand':
      g.add(
        cyl(0.025, 1.95, metal),
        box(0.65, 0.06, 0.1, metal, 0, 0.08),
        box(0.1, 0.06, 0.65, metal, 0, 0.08),
        box(0.45, 0.035, 0.035, metal, 0, 1.95),
        box(0.18, 0.32, 0.08, color, 0.15, 1.72),
        cyl(0.006, 1, '#bccac8', 0.15, 1.08),
      );
      break;
    case 'monitor':
      g.add(
        box(0.52, 0.12, 0.42, color, 0, 0.06),
        cyl(0.045, 0.75, metal, 0, 0.48),
        box(0.65, 0.48, 0.16, color, 0, 1.02),
        box(0.54, 0.35, 0.17, '#263b3d', 0, 1.03, 0.02),
      );
      for (const [a, b] of [
        [
          [-0.24, 1.03, 0.11],
          [-0.11, 1.03, 0.11],
        ],
        [
          [-0.11, 1.03, 0.11],
          [-0.05, 1.15, 0.11],
        ],
        [
          [-0.05, 1.15, 0.11],
          [0.03, 0.95, 0.11],
        ],
        [
          [0.03, 0.95, 0.11],
          [0.1, 1.03, 0.11],
        ],
        [
          [0.1, 1.03, 0.11],
          [0.24, 1.03, 0.11],
        ],
      ])
        g.add(beam(a, b, 0.015, '#83c59a'));
      break;
    case 'reception':
      g.add(
        box(3, 1.05, 0.75, color),
        box(3.15, 0.08, 0.9, pale, 0, 1.09),
        box(1.5, 0.12, 0.025, pale, 0, 0.63, 0.39),
      );
      g.add(box(0.4, 0.28, 0.05, metal, -0.8, 1.27, -0.1));
      break;
    case 'wall-panel':
      g.add(box(3, 3.1, 0.16, color));
      break;
    case 'doorway':
      g.add(
        box(0.95, 3.1, 0.18, color, -1.025),
        box(0.95, 3.1, 0.18, color, 1.025),
        box(1.1, 0.8, 0.18, color, 0, 2.7),
      );
      for (const x of [-0.58, 0.58]) g.add(box(0.08, 2.3, 0.25, wood, x, 1.15));
      g.add(box(1.24, 0.08, 0.25, wood, 0, 2.3));
      break;
    case 'window-wall':
      g.add(
        box(3, 0.85, 0.16, color),
        box(3, 0.55, 0.16, color, 0, 2.825),
        box(0.55, 1.7, 0.16, color, -1.225, 1.7),
        box(0.55, 1.7, 0.16, color, 1.225, 1.7),
      );
      g.add(box(0.055, 1.7, 0.2, pale, 0, 1.7), box(2.0, 0.055, 0.2, pale, 0, 1.7));
      break;
    case 'bench':
      g.add(box(2, 0.1, 0.58, color, 0, 0.5), box(2, 0.42, 0.075, color, 0, 0.8, -0.25));
      legs(g, 1.6, 0.4, 0.48, metal);
      break;
    case 'bollard':
      g.add(cyl(0.1, 0.85, color), cyl(0.115, 0.07, '#d9d3bf', 0, 0.73));
      break;
    case 'planter':
      g.add(box(1, 0.45, 1, pale), shape(new THREE.IcosahedronGeometry(0.55, 2), color, 0, 0.82));
      break;
    case 'bus-stop':
      g.add(box(3.5, 0.12, 1.8, color, 0, 2.55), box(3.3, 2.45, 0.06, '#a3b4b1', 0, 1.25, -0.7));
      for (const x of [-1.65, 1.65]) g.add(box(0.08, 2.5, 0.08, metal, x, 1.25, -0.7));
      g.add(box(2.5, 0.1, 0.5, pale, 0, 0.5, -0.25));
      legs(g, 2, 0.4, 0.48, metal);
      break;
    case 'traffic-light':
      g.add(cyl(0.075, 2.4, metal), box(0.36, 0.98, 0.26, color, 0, 2.6));
      for (const [y, c] of [
        [2.9, '#a75144'],
        [2.61, '#ba9f4f'],
        [2.32, '#648e6f'],
      ] as const) {
        const light = cyl(0.105, 0.035, c, 0, y, 0.15);
        light.rotation.x = Math.PI / 2;
        g.add(light);
      }
      break;
    case 'stairs':
      for (let i = 0; i < 4; i++)
        g.add(box(2, 0.16 * (i + 1), 0.32, color, 0, 0.08 * (i + 1), 0.48 - i * 0.32));
      break;
    case 'cafe-table':
      g.add(cyl(0.58, 0.07, color, 0, 0.77), cyl(0.075, 0.73, metal), cyl(0.3, 0.045, metal));
      break;
    case 'chair':
      g.add(chair(color));
      break;
    case 'floor-slab':
      g.add(box(12, 0.1, 12, color));
      break;
    default:
      throw new Error(`Unknown setpiece: ${modelId}`);
  }
  // Slanted beams can extend below their endpoint; normalize the completed prop.
  const bounds = new THREE.Box3().setFromObject(g);
  if (Number.isFinite(bounds.min.y) && Math.abs(bounds.min.y) > 1e-8) {
    for (const child of g.children) child.position.y -= bounds.min.y;
  }
  return g;
}
