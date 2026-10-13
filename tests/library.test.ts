import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  assetLibrary,
  assemblies,
  sceneTemplates,
  instantiateAssembly,
  createSceneTemplate,
  newSetpiece,
  modelIds,
} from '../src/core/library';
import { projectSchema } from '../src/core/schema';
import { evaluate } from '../src/core/project';
import { createSetpiece } from '../src/runtime/setpieces';

describe('original scene library', () => {
  it('creates independently editable complete scenes within the project budget', () => {
    for (const template of sceneTemplates) {
      const first = createSceneTemplate(template.id),
        second = createSceneTemplate(template.id);
      expect(projectSchema.safeParse(first).success).toBe(true);
      expect(first.entities.length).toBeLessThan(150);
      expect(first.shots).toHaveLength(3);
      expect(first.id).not.toBe(second.id);
      const ids = new Set(first.entities.map((e) => e.id));
      expect(second.entities.every((e) => !ids.has(e.id))).toBe(true);
      for (const shot of first.shots)
        for (const id of Object.keys(shot.tracks)) expect(ids.has(id)).toBe(true);
    }
  });
  it('rotates assembly positions and orientations around the requested pivot without shared mutable state', () => {
    const first = instantiateAssembly('hospital-bay');
    const second = instantiateAssembly('hospital-bay', [10, 2, 20], Math.PI / 2);
    for (let i = 0; i < first.length; i++) {
      expect(second[i].id).not.toBe(first[i].id);
      expect(second[i].transform.position[0]).toBeCloseTo(10 + first[i].transform.position[2]);
      expect(second[i].transform.position[1]).toBeCloseTo(2 + first[i].transform.position[1]);
      expect(second[i].transform.position[2]).toBeCloseTo(20 - first[i].transform.position[0]);
      expect(Math.hypot(...second[i].transform.rotation)).toBeCloseTo(1);
    }
    second[0].transform.position[0] = 999;
    expect(instantiateAssembly('hospital-bay')[0].transform.position[0]).toBe(0);
  });
  it('keeps every assembly under a single transaction operation budget', () => {
    for (const a of assemblies) {
      const entities = instantiateAssembly(a.id);
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.length).toBeLessThanOrEqual(200);
      expect(new Set(entities.map((e) => e.id)).size).toBe(entities.length);
    }
  });
  it('builds finite ground-pivot geometry with bounded advertised dimensions for every model', () => {
    expect(assetLibrary.map((a) => a.id).sort()).toEqual([...modelIds].sort());
    for (const a of assetLibrary) {
      const object = createSetpiece(a.id, a.color);
      const bounds = new THREE.Box3().setFromObject(object),
        size = bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y, `${a.id} must sit on ground`).toBeCloseTo(0, 5);
      expect([size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 0)).toBe(true);
      for (let i = 0; i < 3; i++)
        expect(size.getComponent(i), `${a.id} dimension ${i}`).toBeLessThanOrEqual(
          a.dimensions[i] + 0.02,
        );
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          expect(o.castShadow).toBe(true);
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
    }
  });
  it('keeps the road above its ground and scopes walking poses to the travelling shot', () => {
    const project = createSceneTemplate('rural-road');
    const floor = project.entities.find((e) => e.modelId === 'floor-slab')!;
    const road = project.entities.find((e) => e.modelId === 'road-straight')!;
    const top = (e: typeof road) => {
      const object = createSetpiece(e.modelId!, e.color);
      object.position.fromArray(e.transform.position);
      object.scale.fromArray(e.transform.scale);
      return new THREE.Box3().setFromObject(object).max.y;
    };
    expect(top(road)).toBeGreaterThan(top(floor) + 0.01);
    const actor = project.entities.find((e) => e.kind === 'actor')!;
    // Lane-paint geometry sits a few millimeters above the walking surface.
    expect(Math.abs(actor.transform.position[1] - top(road))).toBeLessThan(0.01);
    const standing = evaluate(project, project.shots[0], 0.2).entities.find(
      (e) => e.id === actor.id,
    )!;
    const walking = evaluate(project, project.shots[1], 0.2).entities.find(
      (e) => e.id === actor.id,
    )!;
    expect(walking.actor!.pose.joints.leftHip).not.toEqual(standing.actor!.pose.joints.leftHip);
    expect(project.shots[0].poseTracks?.[actor.id]).toBeUndefined();
  });
  it('keeps a real opening in doorway geometry and refuses unknown model identifiers', () => {
    const door = createSetpiece('doorway', '#ffffff');
    door.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 2), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(door, true)).toHaveLength(0);
    expect(() => createSetpiece('unknown-model', '#ffffff')).toThrow(/Unknown/);
    expect(() => newSetpiece('unknown-model' as never)).toThrow(/Unknown/);
  });
});
