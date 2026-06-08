import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMotion;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03 + 0.17;
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    centered.x *= 1.55;

    vec2 mouse = uMouse - 0.5;
    mouse.x *= 1.55;
    float mouseField = exp(-5.5 * length(centered - mouse));

    float t = uTime * 0.085 * uMotion;
    float flowA = fbm(centered * 2.25 + vec2(t, -t * 0.72));
    float flowB = fbm(centered * 3.15 - vec2(t * 0.55, t) + flowA);
    float ribbons = sin((centered.x + flowB * 0.58 + mouseField * 0.18) * 8.0 - t * 4.0);

    vec3 cream = vec3(0.996, 0.952, 0.872);
    vec3 cocoa = vec3(0.145, 0.052, 0.038);
    vec3 cherry = vec3(0.805, 0.070, 0.180);
    vec3 blush = vec3(0.946, 0.510, 0.600);
    vec3 butter = vec3(0.973, 0.745, 0.280);

    float chocolateMask = smoothstep(0.34, 0.77, flowB + ribbons * 0.12);
    float cherryMask = smoothstep(0.45, 0.93, flowA + mouseField * 0.46);
    float goldLine = smoothstep(0.965, 1.0, sin((flowB + uv.y) * 18.0));

    vec3 color = mix(cream, cocoa, chocolateMask * 0.88);
    color = mix(color, mix(cherry, blush, flowA), cherryMask * 0.35);
    color = mix(color, butter, goldLine * 0.25);

    float vignette = smoothstep(0.92, 0.15, length(centered));
    color *= 0.78 + vignette * 0.28;
    color += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.025;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ShaderPlane() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const targetMouse = useRef(new THREE.Vector2(0.67, 0.38));
  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      targetMouse.current.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight,
      );
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uMouse.value.lerp(targetMouse.current, 0.045);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.67, 0.38) },
          uMotion: { value: prefersReducedMotion ? 0.05 : 1 },
        }}
      />
    </mesh>
  );
}

export function CocoaShader() {
  return (
    <div className="shader-shell" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      >
        <ShaderPlane />
        <AdaptiveDpr pixelated />
      </Canvas>
      <div className="shader-grain" />
    </div>
  );
}
