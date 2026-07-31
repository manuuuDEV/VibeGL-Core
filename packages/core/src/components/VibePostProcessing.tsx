import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VibeConfig } from '../types';

export interface PostProcessingEffectProps {
  config: Required<VibeConfig>['postProcessing'];
}

export function PostProcessingEffect({ config }: PostProcessingEffectProps) {
  const composerRef = useRef<{
   scene: THREE.Scene;
   camera: THREE.OrthographicCamera;
   material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
   const ppScene = new THREE.Scene();
   const ppCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
   ppCamera.position.z = 1;

   const material = new THREE.ShaderMaterial({
     uniforms: {
       tDiffuse: { value: null },
       uTime: { value: 0 },
       uBloomIntensity: { value: 0 },
       uVignetteIntensity: { value: 0 },
       uGrainIntensity: { value: 0 },
       uChromaticIntensity: { value: 0 },
     },
     vertexShader: /* glsl */ `
       varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = vec4(position, 1.0);
       }
     `,
     fragmentShader: /* glsl */ `
       varying vec2 vUv;
       uniform sampler2D tDiffuse;
       uniform float uTime;
       uniform float uBloomIntensity;
       uniform float uVignetteIntensity;
       uniform float uGrainIntensity;
       uniform float uChromaticIntensity;

       float rand(vec2 uv) {
         return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
       }

       void main() {
         vec4 baseColor = texture2D(tDiffuse, vUv);
         vec3 color = baseColor.rgb;

         // Chromatic Aberration
         if (uChromaticIntensity > 0.0) {
           float ca = uChromaticIntensity * 4.0 / 1024.0;
           color.r = texture2D(tDiffuse, vUv + vec2(ca, 0.0)).r;
           color.b = texture2D(tDiffuse, vUv - vec2(ca, 0.0)).b;
         }

         // Vignette
         if (uVignetteIntensity > 0.0) {
           vec2 uvCenter = vUv - 0.5;
           float vignette = 1.0 - dot(uvCenter, uvCenter) * uVignetteIntensity;
           color *= vignette;
         }

         // Film Grain
         if (uGrainIntensity > 0.0) {
           float noise = (rand(vUv + fract(uTime * 100.0)) - 0.5) * uGrainIntensity;
           color += noise;
         }

         // Simple bloom-like brighten
         if (uBloomIntensity > 0.0) {
           float brightness = dot(color, vec3(0.299, 0.587, 0.114));
           color += color * brightness * uBloomIntensity;
         }

         gl_FragColor = vec4(color, baseColor.a);
       }
     `,
     transparent: true,
   });

   const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
   ppScene.add(quad);
   composerRef.current = { scene: ppScene, camera: ppCamera, material };

   return () => {
     material.dispose();
     quad.geometry.dispose();
   };
  }, []);

  useFrame(() => {
   const comp = composerRef.current;
   if (!comp) return;
    
   comp.material.uniforms.uTime!.value = performance.now() * 0.001;
   comp.material.uniforms.uBloomIntensity!.value = (config.bloom ?? 0) / 10;
   comp.material.uniforms.uVignetteIntensity!.value = (config.vignette ?? 0) / 5;
   comp.material.uniforms.uGrainIntensity!.value = (config.grain ?? 0) / 10;
   comp.material.uniforms.uChromaticIntensity!.value = config.chromaticAberration ?? 0;
  });

  return null;
}
