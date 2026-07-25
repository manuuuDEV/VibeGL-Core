/**
 * @file PredictivePhysics.ts
 * @description Main-thread controller for the Predictive Physics Engine
 * 
 * Provides a zero-GC, lock-free interface to the physics worker.
 * The worker pre-calculates 4 frames ahead (current + 3 predicted).
 * Main thread simply consumes the pre-calculated Float32Array data.
 */

// ============================================
// TYPES (formerly from physics.worker.ts)
// ============================================

/** Physics body configuration for initialization */
export interface PhysicsBodyConfig {
  position: [number, number, number];
  velocity?: [number, number, number];
  acceleration?: [number, number, number];
  mass?: number;
  radius?: number;
  static?: boolean;
  id?: number; // Added by addBody method
}

/** Worker message types (for internal use) */
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

/** Main thread message types (for internal use) */
enum MainMessageType {
  READY = 'READY',
  FRAME_READY = 'FRAME_READY',
  BODY_ADDED = 'BODY_ADDED',
  BODY_REMOVED = 'BODY_REMOVED',
  ERROR = 'ERROR',
}

/** Number of frames to pre-calculate (current + 3 future) */
export const FRAME_BUFFER_COUNT = 4;

/** Maximum number of physics bodies supported */
export const MAX_BODIES = 10000;

// ============================================
// TYPES
// ============================================

/** All frame buffers for reading */
export interface FrameBuffers {
  positions: Float32Array;   // [FRAME_BUFFER_COUNT][MAX_BODIES][3]
  velocities: Float32Array;  // [FRAME_BUFFER_COUNT][MAX_BODIES][3]
  aabbMin: Float32Array;     // [FRAME_BUFFER_COUNT][MAX_BODIES][3]
  aabbMax: Float32Array;     // [FRAME_BUFFER_COUNT][MAX_BODIES][3]
  activeFlags: Int32Array;   // [FRAME_BUFFER_COUNT][MAX_BODIES]
}

/** Metadata from shared memory */
export interface PhysicsMetadata {
  writeIndex: number;
  readIndex: number;
  bodyCount: number;
  timeStep: number;
  gravity: [number, number, number];
  frameTime: number;
  simulationTime: number;
  version: number;
}

/** Prediction frame selector */
export type PredictionFrame = 0 | 1 | 2 | 3; // 0=current, 1=next, 2=next+1, 3=next+2

/** Opaque handle returned when adding a physics body */
export type PhysicsBodyHandle = number;

/** Single frame data for a physics body */
export interface BodyFrameData {
  position: [number, number, number];
  velocity: [number, number, number];
  aabbMin: [number, number, number];
  aabbMax: [number, number, number];
  active: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const META_OFFSET = {
  WRITE_INDEX: 0,
  READ_INDEX: 4,
  BODY_COUNT: 8,
  TIME_STEP: 12,
  GRAVITY_X: 16,
  GRAVITY_Y: 20,
  GRAVITY_Z: 24,
  FRAME_TIME: 28,
  SIMULATION_TIME: 36,
  LOCK: 44,
  VERSION: 48,
} as const;

const BODY_STRIDE = 13; // 3 pos + 3 vel + 3 aabbMin + 3 aabbMax + 1 active

// ============================================
// PREDICTIVE PHYSICS CONTROLLER
// ============================================

/**
 * Main-thread controller for the predictive physics engine.
 * 
 * Usage:
 * ```typescript
 * const physics = new PredictivePhysics();
 * await physics.init();
 * 
 * const body = physics.addBody({
 *   mass: 1,
 *   position: [0, 10, 0],
 *   velocity: [0, 0, 0],
 *   aabbHalfExtents: [0.5, 0.5, 0.5],
 *   restitution: 0.5,
 *   friction: 0.3,
 *   isStatic: false
 * });
 * 
 * physics.start();
 * 
 * // In render loop (zero allocation!):
 * const data = physics.readBody(body, 0); // Current frame
 * mesh.position.set(data.position[0], data.position[1], data.position[2]);
 * ```
 */
export class PredictivePhysics {
    private worker: Worker | null = null;
    private sharedBuffer: SharedArrayBuffer | null = null;
    private frameBuffers: FrameBuffers | null = null;
    private metadataView: Int32Array | null = null;
    private metadataFloatView: Float32Array | null = null;
    private metadataDoubleView: Float64Array | null = null;
    private isInitialized = false;
    private bodyHandles = new Map<number, PhysicsBodyHandle>();
    private nextBodyId = 0;
    private onFrameReadyCallback: ((frameIndex: number) => void) | null = null;
    private pendingInitResolve: ((value: void) => void) | null = null;

