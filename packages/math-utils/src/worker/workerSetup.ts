export const workerCode = `
const FRAME_BUFFER_COUNT = 4;
const MAX_BODIES = 10000;
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

// Local parallel arrays to avoid bloat in SharedArrayBuffer
const masses = new Float32Array(MAX_BODIES);
const isStatics = new Uint8Array(MAX_BODIES);
const restitutions = new Float32Array(MAX_BODIES);
const frictions = new Float32Array(MAX_BODIES);
const halfExtentsX = new Float32Array(MAX_BODIES);
const halfExtentsY = new Float32Array(MAX_BODIES);
const halfExtentsZ = new Float32Array(MAX_BODIES);

function initSharedMemory(buf) {
  buffer = buf;
  const f32 = new Float32Array(buf);
  const i32 = new Int32Array(buf);
  const offset = 256; // 1024 bytes
  
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

// 1D Sweep and Prune (SAP) for broadphase collision detection
function detectCollisions(count, baseIdx) {
  const activeIds = [];
  for (let i = 0; i < count; i++) {
    if (views.active[baseIdx + i] === 1) activeIds.push(i);
  }
  
  // Sort active bodies by their AABB Min X
  activeIds.sort((a, b) => {
    const minXA = views.pos[baseIdx * 3 + a * 3] - halfExtentsX[a];
    const minXB = views.pos[baseIdx * 3 + b * 3] - halfExtentsX[b];
    return minXA - minXB;
  });
  
  const n = activeIds.length;
  
  for (let i = 0; i < n; i++) {
    const idA = activeIds[i];
    const pA = baseIdx * 3 + idA * 3;
    const maxXA = views.pos[pA] + halfExtentsX[idA];
    
    for (let j = i + 1; j < n; j++) {
      const idB = activeIds[j];
      const pB = baseIdx * 3 + idB * 3;
      const minXB = views.pos[pB] - halfExtentsX[idB];
      
      // If the next body's Min X is beyond current body's Max X, we can stop checking
      // because all subsequent bodies will also be beyond Max X (array is sorted)
      if (minXB > maxXA) {
        break; 
      }
      
      const dX = views.pos[pA] - views.pos[pB];
      const dY = views.pos[pA+1] - views.pos[pB+1];
      const dZ = views.pos[pA+2] - views.pos[pB+2];
      
      const sX = halfExtentsX[idA] + halfExtentsX[idB];
      const sY = halfExtentsY[idA] + halfExtentsY[idB];
      const sZ = halfExtentsZ[idA] + halfExtentsZ[idB];
      
      // AABB overlap check for Y and Z (X is implicitly overlapping or very close)
      if (Math.abs(dX) < sX && Math.abs(dY) < sY && Math.abs(dZ) < sZ) {
        resolveCollision(idA, idB, pA, pB, dX, dY, dZ, sX, sY, sZ);
      }
    }
  }
}

function resolveCollision(idA, idB, pA, pB, dX, dY, dZ, sX, sY, sZ) {
  // Penetration depths on each axis
  const penX = sX - Math.abs(dX);
  const penY = sY - Math.abs(dY);
  const penZ = sZ - Math.abs(dZ);
  
  // Find minimum penetration axis
  let nx = 0, ny = 0, nz = 0;
  if (penX <= penY && penX <= penZ) { nx = Math.sign(dX); }
  else if (penY <= penX && penY <= penZ) { ny = Math.sign(dY); }
  else { nz = Math.sign(dZ); }
  
  const staticA = isStatics[idA];
  const staticB = isStatics[idB];
  if (staticA && staticB) return; // Both static
  
  const invMassA = staticA ? 0 : 1 / masses[idA];
  const invMassB = staticB ? 0 : 1 / masses[idB];
  const totalInvMass = invMassA + invMassB;
  
  const ratioA = invMassA / totalInvMass;
  const ratioB = invMassB / totalInvMass;
  
  const moveX = nx * (nx !== 0 ? penX : 0);
  const moveY = ny * (ny !== 0 ? penY : 0);
  const moveZ = nz * (nz !== 0 ? penZ : 0);
  
  // Positional correction (resolve penetration)
  views.pos[pA] += moveX * ratioA; views.pos[pA+1] += moveY * ratioA; views.pos[pA+2] += moveZ * ratioA;
  views.pos[pB] -= moveX * ratioB; views.pos[pB+1] -= moveY * ratioB; views.pos[pB+2] -= moveZ * ratioB;
  
  // Relative velocity
  const rvx = views.vel[pA] - views.vel[pB];
  const rvy = views.vel[pA+1] - views.vel[pB+1];
  const rvz = views.vel[pA+2] - views.vel[pB+2];
  
  const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;
  if (velAlongNormal > 0) return; // Moving apart
  
  const rest = Math.min(restitutions[idA], restitutions[idB]);
  let j = -(1 + rest) * velAlongNormal;
  j /= totalInvMass;
  
  const impulseX = j * nx; const impulseY = j * ny; const impulseZ = j * nz;
  
  if (!staticA) { views.vel[pA] += impulseX * invMassA; views.vel[pA+1] += impulseY * invMassA; views.vel[pA+2] += impulseZ * invMassA; }
  if (!staticB) { views.vel[pB] -= impulseX * invMassB; views.vel[pB+1] -= impulseY * invMassB; views.vel[pB+2] -= impulseZ * invMassB; }
  
  // Apply friction
  const friction = (frictions[idA] + frictions[idB]) / 2;
  // simplified friction logic on velocity
  if (!staticA) { views.vel[pA] *= (1 - friction); views.vel[pA+2] *= (1 - friction); }
  if (!staticB) { views.vel[pB] *= (1 - friction); views.vel[pB+2] *= (1 - friction); }
}

function simulate() {
  if (!views) return;
  const count = Atomics.load(views.meta, META.BODY_COUNT);
  const dt = views.metaF32[META.TIME_STEP/4];
  const gx = views.metaF32[META.GRAVITY_X/4], gy = views.metaF32[META.GRAVITY_Y/4], gz = views.metaF32[META.GRAVITY_Z/4];
  const wi = Atomics.load(views.meta, META.WRITE_INDEX);
  const nwi = (wi + 1) % FRAME_BUFFER_COUNT;
  
  // 1. Integration (Semi-Implicit Euler)
  for (let i = 0; i < count; i++) {
    if (views.active[wi * MAX_BODIES + i] === 0) continue;
    
    const base = wi * MAX_BODIES * 3 + i * 3;
    const tbase = nwi * MAX_BODIES * 3 + i * 3;
    
    let px = views.pos[base], py = views.pos[base+1], pz = views.pos[base+2];
    let vx = views.vel[base], vy = views.vel[base+1], vz = views.vel[base+2];
    
    if (isStatics[i] === 0) {
      vx += gx * dt; vy += gy * dt; vz += gz * dt;
      px += vx * dt; py += vy * dt; pz += vz * dt;
      
      // Floor collision fallback
      const hy = halfExtentsY[i];
      if (py - hy < 0) { 
        py = hy; 
        vx *= (1 - frictions[i]); 
        vz *= (1 - frictions[i]);
        vy = -vy * restitutions[i]; 
      }
    }
    
    views.pos[tbase] = px; views.pos[tbase+1] = py; views.pos[tbase+2] = pz;
    views.vel[tbase] = vx; views.vel[tbase+1] = vy; views.vel[tbase+2] = vz;
    views.active[nwi * MAX_BODIES + i] = 1;
  }
  
  // 2. Resolve Collisions
  detectCollisions(count, nwi * MAX_BODIES);
  
  // 3. Update AABBs for reading by main thread
  for (let i = 0; i < count; i++) {
    if (views.active[nwi * MAX_BODIES + i] === 0) continue;
    const tbase = nwi * MAX_BODIES * 3 + i * 3;
    const px = views.pos[tbase], py = views.pos[tbase+1], pz = views.pos[tbase+2];
    views.amin[tbase] = px - halfExtentsX[i]; views.amin[tbase+1] = py - halfExtentsY[i]; views.amin[tbase+2] = pz - halfExtentsZ[i];
    views.amax[tbase] = px + halfExtentsX[i]; views.amax[tbase+1] = py + halfExtentsY[i]; views.amax[tbase+2] = pz + halfExtentsZ[i];
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
    case 'ADD_BODY': 
      if (views) { 
        const c = Atomics.load(views.meta, META.BODY_COUNT); 
        if (c < MAX_BODIES) { 
          const b = payload;
          masses[c] = b.mass ?? 1;
          isStatics[c] = b.isStatic ? 1 : 0;
          restitutions[c] = b.restitution ?? 0.5;
          frictions[c] = b.friction ?? 0.3;
          if (b.aabbHalfExtents) {
            halfExtentsX[c] = b.aabbHalfExtents[0];
            halfExtentsY[c] = b.aabbHalfExtents[1];
            halfExtentsZ[c] = b.aabbHalfExtents[2];
          }
          const frame = Atomics.load(views.meta, META.WRITE_INDEX);
          const base = frame * MAX_BODIES * 3 + c * 3;
          views.pos[base]=b.position[0]; views.pos[base+1]=b.position[1]; views.pos[base+2]=b.position[2];
          views.vel[base]=b.velocity?.[0]||0; views.vel[base+1]=b.velocity?.[1]||0; views.vel[base+2]=b.velocity?.[2]||0;
          views.amin[base]=views.pos[base]-halfExtentsX[c]; views.amin[base+1]=views.pos[base+1]-halfExtentsY[c]; views.amin[base+2]=views.pos[base+2]-halfExtentsZ[c];
          views.amax[base]=views.pos[base]+halfExtentsX[c]; views.amax[base+1]=views.pos[base+1]+halfExtentsY[c]; views.amax[base+2]=views.pos[base+2]+halfExtentsZ[c];
          views.active[frame*MAX_BODIES+c]=1;
          
          Atomics.add(views.meta, META.BODY_COUNT, 1); 
          postMessage({type:'BODY_ADDED',id:c}); 
        } 
      } break;
    case 'REMOVE_BODY': if (views) { for(let f=0;f<FRAME_BUFFER_COUNT;f++) views.active[f*MAX_BODIES+payload.id]=0; postMessage({type:'BODY_REMOVED',id:payload.id}); } break;
    case 'UPDATE_BODY': if (views) { 
        const frame = Atomics.load(views.meta, META.WRITE_INDEX);
        const base = frame * MAX_BODIES * 3 + payload.id * 3;
        if (payload.position) { views.pos[base]=payload.position[0]; views.pos[base+1]=payload.position[1]; views.pos[base+2]=payload.position[2]; }
        if (payload.velocity) { views.vel[base]=payload.velocity[0]; views.vel[base+1]=payload.velocity[1]; views.vel[base+2]=payload.velocity[2]; }
    } break;
    case 'SET_GRAVITY': if (views) { views.metaF32[META.GRAVITY_X/4]=payload.x??0; views.metaF32[META.GRAVITY_Y/4]=payload.y??-9.81; views.metaF32[META.GRAVITY_Z/4]=payload.z??0; } break;
    case 'SET_TIME_STEP': if (views) views.metaF32[META.TIME_STEP/4]=payload.timeStep; break;
    case 'START': if (!running) { running=true; lastTime=performance.now(); loop(); } break;
    case 'STOP': running=false; if(timer) clearTimeout(timer); break;
    case 'RESET': running=false; if(timer) clearTimeout(timer); if(views) Atomics.store(views.meta, META.BODY_COUNT, 0); break;
  }
};
`;