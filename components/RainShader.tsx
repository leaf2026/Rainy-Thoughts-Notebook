import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppSettings } from '../types';

// Vertex Shader: Simple full-screen quad
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader: 3D Volumetric Rain with High Refraction & Physics Jitter
const fragmentShader = `
uniform float uTime;
uniform float uRainIntensity;
uniform float uRainSpeed;
uniform float uDropletSize;
uniform float uBlurStrength;
uniform float uBrightness;
uniform float uContrast;
uniform float uRefraction;
uniform float uZoom;
uniform float uLightning;
uniform vec2 uResolution;
uniform sampler2D uBgTexture;
uniform bool uHasTexture;
uniform bool uAutoFit;
uniform float uImgAspect;

varying vec2 vUv;

#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float N(float t) {
    return fract(sin(t*12345.564)*7658.76);
}

float Saw(float b, float t) {
	return S(0., b, t)*S(1., b, t);
}

// Returns vec2(height, trailMask)
vec2 DropLayer2(vec2 uv, float t) {
    vec2 UV = uv;
    
    // -- GRID BREAKING & PHYSICS --
    // Add noise to x before grid to break "columns"
    uv.x += sin(uv.y * 1.5) * 0.05; 
    
    uv.y += t * 0.75;
    
    // Grid Setup
    // Adjusted aspect for wider/calmer feel
    vec2 a = vec2(10., 2.5); 
    vec2 grid = a * 2.0;
    vec2 id = floor(uv * grid);
    
    // Col Shift (Random vertical offset per column)
    float colShift = N(id.x); 
    uv.y += colShift;
    
    // Recalculate ID after shift
    id = floor(uv * grid);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
    
    // Local UV
    vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
    
    // -- SIZE HIERARCHY --
    // Use a power curve to bias towards small drops.
    // n.z is 0..1 random. pow(n.z, 3.0) pushes most values towards 0.
    // Result: Many tiny drops, very few large ones.
    float randomSize = n.z;
    float sizeHierarchy = pow(randomSize, 3.0); 
    
    // Base size modulated by user setting
    float dropRadius = mix(0.2, 0.65, sizeHierarchy) * uDropletSize;
    
    // -- POSITION JITTER --
    // Big drops slide differently than small ones
    float x = n.x - 0.5;
    
    float y = UV.y * 20.0;
    
    // Micro-jitter: drops wobble slightly as they fall
    float wiggle = sin(y + sin(y) + t * 2.0) * 0.05; 
    x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
    
    // Slide physics
    float ti = fract(t + n.z);
    // Big drops pause and slide faster (stepper saw)
    float slideSpeed = mix(0.85, 0.95, sizeHierarchy); 
    y = (Saw(slideSpeed, ti) - 0.5) * 0.9 + 0.5;
    
    vec2 p = vec2(x, y);
    
    // Distance
    float d = length((st - p) * a.yx);
    
    // Main Drop Shape
    float mainDrop = S(dropRadius, 0.0, d);
    
    // -- OPACITY/CONTRAST HIERARCHY --
    // Small drops should be flatter (less refraction)
    // Big drops have full height
    float heightMult = mix(0.3, 1.0, sizeHierarchy);
    mainDrop *= heightMult;

    // Trail logic
    float r = sqrt(S(1.0, y, st.y));
    float cd = abs(st.x - x);
    float trail = S(0.23 * r, 0.15 * r * r, cd);
    float trailFront = S(-0.02, 0.02, st.y - y);
    trail *= trailFront * r * r;
    
    y = UV.y;
    float trail2 = S(0.2 * r, 0.0, cd);
    float droplets = max(0.0, (sin(y * (1.0 - y) * 120.0) - st.y)) * trail2 * trailFront * n.z;
    y = fract(y * 10.0) + (st.y - 0.5);
    float dd = length(st - vec2(x, y));
    float dropletsHeight = S(0.2 * uDropletSize, 0.0, dd); // Tiny trail drops
    
    float combinedHeight = mainDrop + dropletsHeight * trail2 * trailFront * heightMult;
    
    return vec2(combinedHeight, trail);
}

float StaticDrops(vec2 uv, float t) {
	uv *= 40.; 
    vec2 id = floor(uv);
    uv = fract(uv) - 0.5;
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - 0.5) * 0.7;
    float d = length(uv - p);
    float fade = Saw(0.025, fract(t + n.z));
    
    // Use uDropletSize for static drops too
    float h = S(0.2 * uDropletSize, 0.0, d); 
    
    return h * fract(n.z * 10.0) * fade;
}

vec2 GetHeightAndTrail(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t) * l0; 
    vec2 m1 = DropLayer2(uv, t);
    vec2 m2 = DropLayer2(uv * 1.85, t); // Second layer offset and scaled
    
    float h = s + m1.x * l1 + m2.x * l2;
    h = smoothstep(0.0, 1.0, h); 
    float trail = max(m1.y * l1, m2.y * l2);
    return vec2(h, trail);
}

void main() {
    vec2 uv = vUv;
    uv = (uv - 0.5) / uZoom + 0.5;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 physUV = uv * aspect;

    float T = uTime * uRainSpeed;
    float rainAmount = uRainIntensity;
    
    // -- TUNING --
    
    // 1. Static Drops (Mist)
    float staticDrops = S(0.0, 1.0, rainAmount) * 0.3;
    
    // 2. Moving Layers
    float layer1 = S(0.0, 0.8, rainAmount);
    // Secondary layer is fainter and mostly small drops to fill negative space
    float layer2 = S(0.5, 1.0, rainAmount) * 0.3; 
    
    // Height Map
    vec2 texel = vec2(1.0 / uResolution.y, 0.0);
    vec2 center = GetHeightAndTrail(physUV, T, staticDrops, layer1, layer2);
    float h = center.x;
    float trail = center.y;
    
    // Normal Calculation
    float h_right = GetHeightAndTrail(physUV + texel.xy, T, staticDrops, layer1, layer2).x;
    float h_up    = GetHeightAndTrail(physUV + texel.yx, T, staticDrops, layer1, layer2).x;
    
    // Normal Strength
    // Normal magnitude is key to "glass" look. 
    vec2 normal = vec2(h - h_right, h - h_up) * 15.0 * uRefraction;
    
    // Refraction
    vec2 refractionUV = uv - normal;
    
    // Focus/Blur
    // Focus mask: 0 = blurred bg, 1 = clear drop
    float focus = mix(uBlurStrength * 6.0, 0.0, S(0.0, 0.4, h + trail));
    
    // Texture Sample
    vec3 col = vec3(0.0);
    
    if (uHasTexture) {
        vec2 texUv = refractionUV;
        if (uAutoFit) {
            float screenAspect = uResolution.x / uResolution.y;
            
            // Fixed COVER logic to prevent collapsing
            
            if (screenAspect > uImgAspect) {
                 float r = screenAspect / uImgAspect;
                 texUv.y = (texUv.y - 0.5) / r + 0.5; 
            } else {
                 float r = uImgAspect / screenAspect;
                 texUv.x = (texUv.x - 0.5) / r + 0.5;
            }
        }
        col = texture2D(uBgTexture, texUv, focus).rgb;
    } else {
         // Procedural "Cinematic Atmosphere" Background
         // Features: Dynamic gradients, shifting bokeh lights, and soft motion
         
         vec2 bgUV = refractionUV;
         
         // Adjusted time for fluid motion (1.0x speed)
         float t = uTime * 1.0; 
         
         // 1. BASE ATMOSPHERE (Gradient)
         // Retaining the user's preferred "Sunset/Dusk" palette
         vec3 colTop = vec3(0.55, 0.75, 0.95); // Soft Sky Blue
         vec3 colMid = vec3(0.98, 0.72, 0.55); // Peach/Apricot
         vec3 colBot = vec3(0.2, 0.25, 0.5);   // Deep Twilight Blue
         
         // Atmospheric Distortion (Breathing/Drifting)
         vec2 waveUV = bgUV;
         // Fluid motion
         waveUV.x += sin(bgUV.y * 2.0 + t * 0.8) * 0.1; 
         waveUV.y += cos(bgUV.x * 1.5 + t * 0.6) * 0.1;
         
         float y = waveUV.y;
         // Smooth mixing between layers
         vec3 bg = mix(colBot, colMid, smoothstep(-0.2, 0.5, y));
         bg = mix(bg, colTop, smoothstep(0.4, 1.1, y));
         
         // 2. SHIFTING LIGHTS (Cinematic Bokeh)
         // Simulates distant city lights, traffic, or glowing windows through rain/fog
         
         // Light A: Warm Gold (Drifting Right)
         vec2 posA = vec2(0.5 + sin(t * 0.3) * 0.7, 0.4 + cos(t * 0.2) * 0.4);
         
         // Aspect fix for round bokeh
         float distA = length((bgUV - posA) * vec2(1.0, 1.5)); 
         float glowA = smoothstep(0.6, 0.0, distA); // Soft edge
         bg += vec3(1.0, 0.8, 0.4) * glowA * 0.18; // Add gold glow
         
         // Light B: Soft Pink/Red (Drifting Left)
         vec2 posB = vec2(0.5 + cos(t * 0.4 + 2.0) * 0.6, 0.3 + sin(t * 0.3) * 0.3);
         float distB = length((bgUV - posB) * vec2(1.0, 1.5));
         float glowB = smoothstep(0.5, 0.0, distB);
         bg += vec3(1.0, 0.4, 0.5) * glowB * 0.15; // Add pink glow
         
         // Light C: Bright Sky Highlight (Pulsing near top)
         vec2 posC = vec2(0.5 + sin(t * 0.6) * 0.3, 0.8 + cos(t * 0.2) * 0.1);
         float distC = length(bgUV - posC);
         float glowC = smoothstep(0.45, 0.0, distC);
         glowC *= 0.8 + 0.2 * sin(uTime * 1.5); // Pulse effect
         bg += vec3(0.85, 0.95, 1.0) * glowC * 0.12;
         
         // 3. MOVING RAYS (Passing Beams)
         // Gentle diagonal bands (traffic/clouds)
         // Adjusted speed slightly faster than 0.5x
         float rays = sin(bgUV.x * 3.0 - uTime * 2.0 + bgUV.y * 2.0);
         rays += sin(bgUV.x * 2.0 + uTime * 1.0); // Layering sines
         rays = smoothstep(0.0, 1.0, rays); 
         bg += vec3(1.0, 1.0, 0.9) * rays * 0.06; 

         // 4. FILM GRAIN
         // Adds texture to prevent banding and increase realism
         float noise = N(dot(vUv, vec2(12.9898,78.233)) + uTime);
         bg += (noise - 0.5) * 0.04;

         col = bg;
    }
    
    // Lightning Flash
    // Add a cold, bright flash that illuminates everything, including drops
    // Slightly blue-ish tint
    if (uLightning > 0.0) {
        vec3 flashCol = vec3(0.8, 0.9, 1.0);
        col = mix(col, flashCol, uLightning * 0.6);
    }
    
    // Lighting
    vec3 lightDir = normalize(vec3(-0.5, 1.0, 0.5));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 N = normalize(vec3(normal * 2.0, 1.0)); 
    
    // Specular Highlight
    float spec = pow(max(0.0, dot(reflect(-lightDir, N), viewDir)), 32.0) * 0.8;
    // Fresnel Rim
    float fresnel = pow(1.0 - max(0.0, dot(N, viewDir)), 3.0) * 0.3;
    
    // Mask lighting to drops only
    float dropMask = smoothstep(0.01, 0.1, h);
    col += (spec + fresnel) * dropMask;
    
    // Ambient Occlusion edges
    col *= mix(1.0, 0.9, dropMask * length(normal));

    // Vignette
    float vig = 1.0 - length(vUv - 0.5) * 0.2;
    col *= vig;
    
    // Grading
    col *= uBrightness;
    col = (col - 0.5) * uContrast + 0.5;

    gl_FragColor = vec4(col, 1.0);
}
`;

