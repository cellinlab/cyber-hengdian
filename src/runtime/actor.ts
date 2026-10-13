import * as THREE from 'three';
import { jointDefinitions, neutralPose, type JointId, type Pose } from '../core/actor';

export const actorDimensions = {
  pelvisHeight: 0.94,
  thigh: 0.43,
  shin: 0.43,
  upperArm: 0.3,
  forearm: 0.27,
} as const;
type Rig = { joints: Record<JointId, THREE.Group> };

/** Original articulated blocking figure. +Y is up, +Z is the face direction. */
export function createActor(color: THREE.ColorRepresentation): THREE.Group {
  const actor = new THREE.Group();
  actor.name = 'articulated-actor';
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e5be99', roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#283445', roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: '#15202b', roughness: 0.65 });
  const joints = {} as Rig['joints'];
  function joint(id: JointId, parent: THREE.Object3D, position: [number, number, number]) {
    const g = new THREE.Group();
    g.name = `joint:${id}`;
    g.position.set(...position);
    parent.add(g);
    joints[id] = g;
    return g;
  }
  function mesh(
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function ball(
    parent: THREE.Object3D,
    name: string,
    radius: number,
    material: THREE.Material = skin,
  ) {
    return mesh(parent, name, new THREE.SphereGeometry(radius, 12, 8), material, [0, 0, 0]);
  }
  function limb(
    parent: THREE.Object3D,
    name: string,
    length: number,
    radius: number,
    material: THREE.Material,
  ) {
    return mesh(
      parent,
      name,
      new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10),
      material,
      [0, -length / 2, 0],
    );
  }
  const root = joint('root', actor, [0, actorDimensions.pelvisHeight, 0]);
  const pelvis = joint('pelvis', root, [0, 0, 0]);
  mesh(pelvis, 'pelvis', new THREE.BoxGeometry(0.36, 0.2, 0.23), cloth, [0, 0.015, 0]);
  const spine = joint('spine', pelvis, [0, 0.1, 0]);
  mesh(
    spine,
    'torso',
    new THREE.CylinderGeometry(0.23, 0.18, 0.4, 12),
    cloth,
    [0, 0.2, 0],
  ).scale.z = 0.6;
  const neck = joint('neck', spine, [0, 0.43, 0]);
  mesh(neck, 'neck', new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), skin, [0, 0.025, 0]);
  const head = joint('head', neck, [0, 0.08, 0]);
  const skull = mesh(head, 'head', new THREE.SphereGeometry(0.145, 20, 14), skin, [0, 0.115, 0]);
  skull.scale.y = 1.16;
  for (const sign of [-1, 1]) {
    const eye = mesh(head, `eye:${sign}`, new THREE.SphereGeometry(0.025, 10, 8), white, [
      sign * 0.053,
      0.14,
      0.129,
    ]);
    eye.scale.set(1, 0.85, 0.45);
    mesh(head, `pupil:${sign}`, new THREE.SphereGeometry(0.011, 8, 6), black, [
      sign * 0.053,
      0.139,
      0.141,
    ]);
    mesh(head, `ear:${sign}`, new THREE.SphereGeometry(0.027, 8, 6), skin, [sign * 0.14, 0.115, 0]);
  }
  mesh(head, 'nose', new THREE.SphereGeometry(0.031, 10, 8), skin, [0, 0.09, 0.145]).scale.set(
    0.75,
    0.9,
    1.15,
  );
  mesh(head, 'mouth', new THREE.BoxGeometry(0.046, 0.008, 0.006), dark, [0, 0.054, 0.134]);
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? 1 : -1;
    const shoulder = joint(`${side}Shoulder`, spine, [sign * 0.26, 0.35, 0]);
    ball(shoulder, `${side}-shoulder`, 0.08, cloth);
    limb(shoulder, `${side}-upper-arm`, actorDimensions.upperArm, 0.066, cloth);
    const elbow = joint(`${side}Elbow`, shoulder, [0, -actorDimensions.upperArm, 0]);
    ball(elbow, `${side}-elbow`, 0.057);
    limb(elbow, `${side}-forearm`, actorDimensions.forearm, 0.052, skin);
    const wrist = joint(`${side}Wrist`, elbow, [0, -actorDimensions.forearm, 0]);
    ball(wrist, `${side}-wrist`, 0.043);
    const hand = mesh(
      wrist,
      `${side}-hand`,
      new THREE.CapsuleGeometry(0.048, 0.06, 4, 10),
      skin,
      [0, -0.065, 0],
    );
    hand.scale.z = 0.58;
    mesh(wrist, `${side}-thumb`, new THREE.CapsuleGeometry(0.017, 0.045, 3, 8), skin, [
      -sign * 0.04,
      -0.055,
      0.015,
    ]).rotation.z = -sign * 0.35;
    const hip = joint(`${side}Hip`, pelvis, [sign * 0.145, 0, 0]);
    ball(hip, `${side}-hip`, 0.08, cloth);
    limb(hip, `${side}-thigh`, actorDimensions.thigh, 0.079, cloth);
    const knee = joint(`${side}Knee`, hip, [0, -actorDimensions.thigh, 0]);
    ball(knee, `${side}-knee`, 0.065, dark);
    limb(knee, `${side}-shin`, actorDimensions.shin, 0.061, cloth);
    const ankle = joint(`${side}Ankle`, knee, [0, -actorDimensions.shin, 0]);
    ball(ankle, `${side}-ankle`, 0.045, dark);
    mesh(ankle, `${side}-foot`, new THREE.BoxGeometry(0.13, 0.08, 0.26), dark, [0, -0.04, 0.075]);
  }
  actor.userData.actorRig = { joints } satisfies Rig;
  updateActor(actor, neutralPose());
  return actor;
}

/** Replaces every joint transform so seeking never depends on the previously rendered frame. */
export function updateActor(actor: THREE.Group, pose: Pose): void {
  const rig = actor.userData.actorRig as Rig | undefined;
  if (!rig) throw new Error('updateActor requires a group returned by createActor');
  for (const definition of jointDefinitions) {
    const [x, y, z] = pose.joints[definition.id];
    rig.joints[definition.id].rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z),
      'XYZ',
    );
  }
  rig.joints.root.position.set(
    pose.rootOffset[0],
    actorDimensions.pelvisHeight + pose.rootOffset[1],
    pose.rootOffset[2],
  );
  actor.updateMatrixWorld(true);
}
