import { useRef, useEffect, useCallback } from 'react';

// ============================================
// HOOK: useMemoryPool
// ============================================

/**
 * Hook for allocating pre-sized Float32Arrays for custom geometry attributes.
 * Eliminates GC pressure by reusing typed arrays.
 * 
 * @example
 * ```tsx
 * const { allocate, release, getBuffer } = useMemoryPool({
 *   position: { count: 10000, itemSize: 3 },
 *   velocity: { count: 10000, itemSize: 3 },
 *   color: { count: 10000, itemSize: 4 },
 * });
 * 
 * // Allocate buffers
 * const posBuffer = allocate('position');
 * const velBuffer = allocate('velocity');
 * 
 * // Use in WebGL
 * gl.bufferData(gl.ARRAY_BUFFER, posBuffer, gl.DYNAMIC_DRAW);
 * 
 * // Release when done
 * release('position');
 * ```
 */
export interface MemoryPoolConfig {
  [name: string]: {
    count: number;
    itemSize: number;
  };
}

export interface MemoryPoolAPI {
  /** Allocate a buffer from the pool */
  allocate: (name: string) => Float32Array | null;
  /** Release a buffer back to the pool */
  release: (name: string, buffer?: Float32Array) => void;
  /** Get buffer without allocating (for reading) */
  getBuffer: (name: string) => Float32Array | null;
  /** Get buffer info */
  getInfo: (name: string) => { count: number; itemSize: number; allocated: number; available: number } | null;
  /** Resize pool */
  resize: (name: string, newCount: number) => void;
  /** Clear all pools */
  clear: () => void;
  /** Get all pool names */
  getPoolNames: () => string[];
}

/**
 * Create a memory pool hook with zero-allocation buffer management
 */
export function useMemoryPool(config: MemoryPoolConfig): MemoryPoolAPI {
  const poolsRef = useRef<Map<string, { 
    buffers: Float32Array[]; 
    allocated: Set<Float32Array>;
    count: number; 
    itemSize: number; 
  }>>(new Map());
  
  // Initialize pools
  useEffect(() => {
    const pools = poolsRef.current;
    Object.entries(config).forEach(([name, { count, itemSize }]) => {
      const totalSize = count * itemSize;
      const buffers: Float32Array[] = [];
      for (let i = 0; i < Math.min(count, 100); i++) { // Pre-allocate up to 100 buffers
        buffers.push(new Float32Array(totalSize));
      }
      pools.set(name, { buffers, allocated: new Set(), count, itemSize });
    });
  }, [config]);
  
  const allocate = useCallback((name: string): Float32Array | null => {
    const pool = poolsRef.current.get(name);
    if (!pool) return null;
    
    let buffer = pool.buffers.pop();
    if (!buffer) {
      buffer = new Float32Array(pool.count * pool.itemSize);
    }
    pool.allocated.add(buffer);
    return buffer;
  }, []);
  
  const release = useCallback((name: string, buffer?: Float32Array) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return;
    
    if (buffer) {
      pool.allocated.delete(buffer);
      pool.buffers.push(buffer);
    } else {
      // Release all allocated buffers for this pool
      pool.allocated.forEach(buf => pool.buffers.push(buf));
      pool.allocated.clear();
    }
  }, []);
  
  const getBuffer = useCallback((name: string): Float32Array | null => {
    const pool = poolsRef.current.get(name);
    if (!pool || pool.buffers.length === 0) return null;
      const buffer = pool.buffers[pool.buffers.length - 1];
      return buffer!;
    }, []);
  
  const getInfo = useCallback((name: string) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return null;
    return {
      count: pool.count,
      itemSize: pool.itemSize,
      allocated: pool.allocated.size,
      available: pool.buffers.length,
    };
  }, []);
  
  const resize = useCallback((name: string, newCount: number) => {
    const pool = poolsRef.current.get(name);
    if (!pool) return;
    
    pool.count = newCount;
    const totalSize = newCount * pool.itemSize;
    
    // Resize existing buffers
    pool.buffers.forEach(buf => {
      if (buf.length !== totalSize) {
        const newBuf = new Float32Array(totalSize);
        newBuf.set(buf.subarray(0, Math.min(buf.length, totalSize)));
        Object.assign(buf, newBuf);
      }
    });
    
    pool.allocated.forEach(buf => {
      if (buf.length !== totalSize) {
        const newBuf = new Float32Array(totalSize);
        newBuf.set(buf.subarray(0, Math.min(buf.length, totalSize)));
        pool.allocated.delete(buf);
        pool.allocated.add(newBuf);
      }
    });
  }, []);
  
  const clear = useCallback(() => {
    poolsRef.current.forEach(pool => {
      pool.allocated.forEach(buf => pool.buffers.push(buf));
      pool.allocated.clear();
    });
  }, []);
  
  const getPoolNames = useCallback(() => {
    return Array.from(poolsRef.current.keys());
  }, []);
  
  return {
    allocate,
    release,
    getBuffer,
    getInfo,
    resize,
    clear,
    getPoolNames,
  };
}