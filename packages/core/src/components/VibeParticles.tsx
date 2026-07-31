'use client';
import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import * as Nodes from 'three/examples/jsm/nodes/Nodes.js';
import { VibeConfig } from '../types';

export /** Particle system using WebGPU Compute Shaders / TSL */
function VibeParticles({ config, isWebGPU }: { config: Required<VibeConfig>['particles'], isWebGPU: boolean }) {
  const { count = 1000000, behavior = 'float', color = 'white', size = [0.05, 0.2] } = config;
  const ref = useRef<THREE.Points>(null);
  
  const [material] = useState(() => {
    if (isWebGPU && (Nodes as any).PointsNodeMaterial) {
      const mat = new (Nodes as any).PointsNodeMaterial({
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      // Set color based on config using nodes
      let colorNode;
      switch (color) {
        case 'neon': colorNode = (Nodes as any).color(0x00ffff); break;
        case 'fire': colorNode = (Nodes as any).color(0xff4400); break;
        case 'water': colorNode = (Nodes as any).color(0x00aaff); break;
        case 'galaxy': colorNode = (Nodes as any).color(0xaa00ff); break;
        default: colorNode = (Nodes as any).color(0xffffff);
      }
      mat.colorNode = colorNode;
      return mat;
    } else {
      // CPU Fallback Material
      return new THREE.PointsMaterial({ 
        size: 0.1, 
        transparent: true, 
        opacity: 0.8,
        vertexColors: true,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }
  });

  const [geometry] = useState(() => new THREE.BufferGeometry());
  
  // TSL Compute Variables
  const computeShaderRef = useRef<any>(null);

  // Initialize geometry with instanced attributes (CPU fallback OR TSL initial state)
  useEffect(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 5 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Colors (used mostly by CPU fallback)
      const colorObj = new THREE.Color();
      switch (color) {
        case 'neon': colorObj.setHSL(0.8 + Math.random() * 0.2, 1, 0.5); break;
        case 'fire': colorObj.setHSL(Math.random() * 0.1, 1, 0.5); break;
        case 'water': colorObj.setHSL(0.5 + Math.random() * 0.1, 1, 0.5); break;
        case 'galaxy': colorObj.setHSL(0.7 + Math.random() * 0.2, 0.8, 0.6); break;
        default: colorObj.setHSL(Math.random(), 0.5, 0.7);
      }
      colors[i3] = colorObj.r;
      colors[i3 + 1] = colorObj.g;
      colors[i3 + 2] = colorObj.b;
      
      // Velocities
      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    // Setup TSL Compute Node if available (DISABLED due to Three.js compatibility issues)
    /*
    if (isWebGPU && (Nodes as any).storage) {
      try {
        const posAttr = geometry.attributes.position;
        const velAttr = geometry.attributes.velocity;
        if (!posAttr || !velAttr) {
          console.warn('Missing position or velocity attributes on geometry');
          return;
        }
        
        const positionBuffer = new (Nodes as any).StorageInstancedBufferAttribute(posAttr.array as Float32Array, 3);
        const velocityBuffer = new (Nodes as any).StorageInstancedBufferAttribute(velAttr.array as Float32Array, 3);
        
        const positionStorage = (Nodes as any).storage(positionBuffer, 'vec3', count);
        const velocityStorage = (Nodes as any).storage(velocityBuffer, 'vec3', count);
        
        // Define Compute Node Logic
        const computeLogic = (Nodes as any).tslFn(() => {
          const pos = positionStorage.element((Nodes as any).instanceIndex);
          const vel = velocityStorage.element((Nodes as any).instanceIndex);
          
          if (behavior === 'swarm') {
            // Simple swarm logic via nodes
            const dist = (Nodes as any).length(pos);
            const force = (Nodes as any).vec3(pos).div(dist).mul(0.1);
            vel.subAssign(force);
          } else if (behavior === 'explode') {
             vel.mulAssign(1.01);
          }
          
          pos.addAssign(vel.mul(0.016)); // approx delta
        });
        
        computeShaderRef.current = computeLogic().compute(count);
        (material as any).positionNode = positionStorage.toAttribute();
      } catch (e) {
        console.warn("TSL Compute not fully supported in this version", e);
      }
    }
    */
    
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count, behavior, color, size, geometry, material, isWebGPU]);
  
  // Animation loop
  useFrame(({ gl }, delta) => {
    if (!ref.current) return;

    if (isWebGPU && computeShaderRef.current && (gl as any).compute) {
      // Run GPU Compute Shader
      (gl as any).compute(computeShaderRef.current);
    } else {
      // CPU Fallback for WebGL2 without Compute
      const positionAttr = geometry.getAttribute('position');
      const velocityAttr = geometry.getAttribute('velocity');
      if (!positionAttr || !velocityAttr) return;
    
      const positionArray: Float32Array = positionAttr.array as Float32Array;
      const velocityArray: Float32Array = velocityAttr.array as Float32Array;
    
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
      
        // Position update
        positionArray[i3]! += velocityArray[i3]! * delta;
        positionArray[i3 + 1]! += velocityArray[i3 + 1]! * delta;
        positionArray[i3 + 2]! += velocityArray[i3 + 2]! * delta;
      
        // Behavior
        if (behavior === 'swarm') {
          const dist = Math.sqrt(positionArray[i3]!**2 + positionArray[i3+1]!**2 + positionArray[i3+2]!**2);
          if (dist > 0) {
            velocityArray[i3]! -= positionArray[i3]! / dist * 0.5 * delta;
            velocityArray[i3 + 1]! -= positionArray[i3 + 1]! / dist * 0.5 * delta;
            velocityArray[i3 + 2]! -= positionArray[i3 + 2]! / dist * 0.5 * delta;
          }
        } else if (behavior === 'explode') {
            velocityArray[i3]! *= 1.01;
            velocityArray[i3 + 1]! *= 1.01;
            velocityArray[i3 + 2]! *= 1.01;
        }
      }
    
      positionAttr.needsUpdate = true;
    }
  });
  
  return <points ref={ref} geometry={geometry} material={material} />;
}
