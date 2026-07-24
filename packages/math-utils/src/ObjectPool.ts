import * as THREE from "three";

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFunc?: (obj: T) => void;

  constructor(factory: () => T, initialSize: number = 100, resetFunc?: (obj: T) => void) {
    this.factory = factory;
    this.resetFunc = resetFunc;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    const obj = this.pool.pop();
    if (obj) {
      if (this.resetFunc) this.resetFunc(obj);
      return obj;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.pool.push(obj);
  }
}

export const Vector3Pool = new ObjectPool<THREE.Vector3>(
  () => new THREE.Vector3(),
  200,
  (v) => v.set(0, 0, 0)
);

export const QuaternionPool = new ObjectPool<THREE.Quaternion>(
  () => new THREE.Quaternion(),
  100,
  (q) => q.identity()
);