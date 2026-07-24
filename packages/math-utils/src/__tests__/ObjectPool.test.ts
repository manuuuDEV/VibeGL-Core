import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../index';

describe('ObjectPool', () => {
  it('should recycle objects', () => {
    class MockVec3 {
      x = 0; y = 0; z = 0;
      reset() {
        this.x = 0; this.y = 0; this.z = 0;
      }
    }
    const pool = new ObjectPool(() => new MockVec3(), 10, (obj) => obj.reset());
    const obj = pool.acquire();
    expect(obj).toBeDefined();

    obj.x = 10;
    pool.release(obj);

    const obj2 = pool.acquire();
    expect(obj2).toBe(obj);
    expect(obj2.x).toBe(0);
  });
});