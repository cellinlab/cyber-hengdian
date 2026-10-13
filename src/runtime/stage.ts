import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { evaluate } from '../core/project';
import { walkSwing } from './locomotion';
import { createActor, updateActor } from './actor';
import { createSetpiece } from './setpieces';
import type { Project, Shot, Entity } from '../core/schema';
export type Pass = 'rgb' | 'depth' | 'id';
const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, c: string, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z);
const cylinder = (r: number, h: number, c: string, x = 0, y = 0, z = 0) =>
  mesh(new THREE.CylinderGeometry(r, r, h, 40), c, x, y, z);
function tree(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.add(cylinder(0.12, 2.6, '#79654e', 0, 1.3));
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    g.add(
      mesh(
        new THREE.IcosahedronGeometry(0.8, 2),
        i % 2 ? '#7f8b66' : '#687e60',
        Math.sin(a) * 0.6,
        2.4 + (i % 2) * 0.5,
        Math.cos(a) * 0.6,
      ),
    );
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}
function architecture(environment: Project['environment']) {
  const g = new THREE.Group();
  if (environment === 'courtyard') {
    g.add(box(32, 0.15, 28, '#c8b99e', 0, -0.12, 0));
    for (let i = -6; i <= 6; i++) {
      g.add(box(0.012, 0.004, 12, '#b5a58d', i * 1.4, 0, 0));
      g.add(box(18, 0.004, 0.012, '#b5a58d', 0, 0, i * 1.4));
    }
    const shape = new THREE.Shape();
    shape.moveTo(-9, -0.3);
    shape.lineTo(9, -0.3);
    shape.lineTo(9, 5.4);
    shape.lineTo(-9, 5.4);
    shape.closePath();
    for (const x of [-5.5, 0, 5.5]) {
      const hole = new THREE.Path();
      hole.moveTo(x - 1.15, -0.1);
      hole.lineTo(x - 1.15, 2.6);
      hole.absarc(x, 2.6, 1.15, Math.PI, 0, true);
      hole.lineTo(x + 1.15, -0.1);
      hole.closePath();
      shape.holes.push(hole);
    }
    const wall = mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false }),
      '#d8c4a3',
      0,
      0,
      -4.7,
    );
    g.add(wall);
    g.add(
      box(18, 0.18, 1, '#e4d3b6', 0, 5.35, -4.35),
      box(18, 0.28, 0.92, '#c0ac8e', 0, 0.13, -4.4),
    );
    g.add(box(5, 3.4, 0.6, '#bfaa8a', -8, 1.7, 0));
    g.add(box(1.7, 0.12, 3.6, '#dbc8a7', 5, 0.06, 1));
    g.add(tree(4, -1, 1.45), tree(-5, 2, 1.2));
    for (let i = 0; i < 3; i++)
      g.add(box(2.7, 0.2, 0.5, '#b6a083', 4.8, 0.1 + i * 0.2, -3.1 - i * 0.5));
    g.add(
      box(2.5, 0.12, 0.7, '#8d7961', -3, 0.65, 1.6),
      box(0.15, 0.65, 0.6, '#7b6d5a', -4, 0.3, 1.6),
      box(0.15, 0.65, 0.6, '#7b6d5a', -2, 0.3, 1.6),
    );
  } else if (environment === 'studio') {
    g.add(box(60, 0.2, 60, '#acbac1', 0, -0.12, 0));
    g.add(box(24, 12, 0.4, '#a7b6be', 0, 5.8, -6));
    const curve = mesh(
      new THREE.CylinderGeometry(2, 2, 20, 48, 1, true, 0, Math.PI / 2),
      '#acbac1',
    );
    curve.rotation.z = Math.PI / 2;
    curve.rotation.x = Math.PI;
    curve.position.set(0, 1.8, -4);
    g.add(curve);
    for (const x of [-4, 4]) {
      g.add(cylinder(0.03, 3, '#5d6567', x, 1.5, 0));
      const panel = box(1.5, 2, 0.06, '#e7ece9', x, 3, 0);
      panel.rotation.y = x < 0 ? 0.4 : -0.4;
      g.add(panel);
    }
  } else if (environment === 'exterior') {
    g.add(box(150, 0.2, 150, '#a4aa87', 0, -0.14, 0), box(5, 0.025, 120, '#a89e88', 0, -0.02, 0));
    for (let i = 0; i < 13; i++) {
      const x = (i % 2 ? 1 : -1) * (8 + ((i * 7) % 19)),
        z = -12 - i * 4;
      g.add(mesh(new THREE.IcosahedronGeometry(6 + (i % 4), 1), '#89967c', x, 0, z));
    }
    for (let i = 0; i < 10; i++)
      g.add(tree((i % 2 ? 1 : -1) * (4 + (i % 3)), i * 4 - 14, 0.8 + (i % 3) * 0.2));
    for (let i = 0; i < 13; i++) g.add(box(0.07, 0.01, 1, '#ddd2b6', 0, 0, i * 3 - 20));
  }
  if (environment === 'empty') g.add(box(180, 0.1, 180, '#b9b6a8', 0, -0.07, 0));
  return g;
}
export function primitive(e: Entity) {
  if (e.kind === 'actor' && e.actor) return createActor(e.color);
  if (e.kind === 'setpiece' && e.modelId) return createSetpiece(e.modelId, e.color);
  const g = new THREE.Group();
  const c = e.color;
  if (e.kind === 'actor') {
    g.add(mesh(new THREE.CapsuleGeometry(0.23, 0.55, 8, 16), c, 0, 1.02));
    g.add(mesh(new THREE.SphereGeometry(0.19, 24, 16), '#d7b598', 0, 1.65));
    g.add(mesh(new THREE.SphereGeometry(0.055, 12, 8), '#c39e7d', 0, 1.65, 0.175));
    const limbs: THREE.Group[] = [];
    for (const x of [-0.16, 0.16]) {
      const limb = new THREE.Group();
      limb.position.set(x, 0.8, 0);
      limb.add(cylinder(0.095, 0.8, '#525b55', 0, -0.4));
      g.add(limb);
      limbs.push(limb);
    }
    for (const x of [-0.32, 0.32]) {
      const limb = new THREE.Group();
      limb.position.set(x, 1.35, 0);
      limb.add(cylinder(0.07, 0.55, c, 0, -0.275));
      g.add(limb);
      limbs.push(limb);
    }
    g.userData.limbs = limbs;
  } else if (e.kind === 'box') g.add(box(1, 1, 1, c, 0, 0.5));
  else if (e.kind === 'sphere') g.add(mesh(new THREE.SphereGeometry(0.5, 40, 24), c, 0, 0.5));
  else if (e.kind === 'cylinder') g.add(cylinder(0.5, 1, c, 0, 0.5));
  else if (e.kind === 'plant') {
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.45, 32), '#b18062', 0, 0.225));
    g.add(tree(0, 0, 0.55));
  } else if (e.kind === 'chair') {
    g.add(box(0.65, 0.1, 0.65, c, 0, 0.5), box(0.65, 0.65, 0.08, c, 0, 0.86, -0.28));
    for (const x of [-0.25, 0.25])
      for (const z of [-0.25, 0.25]) g.add(box(0.06, 0.5, 0.06, c, x, 0.25, z));
  } else if (e.kind === 'table') {
    g.add(
      cylinder(0.65, 0.1, c, 0, 0.8),
      cylinder(0.1, 0.8, c, 0, 0.4),
      cylinder(0.38, 0.06, c, 0, 0.03),
    );
  } else if (e.kind === 'product') {
    g.add(
      cylinder(0.32, 0.7, c, 0, 0.35),
      cylinder(0.27, 0.07, '#d1d9d1', 0, 0.74),
      box(0.38, 0.28, 0.015, '#e8e2cf', 0, 0.37, 0.315),
    );
  }
  return g;
}
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    }
  });
}
export class Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 200);
  objects = new Map<string, THREE.Group>();
  renderer: THREE.WebGLRenderer;
  project!: Project;
  world = new THREE.Group();
  mixers: THREE.AnimationMixer[] = [];
  private generation = 0;
  constructor(canvas: HTMLCanvasElement, antialias = true) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const ambient = new THREE.HemisphereLight('#fff3df', '#777c69', 2.5);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fff0d4', 3.2);
    sun.position.set(-7, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(this.world);
  }
  async load(project: Project) {
    const generation = ++this.generation;
    this.project = project;
    dispose(this.world);
    this.world.clear();
    this.objects.clear();
    this.mixers = [];
    this.scene.background = new THREE.Color(
      project.environment === 'studio'
        ? '#aab8bf'
        : project.environment === 'exterior'
          ? '#cbd6c5'
          : '#ded7c6',
    );
    this.world.add(architecture(project.environment));
    for (const e of project.entities) {
      const group = e.kind === 'glb' ? new THREE.Group() : primitive(e);
      group.userData.entityId = e.id;
      this.objects.set(e.id, group);
      this.world.add(group);
      if (e.kind === 'glb' && e.asset) {
        const gltf = await new GLTFLoader().loadAsync(`/api/assets/${e.asset}`);
        if (generation !== this.generation) {
          dispose(gltf.scene);
          return;
        }
        group.add(gltf.scene);
        if (gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(gltf.scene);
          mixer.clipAction(gltf.animations[0]).play();
          this.mixers.push(mixer);
        }
      }
    }
  }
  update(shot: Shot, time: number) {
    const state = evaluate(this.project, shot, time);
    this.mixers.forEach((m) => m.setTime(state.time));
    for (const e of state.entities) {
      const g = this.objects.get(e.id);
      if (!g) continue;
      g.position.fromArray(e.transform.position);
      g.quaternion.fromArray(e.transform.rotation);
      g.scale.fromArray(e.transform.scale);
      if (e.actor) updateActor(g, e.actor.pose);
      const limbs = g.userData.limbs as THREE.Group[] | undefined;
      const keys = shot.tracks[e.id] ?? [];
      const swing = walkSwing(keys, state.time);
      limbs?.forEach((limb, i) => (limb.rotation.x = (i % 2 ? -1 : 1) * swing));
    }
    this.camera.position.fromArray(state.camera.position);
    this.camera.lookAt(new THREE.Vector3(...state.camera.target));
    this.camera.fov = state.camera.fov;
    this.camera.updateProjectionMatrix();
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  render(camera: THREE.Camera = this.camera, pass: Pass = 'rgb') {
    if (pass === 'rgb') {
      this.renderer.render(this.scene, camera);
      return;
    }
    const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const temp: THREE.Material[] = [];
    const background = this.scene.background;
    const mapping = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.background = new THREE.Color(pass === 'depth' ? '#ffffff' : '#000000');
    const idMap = new Map([...this.objects].map(([id, g], i) => [g, i + 1]));
    this.world.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      saved.set(o, o.material);
      let m: THREE.Material;
      if (pass === 'depth') {
        const depth = new THREE.MeshDepthMaterial({
          depthPacking: THREE.BasicDepthPacking,
          side: THREE.DoubleSide,
        });
        depth.onBeforeCompile = (shader) => {
          shader.uniforms.linearNear = { value: this.camera.near };
          shader.uniforms.linearFar = { value: this.camera.far };
          shader.vertexShader = 'varying float linearViewDepth;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\nlinearViewDepth=-mvPosition.z;',
          );
          shader.fragmentShader =
            'varying float linearViewDepth; uniform float linearNear; uniform float linearFar;\n' +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
            'gl_FragColor=vec4(vec3(clamp((linearViewDepth-linearNear)/(linearFar-linearNear),0.0,1.0)),1.0);',
          );
        };
        m = depth;
      } else {
        let root: THREE.Object3D | null = o;
        while (root && !idMap.has(root as THREE.Group)) root = root.parent;
        const index = root ? idMap.get(root as THREE.Group)! : 0;
        m = new THREE.MeshBasicMaterial({
          color: index,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
      }
      o.material = m;
      temp.push(m);
    });
    this.renderer.render(this.scene, camera);
    for (const [mesh, m] of saved) mesh.material = m;
    temp.forEach((m) => m.dispose());
    this.scene.background = background;
    this.renderer.toneMapping = mapping;
  }
  inspectFrame() {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
    );
    return [...this.objects].map(([id, object]) => {
      const bounds = new THREE.Box3().setFromObject(object);
      const points = [];
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            points.push(new THREE.Vector3(x, y, z).project(this.camera));
      return {
        id,
        intersectsFrame: frustum.intersectsBox(bounds),
        screenBounds: {
          left: Math.min(...points.map((p) => (p.x + 1) / 2)),
          right: Math.max(...points.map((p) => (p.x + 1) / 2)),
          top: Math.min(...points.map((p) => (1 - p.y) / 2)),
          bottom: Math.max(...points.map((p) => (1 - p.y) / 2)),
        },
        note: 'World bounding box projection; occlusion and transparent surfaces are not tested.',
      };
    });
  }
  dispose() {
    this.generation++;
    dispose(this.world);
    this.renderer.dispose();
  }
}
