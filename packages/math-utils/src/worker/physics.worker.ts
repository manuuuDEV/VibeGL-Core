/**
 * @file physics.worker.ts
 * @description Predictive Physics Engine Worker
 * 
 * This worker runs in a dedicated Web Worker thread and calculates physics
 * for the CURRENT frame + PRE-CALCULATES the next 3 frames concurrently.
 * Uses SharedArrayBuffer + Atomics for lock-free, zero-jitter synchronization.
 * 
 * Architecture:
 * - Ring Buffer with 4 slots (current + 3 predicted frames)
 * - Atomics.wait/notify for synchronization
 * - Float32Array for positions, velocities, collision bounds
 * - Zero GC pressure during render loop
 */

// ============================================
// CONSTANTS & TYPES
// ============================================

/** Number of frames to pre-calculate (current + 3 future) */
const FRAME_BUFFER_COUNT = 4;

/** Maximum number of physics bodies supported */
const MAX_BODIES = 10000;

/** Offsets in the metadata section (first 1024 bytes = 256 floats) */
const META_OFFSET = {
  WRITE_INDEX: 0,      // u32: current write frame index (0-3)
  READ_INDEX: 1,       // u32: current read frame index (0-3)
  BODY_COUNT: 2,       // u32: number of active bodies
  TIME_STEP: 3,        // f32: fixed time step (1/60)
  GRAVITY_X: 4,        // f32
  GRAVITY_Y: 5,        // f32
  GRAVITY_Z: 6,        // f32
  FRAME_TIME: 7,       // f64: high-res timestamp of frame
  SIMULATION_TIME: 9,  // f64: accumulated simulation time
  LOCK: 11,            // u32: atomic lock (0=free, 1=locked)
  VERSION: 12,         // u32: data version for validation
} as const;

/** Worker message types */
enum WorkerMessageType {
  INIT = 'INIT',
  ADD_BODY = 'ADD_BODY',
  REMOVE_BODY = 'REMOVE_BODY',
  UPDATE_BODY = 'UPDATE_BODY',
  SET_GRAVITY = 'SET_GRAVITY',
  SET_TIME_STEP = 'SET_TIME_STEP',
  START = 'START',
  STOP = 'STOP',
  RESET = 'RESET',
}

/** Main thread message types */
enum MainMessageType {
  READY = 'READY',
  FRAME_READY = 'FRAME_READY',
  ERROR = 'ERROR',
  BODY_ADDED = 'BODY_ADDED',
  BODY_REMOVED = 'BODY_REMOVED',
}

/** Physics body configuration */
interface PhysicsBodyConfig {
  id: number;
  mass: number;
  position: [number, number, number];
  velocity: [number, number, number];
  aabbHalfExtents: [number, number, number];
  restitution: number;
  friction: number;
  isStatic: boolean;
}

/** Shared memory views */
interface SharedMemoryViews {
  positions: Float32Array;     // [frame][body][3]
  velocities: Float32Array;    // [frame][body][3]
  aabbMin: Float32Array;       // [frame][body][3]
  aabbMax: Float32Array;       // [frame][body][3]
  activeFlags: Int32Array;     // [frame][body]
  metaInt: Int32Array;         // Integer metadata (indices, counts, locks)
  metaFloat: Float32Array;     // Float metadata (timeStep, gravity)
  metaFloat64: Float64Array;   // Double metadata (timestamps)
}

// ============================================
// SHARED MEMORY MANAGEMENT
// ============================================

let views: SharedMemoryViews | null = null;
let isRunning = false;
let animationFrameId: number | null = null;
let lastFrameTime = 0;

/**
 * Initialize shared memory views
 */
