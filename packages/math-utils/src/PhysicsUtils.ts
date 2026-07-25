export function applyGravity(_mass: number, currentPos: [number, number, number]): [number, number, number] {
  return [currentPos[0], currentPos[1] - (9.8 * 0.016), currentPos[2]];
}