interface RainShaderProps {
  settings: AppSettings;
  lightning: number; // New prop for visual flash intensity
}

const RainShader: React.FC<RainShaderProps> = ({ settings, lightning }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [imgAspect, setImgAspect] = useState(1.0);

  useEffect(() => {
    if (settings.backgroundUrl) {
      new THREE.TextureLoader().load(settings.backgroundUrl, (tex) => {
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.wrapS = THREE.MirroredRepeatWrapping;
        tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.anisotropy = 16;
        if (tex.image) {
           setImgAspect(tex.image.width / tex.image.height);
        }
        setTexture(tex);
      });
    } else {
      setTexture(null);
    }
  }, [settings.backgroundUrl]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uBgTexture: { value: null },
    uHasTexture: { value: false },
    uRainIntensity: { value: settings.rainIntensity },
    uRainSpeed: { value: settings.rainSpeed },
    uDropletSize: { value: settings.rainDropletSize },
    uBlurStrength: { value: settings.glassBlur },
    uBrightness: { value: settings.brightness },
    uContrast: { value: settings.contrast },
    uRefraction: { value: settings.refraction },
    uZoom: { value: settings.zoom },
    uLightning: { value: 0 }, // Init
    uAutoFit: { value: settings.autoFitBackground },
    uImgAspect: { value: 1.0 },
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uResolution.value.set(size.width, size.height);
      material.uniforms.uRainIntensity.value = settings.rainIntensity;
      material.uniforms.uRainSpeed.value = settings.rainSpeed;
      material.uniforms.uDropletSize.value = settings.rainDropletSize;
      material.uniforms.uBlurStrength.value = settings.glassBlur;
      material.uniforms.uBrightness.value = settings.brightness;
      material.uniforms.uContrast.value = settings.contrast;
      material.uniforms.uRefraction.value = settings.refraction;
      material.uniforms.uZoom.value = settings.zoom;
      material.uniforms.uLightning.value = lightning; // Pass the visual state
      material.uniforms.uAutoFit.value = settings.autoFitBackground;
      
      if (texture) {
         material.uniforms.uBgTexture.value = texture;
         material.uniforms.uHasTexture.value = true;
         material.uniforms.uImgAspect.value = imgAspect;
      } else {
         material.uniforms.uHasTexture.value = false;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[size.width, size.height]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default RainShader;