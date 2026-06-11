import { useEffect, useRef } from "react";

const vertexShader = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = (aPosition + 1.0) * 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
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

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader compilation failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program.");

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Shader linking failed.";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export function CocoaShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch {
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);

    const timeUniform = gl.getUniformLocation(program, "uTime");
    const mouseUniform = gl.getUniformLocation(program, "uMouse");
    const motionUniform = gl.getUniformLocation(program, "uMotion");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const targetMouse = { x: 0.67, y: 0.38 };
    const currentMouse = { ...targetMouse };
    const startedAt = performance.now();
    let frame = 0;
    let lastFrameAt = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetMouse.x = event.clientX / window.innerWidth;
      targetMouse.y = 1 - event.clientY / window.innerHeight;
    };

    const render = (now: number) => {
      frame = window.requestAnimationFrame(render);
      if (!visible || document.hidden) return;
      if (reducedMotion && now - lastFrameAt < 1000 / 12) return;

      lastFrameAt = now;
      resize();
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.045;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.045;

      gl.useProgram(program);
      gl.uniform1f(timeUniform, (now - startedAt) / 1000);
      gl.uniform2f(mouseUniform, currentMouse.x, currentMouse.y);
      gl.uniform1f(motionUniform, reducedMotion ? 0.05 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    visibilityObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    resize();
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="shader-shell" aria-hidden="true">
      <canvas ref={canvasRef} data-renderer="native-webgl" />
      <div className="shader-grain" />
    </div>
  );
}
