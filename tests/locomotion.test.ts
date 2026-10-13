import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { identity } from '../src/core/schema';
import { newEntity } from '../src/core/catalog';
import { primitive } from '../src/runtime/stage';
import { walkSwing } from '../src/runtime/locomotion';

describe('blocking actor locomotion', () => {
  const keys = [
    { ...identity([0, 0, 0]), time: 1 },
    { ...identity([2, 0, 0]), time: 3 },
    { ...identity([2, 0, 0]), time: 5 },
    { ...identity([4, 0, 0]), time: 7 },
  ];
  it('rests before entry, during a held pose and after arrival, but walks on both travel intervals', () => {
    for (const time of [0, 1, 3, 4, 5, 7, 8]) expect(walkSwing(keys, time)).toBeCloseTo(0, 12);
    expect(Math.abs(walkSwing(keys, 2))).toBeGreaterThan(0.1);
    expect(Math.abs(walkSwing(keys, 6))).toBeGreaterThan(0.1);
    const firstSample = walkSwing(keys, 2);
    walkSwing(keys, 6);
    expect(walkSwing(keys, 2)).toBe(firstSample);
  });
  it('does not walk for a turn in place or vertical motion', () => {
    expect(
      walkSwing(
        [
          { ...identity(), time: 0 },
          { ...identity([0, 2, 0]), time: 2 },
        ],
        1,
      ),
    ).toBe(0);
    expect(walkSwing([], 1)).toBe(0);
  });
  it('places a neutral actor on the ground instead of floating ten centimetres above it', () => {
    const actor = primitive(newEntity('actor'));
    const bounds = new Box3().setFromObject(actor);
    expect(bounds.min.y).toBeCloseTo(0, 6);
  });
});