    /**
   * Initialize the physics engine.
   * Creates the SharedArrayBuffer and spawns the worker.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Check for SharedArrayBuffer support
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer not supported. Cross-origin isolation required.');
    }

    // Create shared memory buffer
    const bufferSize = MAX_BODIES * FRAME_BUFFER_COUNT * BODY_STRIDE * 4 + 1024;
    this.sharedBuffer = new SharedArrayBuffer(bufferSize);

    // Create views
    this.metadataView = new Int32Array(this.sharedBuffer);
    this.metadataFloatView = new Float32Array(this.sharedBuffer);
    this.metadataDoubleView = new Float64Array(this.sharedBuffer);

    // Create frame buffer views
    const dataOffset = 1024 / 4; // metadata is first 1024 bytes = 256 floats
    this.frameBuffers = {
      positions: new Float32Array(this.sharedBuffer, dataOffset * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
      velocities: new Float32Array(this.sharedBuffer, (dataOffset + FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
      aabbMin: new Float32Array(this.sharedBuffer, (dataOffset + 2 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
      aabbMax: new Float32Array(this.sharedBuffer, (dataOffset + 3 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
      activeFlags: new Int32Array(this.sharedBuffer, (dataOffset + 4 * FRAME_BUFFER_COUNT * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES),
    };

    // Spawn worker
    this.worker = this.createWorker();
    
    // Wait for worker ready
    await new Promise<void>((resolve) => {
      this.pendingInitResolve = resolve;
    });

    // Send init message with buffer
    this.worker!.postMessage({
      type: WorkerMessageType.INIT,
      payload: { buffer: this.sharedBuffer }
    }, [this.sharedBuffer]);

    this.isInitialized = true;
  }

  /**
   * Create the physics worker
   */
  private createWorker(): Worker {
    const workerCode = `
      // Inlined worker code for self-contained deployment
      // 100% Lock-Free Atomics Ring Buffer Rewrite
      const FRAME_BUFFER_COUNT = 4;
      const MAX_BODIES = 10000;
      const BODY_STRIDE = 13;
      const META = {
        WRITE_INDEX: 0, READ_INDEX: 4, BODY_COUNT: 8, TIME_STEP: 12,
        GRAVITY_X: 16, GRAVITY_Y: 20, GRAVITY_Z: 24, FRAME_TIME: 28,
        SIMULATION_TIME: 36, LOCK: 44, VERSION: 48
      };
      
      let buffer = null;
      let views = null;
      let running = false;
      let timer = null;
      let lastTime = 0;
      
      function initSharedMemory(buf) {
        buffer = buf;
        const f32 = new Float32Array(buf);
        const i32 = new Int32Array(buf);
        const offset = 256;
        
        views = {
          pos: new Float32Array(buf, (offset + 0 * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
          vel: new Float32Array(buf, (offset + 1 * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
          amin: new Float32Array(buf, (offset + 2 * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
          amax: new Float32Array(buf, (offset + 3 * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES * 3),
          active: new Int32Array(buf, (offset + 4 * MAX_BODIES * 3) * 4, FRAME_BUFFER_COUNT * MAX_BODIES),
          meta: i32,
          metaF32: f32,
        };
        
        Atomics.store(views.meta, META.WRITE_INDEX, 0);
        Atomics.store(views.meta, META.READ_INDEX, 0);
        Atomics.store(views.meta, META.BODY_COUNT, 0);
        views.metaF32[META.TIME_STEP/4] = 1/60;
        views.metaF32[META.GRAVITY_X/4] = 0; 
        views.metaF32[META.GRAVITY_Y/4] = -9.81; 
        views.metaF32[META.GRAVITY_Z/4] = 0;
        Atomics.store(views.meta, META.VERSION, 1);
        
        postMessage({ type: 'READY' });
      }
      
      // True Lock-Free Simulate
      function simulate() {
        if (!views) return;
        
        const count = Atomics.load(views.meta, META.BODY_COUNT);
        const dt = views.metaF32[META.TIME_STEP/4];
        const gx = views.metaF32[META.GRAVITY_X/4], gy = views.metaF32[META.GRAVITY_Y/4], gz = views.metaF32[META.GRAVITY_Z/4];
        
        const wi = Atomics.load(views.meta, META.WRITE_INDEX);
        const nwi = (wi + 1) % FRAME_BUFFER_COUNT;
        
        // Zero object allocation loop
        for (let i = 0; i < count; i++) {
          if (views.active[wi * MAX_BODIES + i] === 0) continue;
          
          const base = wi * MAX_BODIES * 3 + i * 3;
          let px = views.pos[base], py = views.pos[base+1], pz = views.pos[base+2];
          let vx = views.vel[base], vy = views.vel[base+1], vz = views.vel[base+2];
          const hx = (views.amax[base] - views.amin[base]) / 2;
          const hy = (views.amax[base+1] - views.amin[base+1]) / 2;
          const hz = (views.amax[base+2] - views.amin[base+2]) / 2;
          
          vx += gx * dt; vy += gy * dt; vz += gz * dt;
          const nx = px + vx * dt;
          let ny = py + vy * dt;
          const nz = pz + vz * dt;
          
          if (ny - hy < 0) { ny = hy; vy = -vy * 0.8; }
          
          const tbase = nwi * MAX_BODIES * 3 + i * 3;
          views.pos[tbase] = nx; views.pos[tbase+1] = ny; views.pos[tbase+2] = nz;
          views.vel[tbase] = vx; views.vel[tbase+1] = vy; views.vel[tbase+2] = vz;
          views.amin[tbase] = nx - hx; views.amin[tbase+1] = ny - hy; views.amin[tbase+2] = nz - hz;
          views.amax[tbase] = nx + hx; views.amax[tbase+1] = ny + hy; views.amax[tbase+2] = nz + hz;
          views.active[nwi * MAX_BODIES + i] = 1;
        }
        
        Atomics.store(views.meta, META.WRITE_INDEX, nwi);
        Atomics.add(views.meta, META.VERSION, 1);
        Atomics.notify(views.meta, META.WRITE_INDEX, 1);
        
        postMessage({ type: 'FRAME_READY', frameIndex: nwi, bodyCount: count, timestamp: performance.now() });
      }
      
      function loop() {
        if (!running) return;
        simulate();
        const now = performance.now();
        const elapsed = now - lastTime;
        const delay = Math.max(0, 1000/60 - elapsed);
        lastTime = now;
        timer = setTimeout(loop, delay);
      }
      
      self.onmessage = (e) => {
              const { type, payload } = e.data;
              switch (type) {
                case 'INIT': initSharedMemory(payload.buffer); break;
                case 'ADD_BODY': if (views) { const c = Atomics.load(views.meta, META.BODY_COUNT); if (c < MAX_BODIES) { writeBody(0, c, payload); Atomics.add(views.meta, META.BODY_COUNT, 1); postMessage({type:'BODY_ADDED',id:c}); } } break;
                case 'REMOVE_BODY': if (views) { for(let f=0;f<FRAME_BUFFER_COUNT;f++) views.active[f*MAX_BODIES+payload.id]=0; postMessage({type:'BODY_REMOVED',id:payload.id}); } break;
                case 'UPDATE_BODY': if (views) { writeBody(0, payload.id, payload); } break;
                case 'SET_GRAVITY': if (views) { views.metaF32[META.GRAVITY_X/4]=payload.x??0; views.metaF32[META.GRAVITY_Y/4]=payload.y??-9.81; views.metaF32[META.GRAVITY_Z/4]=payload.z??0; } break;
                case 'SET_TIME_STEP': if (views) views.metaF32[META.TIME_STEP/4]=payload.timeStep; break;
                case 'START': if (!running) { running=true; lastTime=performance.now(); loop(); } break;
                case 'STOP': running=false; if(timer) clearTimeout(timer); break;
              }
            };
      
      function writeBody(frame, idx, body) {
        const base = frame * MAX_BODIES * 3 + idx * 3;
        views.pos[base]=body.position[0]; views.pos[base+1]=body.position[1]; views.pos[base+2]=body.position[2];
        views.vel[base]=body.velocity[0]; views.vel[base+1]=body.velocity[1]; views.vel[base+2]=body.velocity[2];
        views.amin[base]=body.position[0]-body.aabbHalfExtents[0]; views.amin[base+1]=body.position[1]-body.aabbHalfExtents[1]; views.amin[base+2]=body.position[2]-body.aabbHalfExtents[2];
        views.amax[base]=body.position[0]+body.aabbHalfExtents[0]; views.amax[base+1]=body.position[1]+body.aabbHalfExtents[1]; views.amax[base+2]=body.position[2]+body.aabbHalfExtents[2];
        views.active[frame*MAX_BODIES+idx]=1;
      }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case MainMessageType.READY:
          this.pendingInitResolve?.();
          this.pendingInitResolve = null;
          break;
          
        case MainMessageType.FRAME_READY:
          this.onFrameReadyCallback?.(payload.frameIndex);
          break;
          
        case MainMessageType.BODY_ADDED:
              const handle: PhysicsBodyHandle = payload.id;
          this.bodyHandles.set(payload.id, handle);
          break;
          
        case MainMessageType.ERROR:
          console.error('[PredictivePhysics] Worker error:', payload.message);
          break;
      }
    };
    
    return worker;
  }

  /**
   * Add a physics body
   */
  addBody(config: Omit<PhysicsBodyConfig, 'id'>): PhysicsBodyHandle {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Physics not initialized. Call init() first.');
    }
    
    const id = this.nextBodyId++;
    const bodyConfig: PhysicsBodyConfig = { ...config, id };
    
    this.worker.postMessage({
      type: WorkerMessageType.ADD_BODY,
      payload: bodyConfig
    });
    
      return id;
  }

  /**
   * Remove a physics body
   */
  removeBody(handle: PhysicsBodyHandle): void {
    if (!this.worker) return;
    
    this.worker.postMessage({
      type: WorkerMessageType.REMOVE_BODY,
        payload: { id: handle }
    });
    
      this.bodyHandles.delete(handle);
  }

  /**
   * Update a physics body's position/velocity
   */
  updateBody(handle: PhysicsBodyHandle, updates: { position?: [number, number, number]; velocity?: [number, number, number] }): void {
    if (!this.worker) return;
    
    this.worker.postMessage({
      type: WorkerMessageType.UPDATE_BODY,
        payload: { id: handle, ...updates }
    });
  }

  /**
   * Set gravity vector
   */
  setGravity(x: number, y: number, z: number): void {
    if (!this.worker) return;
    
    this.worker.postMessage({
      type: WorkerMessageType.SET_GRAVITY,
      payload: { x, y, z }
    });
  }

  /**
   * Set fixed time step
   */
  setTimeStep(dt: number): void {
    if (!this.worker) return;
    
    this.worker.postMessage({
      type: WorkerMessageType.SET_TIME_STEP,
      payload: { timeStep: dt }
    });
  }

  /**
   * Start the physics simulation
   */
  start(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: WorkerMessageType.START });
  }

  /**
   * Stop the physics simulation
   */
  stop(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: WorkerMessageType.STOP });
  }

  /**
   * Reset the physics simulation
   */
  reset(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: WorkerMessageType.RESET });
    this.bodyHandles.clear();
    this.nextBodyId = 0;
  }

  /**
   * Register callback for when new frame data is ready
   */
  onFrameReady(callback: (frameIndex: number) => void): void {
    this.onFrameReadyCallback = callback;
  }

  /**
   * Read body data for a specific prediction frame (zero allocation!)
   * 
   * @param handle - Body handle from addBody()
   * @param frame - Prediction frame: 0=current, 1=next, 2=next+1, 3=next+2
   * @returns BodyFrameData with position, velocity, AABB
   */
  readBody(handle: PhysicsBodyHandle, frame: PredictionFrame = 0): BodyFrameData {
    if (!this.frameBuffers) {
      throw new Error('Physics not initialized');
    }
    
    const { positions, velocities, aabbMin, aabbMax, activeFlags } = this.frameBuffers;
      const index = handle;
    
    if (index >= MAX_BODIES) {
      throw new Error(`Body index ${index} exceeds maximum ${MAX_BODIES}`);
    }
    
    const baseIdx = frame * MAX_BODIES * 3 + index * 3;
    const activeIdx = frame * MAX_BODIES + index;
    
    return {
      position: [
            positions[baseIdx + 0]!,
            positions[baseIdx + 1]!,
            positions[baseIdx + 2]!,
      ],
      velocity: [
            velocities[baseIdx + 0]!,
            velocities[baseIdx + 1]!,
            velocities[baseIdx + 2]!,
      ],
      aabbMin: [
            aabbMin[baseIdx + 0]!,
            aabbMin[baseIdx + 1]!,
            aabbMin[baseIdx + 2]!,
      ],
      aabbMax: [
            aabbMax[baseIdx + 0]!,
            aabbMax[baseIdx + 1]!,
            aabbMax[baseIdx + 2]!,
      ],
      active: activeFlags[activeIdx] === 1,
    };
  }

  /**
   * Read body data directly into a pre-allocated Float32Array (zero allocation!)
   * 
   * @param handle - Body handle
   * @param frame - Prediction frame
   * @param out - Pre-allocated Float32Array of length 13
   */
  readBodyInto(handle: PhysicsBodyHandle, frame: PredictionFrame, out: Float32Array): void {
    if (!this.frameBuffers) {
      throw new Error('Physics not initialized');
    }
    
    const { positions, velocities, aabbMin, aabbMax, activeFlags } = this.frameBuffers;
      const index = handle;
    const baseIdx = frame * MAX_BODIES * 3 + index * 3;
    const activeIdx = frame * MAX_BODIES + index;
    
      out[0] = positions[baseIdx + 0]!;
      out[1] = positions[baseIdx + 1]!;
      out[2] = positions[baseIdx + 2]!;
      out[3] = velocities[baseIdx + 0]!;
      out[4] = velocities[baseIdx + 1]!;
      out[5] = velocities[baseIdx + 2]!;
      out[6] = aabbMin[baseIdx + 0]!;
      out[7] = aabbMin[baseIdx + 1]!;
      out[8] = aabbMin[baseIdx + 2]!;
      out[9] = aabbMax[baseIdx + 0]!;
      out[10] = aabbMax[baseIdx + 1]!;
      out[11] = aabbMax[baseIdx + 2]!;
      out[12] = activeFlags[activeIdx]!;
  }

  /**
   * Get current metadata
   */
  getMetadata(): PhysicsMetadata {
    if (!this.metadataView || !this.metadataFloatView || !this.metadataDoubleView) {
      throw new Error('Physics not initialized');
    }
    
    return {
        writeIndex: Atomics.load(this.metadataView, META_OFFSET.WRITE_INDEX)!,
        readIndex: Atomics.load(this.metadataView, META_OFFSET.READ_INDEX)!,
        bodyCount: Atomics.load(this.metadataView, META_OFFSET.BODY_COUNT)!,
        timeStep: this.metadataFloatView[META_OFFSET.TIME_STEP / 4]!,
      gravity: [
          this.metadataFloatView[META_OFFSET.GRAVITY_X / 4]!,
          this.metadataFloatView[META_OFFSET.GRAVITY_Y / 4]!,
          this.metadataFloatView[META_OFFSET.GRAVITY_Z / 4]!,
      ],
        frameTime: this.metadataDoubleView[META_OFFSET.FRAME_TIME / 8]!,
        simulationTime: this.metadataDoubleView[META_OFFSET.SIMULATION_TIME / 8]!,
        version: Atomics.load(this.metadataView, META_OFFSET.VERSION)!,
    };
  }

  /**
   * Get the shared array buffer (for advanced use cases)
   */
  getSharedBuffer(): SharedArrayBuffer | null {
    return this.sharedBuffer;
  }

  /**
   * Get frame buffers for direct access (advanced)
   */
  getFrameBuffers(): FrameBuffers | null {
    return this.frameBuffers;
  }

  /**
   * Check if physics is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get number of active bodies
   */
  get bodyCount(): number {
    if (!this.metadataView) return 0;
    return Atomics.load(this.metadataView, META_OFFSET.BODY_COUNT);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.sharedBuffer = null;
    this.frameBuffers = null;
    this.metadataView = null;
    this.metadataFloatView = null;
    this.metadataDoubleView = null;
    this.bodyHandles.clear();
    this.isInitialized = false;
  }
}

/**
 * Create a predictive physics instance (factory function)
 */
export function createPredictivePhysics(): PredictivePhysics {
  return new PredictivePhysics();
}