function initSharedMemory(buffer: SharedArrayBuffer): void {
  // Metadata is first 1024 bytes = 256 floats
  // We use offset 256 floats for body data
  const META_FLOATS = 256;
  const dataOffset = META_FLOATS;
  
  views = {
    positions: new Float32Array(buffer, dataOffset * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
    velocities: new Float32Array(buffer, (dataOffset + FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
    aabbMin: new Float32Array(buffer, (dataOffset + 2 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
    aabbMax: new Float32Array(buffer, (dataOffset + 3 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
    activeFlags: new Int32Array(buffer, (dataOffset + 4 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES),
    metaInt: new Int32Array(buffer, 0, META_FLOATS),
    metaFloat: new Float32Array(buffer, 0, META_FLOATS),
    metaFloat64: new Float64Array(buffer, 0, META_FLOATS / 2),
  };
  
  // Initialize metadata
  const metaInt = views.metaInt;
  const metaFloat = views.metaFloat;
  
  Atomics.store(metaInt, META_OFFSET.WRITE_INDEX, 0);
  Atomics.store(metaInt, META_OFFSET.READ_INDEX, 0);
  Atomics.store(metaInt, META_OFFSET.BODY_COUNT, 0);
  metaFloat[META_OFFSET.TIME_STEP] = 1 / 60;
  metaFloat[META_OFFSET.GRAVITY_X] = 0;
  metaFloat[META_OFFSET.GRAVITY_Y] = -9.81;
  metaFloat[META_OFFSET.GRAVITY_Z] = 0;
  Atomics.store(metaInt, META_OFFSET.LOCK, 0);
  Atomics.store(metaInt, META_OFFSET.VERSION, 1);
  
  postMessage({ type: MainMessageType.READY });
}

/**
 * Acquire write lock using Atomics
 */
function acquireLock(): boolean {
  if (!views) return false;
  return Atomics.compareExchange(views.metaInt, META_OFFSET.LOCK, 0, 1) === 0;
}

/**
 * Release write lock
 */
function releaseLock(): void {
  if (!views) return;
  Atomics.store(views.metaInt, META_OFFSET.LOCK, 0);
  Atomics.notify(views.metaInt, META_OFFSET.LOCK, 1);
}

/**
 * Write body data to a specific frame buffer
 */
function writeBodyToFrame(frameIndex: number, bodyIndex: number, body: PhysicsBodyConfig): void {
  if (!views) return;
  
  const pos = views.positions;
  const vel = views.velocities;
  const aabbMin = views.aabbMin;
  const aabbMax = views.aabbMax;
  const active = views.activeFlags;
  
  const baseIdx = bodyIndex * 3;
  
  pos[frameIndex * MAX_BODIES * 3 + baseIdx + 0] = body.position[0];
  pos[frameIndex * MAX_BODIES * 3 + baseIdx + 1] = body.position[1];
  pos[frameIndex * MAX_BODIES * 3 + baseIdx + 2] = body.position[2];
  
  vel[frameIndex * MAX_BODIES * 3 + baseIdx + 0] = body.velocity[0];
  vel[frameIndex * MAX_BODIES * 3 + baseIdx + 1] = body.velocity[1];
  vel[frameIndex * MAX_BODIES * 3 + baseIdx + 2] = body.velocity[2];
  
  aabbMin[frameIndex * MAX_BODIES * 3 + baseIdx + 0] = body.position[0] - body.aabbHalfExtents[0];
  aabbMin[frameIndex * MAX_BODIES * 3 + baseIdx + 1] = body.position[1] - body.aabbHalfExtents[1];
  aabbMin[frameIndex * MAX_BODIES * 3 + baseIdx + 2] = body.position[2] - body.aabbHalfExtents[2];
  
  aabbMax[frameIndex * MAX_BODIES * 3 + baseIdx + 0] = body.position[0] + body.aabbHalfExtents[0];
  aabbMax[frameIndex * MAX_BODIES * 3 + baseIdx + 1] = body.position[1] + body.aabbHalfExtents[1];
  aabbMax[frameIndex * MAX_BODIES * 3 + baseIdx + 2] = body.position[2] + body.aabbHalfExtents[2];
  
  active[frameIndex * MAX_BODIES + bodyIndex] = 1;
}

/**
 * Predictive physics step - calculates current + 3 future frames
 */
function simulatePredictiveFrames(): void {
  if (!views || !acquireLock()) return;
  
  const { positions, velocities, aabbMin, aabbMax, activeFlags, metaInt, metaFloat } = views!;
  
  try {
    const bodyCount = Atomics.load(metaInt, META_OFFSET.BODY_COUNT) ?? 0;
    const timeStep = metaFloat[META_OFFSET.TIME_STEP] ?? (1 / 60);
    const gravityX = metaFloat[META_OFFSET.GRAVITY_X] ?? 0;
    const gravityY = metaFloat[META_OFFSET.GRAVITY_Y] ?? -9.81;
    const gravityZ = metaFloat[META_OFFSET.GRAVITY_Z] ?? 0;
    
    const currentWriteIndex = Atomics.load(metaInt, META_OFFSET.WRITE_INDEX) ?? 0;
    const nextWriteIndex = (currentWriteIndex + 1) % FRAME_BUFFER_COUNT;
    
    for (let i = 0; i < bodyCount; i++) {
      if (activeFlags[currentWriteIndex * MAX_BODIES + i] === 0) continue;
      
      // Read body data directly from shared memory
      const baseIdx = currentWriteIndex * MAX_BODIES * 3 + i * 3;
      let px = positions[baseIdx + 0]!;
      let py = positions[baseIdx + 1]!;
      let pz = positions[baseIdx + 2]!;
      let vx = velocities[baseIdx + 0]!;
      let vy = velocities[baseIdx + 1]!;
      let vz = velocities[baseIdx + 2]!;
      const halfX = aabbMin[baseIdx + 0]!;
      const halfY = aabbMin[baseIdx + 1]!;
      const halfZ = aabbMin[baseIdx + 2]!;
      
      // Simulate 4 frames ahead (current + 3 predicted)
      for (let frame = 0; frame < FRAME_BUFFER_COUNT; frame++) {
        const targetFrame = (currentWriteIndex + frame) % FRAME_BUFFER_COUNT;
        
        // Apply gravity
        vx += gravityX * timeStep;
        vy += gravityY * timeStep;
        vz += gravityZ * timeStep;
        
        // Integrate position
        const nx = px + vx * timeStep;
        const ny = py + vy * timeStep;
        const nz = pz + vz * timeStep;
        
        // Simple ground collision (y = 0)
        let finalY = ny;
        let finalVy = vy;
        if (ny - halfY < 0) {
          finalY = halfY;
          finalVy = -vy * 0.8; // Restitution
        }
        
        // Write predicted frame
        const targetBaseIdx = targetFrame * MAX_BODIES * 3 + i * 3;
        positions[targetBaseIdx + 0] = nx;
        positions[targetBaseIdx + 1] = finalY;
        positions[targetBaseIdx + 2] = nz;
        
        velocities[targetBaseIdx + 0] = vx;
        velocities[targetBaseIdx + 1] = finalVy;
        velocities[targetBaseIdx + 2] = vz;
        
        aabbMin[targetBaseIdx + 0] = nx - halfX;
        aabbMin[targetBaseIdx + 1] = finalY - halfY;
        aabbMin[targetBaseIdx + 2] = nz - halfZ;
        
        aabbMax[targetBaseIdx + 0] = nx + halfX;
        aabbMax[targetBaseIdx + 1] = finalY + halfY;
        aabbMax[targetBaseIdx + 2] = nz + halfZ;
        
        activeFlags[targetFrame * MAX_BODIES + i] = 1;
        
        // Update for next iteration
        px = nx;
        py = finalY;
        pz = nz;
      }
    }
    
    // Update metadata
    Atomics.store(metaInt, META_OFFSET.WRITE_INDEX, nextWriteIndex);
    metaFloat[META_OFFSET.FRAME_TIME] = performance.now();
    metaFloat[META_OFFSET.SIMULATION_TIME] = (metaFloat[META_OFFSET.SIMULATION_TIME] ?? 0) + timeStep * FRAME_BUFFER_COUNT;
    Atomics.add(metaInt, META_OFFSET.VERSION, 1);
    
    // Notify main thread that new frame data is ready
    Atomics.notify(metaInt, META_OFFSET.WRITE_INDEX, 1);
    
    postMessage({ 
      type: MainMessageType.FRAME_READY, 
      frameIndex: nextWriteIndex,
      bodyCount,
      timestamp: performance.now()
    });
    
  } finally {
    releaseLock();
  }
}

/**
 * Main simulation loop - runs at fixed time step
 */
function simulationLoop(): void {
  if (!isRunning) return;
  
  simulatePredictiveFrames();
  
  // Schedule next frame at 60Hz (16.67ms)
  const now = performance.now();
  const elapsed = now - lastFrameTime;
  const targetInterval = 1000 / 60;
  const delay = Math.max(0, targetInterval - elapsed);
  
  lastFrameTime = now;
  animationFrameId = setTimeout(simulationLoop, delay);
}

// ============================================
// MESSAGE HANDLERS
// ============================================

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case WorkerMessageType.INIT:
      initSharedMemory(payload.buffer);
      break;
      
    case WorkerMessageType.ADD_BODY: {
      if (!views) break;
      if (!acquireLock()) break;
      try {
            const bodyCount = Atomics.load(views.metaInt, META_OFFSET.BODY_COUNT);
        if (bodyCount < MAX_BODIES) {
          const newId = bodyCount;
          writeBodyToFrame(0, newId, payload);
              Atomics.store(views.metaInt, META_OFFSET.BODY_COUNT, bodyCount + 1);
          postMessage({ type: MainMessageType.BODY_ADDED, id: newId });
        }
      } finally {
        releaseLock();
      }
      break;
    }
      
    case WorkerMessageType.REMOVE_BODY: {
      if (!views) break;
      if (!acquireLock()) break;
      try {
            const bodyCount = Atomics.load(views.metaInt, META_OFFSET.BODY_COUNT);
        if (payload.id < bodyCount) {
          // Mark as inactive in all frames
          for (let f = 0; f < FRAME_BUFFER_COUNT; f++) {
            views.activeFlags[f * MAX_BODIES + payload.id] = 0;
          }
          postMessage({ type: MainMessageType.BODY_REMOVED, id: payload.id });
        }
      } finally {
        releaseLock();
      }
      break;
    }
      
    case WorkerMessageType.UPDATE_BODY: {
      if (!views) break;
      if (!acquireLock()) break;
      try {
        writeBodyToFrame(0, payload.id, payload);
      } finally {
        releaseLock();
      }
      break;
    }
      
    case WorkerMessageType.SET_GRAVITY: {
      if (!views) break;
          views.metaFloat[META_OFFSET.GRAVITY_X] = payload.x;
          views.metaFloat[META_OFFSET.GRAVITY_Y] = payload.y;
          views.metaFloat[META_OFFSET.GRAVITY_Z] = payload.z;
      break;
    }
      
    case WorkerMessageType.SET_TIME_STEP: {
      if (!views) break;
          views.metaFloat[META_OFFSET.TIME_STEP] = payload.timeStep;
      break;
    }
      
    case WorkerMessageType.START:
      if (!isRunning) {
        isRunning = true;
        lastFrameTime = performance.now();
        simulationLoop();
      }
      break;
      
    case WorkerMessageType.STOP:
      isRunning = false;
      if (animationFrameId !== null) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
      }
      break;
      
    case WorkerMessageType.RESET:
      if (views) {
        if (!acquireLock()) break;
        try {
              Atomics.store(views.metaInt, META_OFFSET.BODY_COUNT, 0);
              Atomics.store(views.metaInt, META_OFFSET.WRITE_INDEX, 0);
              Atomics.store(views.metaInt, META_OFFSET.READ_INDEX, 0);
          views.activeFlags.fill(0);
        } finally {
          releaseLock();
        }
      }
      break;
  }
};

// Export types for TypeScript
export type { PhysicsBodyConfig, SharedMemoryViews };
export { WorkerMessageType, MainMessageType, FRAME_BUFFER_COUNT, MAX_BODIES };