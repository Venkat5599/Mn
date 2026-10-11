"use client";

import { useEffect, useRef } from "react";

/**
 * Pixel-art cloud sky, ported from the scrappypet landing (github.com/Venkat5599/Gameboy). Same fragment shader,
 * run on raw WebGL instead of three.js: a full-screen triangle, six posterized clouds drifting in three layers.
 * The sky gradient sits on the container as CSS, so the hero is never blank before WebGL starts or without it.
 */

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}`;

const FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCount;
uniform vec3 uCloudColor;
uniform vec3 uSkyTopColor;
uniform vec3 uSkyBottomColor;
uniform float uPixelSize;
const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0; float amp = 0.5; for (int i = 0; i < 4; i++) { s += amp * vnoise(p); p = R * p * 2.03 + 19.19; amp *= 0.5; } return s; }
float billow(vec2 p) { float s = 0.0; float amp = 0.5; for (int i = 0; i < 5; i++) { s += amp * (1.0 - abs(2.0 * vnoise(p) - 1.0)); p = R * p * 2.11 + 13.37; amp *= 0.5; } return s; }
float cloudDensity(vec2 p, vec2 c, vec2 r, float seed, float t) {
  vec2 q = p - c;
  float ry = q.y > 0.0 ? r.y : r.y * 0.42;
  float env = 1.0 - length(vec2(q.x / r.x, q.y / ry));
  if (env < -0.35) return 0.0;
  vec2 dp = q * (2.4 / r.x) + seed;
  dp += 0.6 * vec2(fbm(dp * 1.4 + t * 0.04), fbm(dp * 1.4 + 7.7 - t * 0.03));
  float detail = billow(dp * 1.6);
  return env + (detail - 0.62) * 0.62;
}
vec3 shadeCloud(vec3 color, vec3 sky, vec2 p, vec2 c, vec2 r, float seed, float t, float dist) {
  float d = cloudDensity(p, c, r, seed, t);
  d = floor(d / 0.1) * 0.1;
  if (d < 0.02) return color;
  float dUp = cloudDensity(p + vec2(0.0, r.y * 0.55), c, r, seed, t);
  float occl = clamp((dUp - d) * 1.1 + d * 0.55, 0.0, 1.0);
  occl = floor(occl * 3.0) / 3.0;
  vec3 lit = uCloudColor * 1.04;
  vec3 shadow = mix(uCloudColor * 0.60, sky, 0.38);
  vec3 cloudCol = mix(lit, shadow, occl * 0.85);
  float alpha = step(0.02, d);
  cloudCol = mix(cloudCol, sky, dist * 0.35);
  return mix(color, cloudCol, alpha);
}
vec3 cloudPass(vec3 color, vec3 sky, vec2 p, float aspect, float t, float spd, float phase, float y, vec2 r, float seed, float dist) {
  float cx = mix(-r.x - 0.25, aspect + r.x + 0.25, fract(t * spd + phase));
  float cy = y + sin(t * 0.05 + phase * 6.2831) * 0.012;
  return shadeCloud(color, sky, p, vec2(cx, cy), r, seed, t, dist);
}
void main() {
  vec2 pixelCoord = floor(gl_FragCoord.xy / uPixelSize) * uPixelSize;
  vec2 uv = pixelCoord / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;
  vec3 sky = mix(uSkyBottomColor, uSkyTopColor, uv.y);
  vec3 color = sky;
  color = mix(color, uSkyBottomColor * 1.06, smoothstep(0.35, 0.0, uv.y) * 0.5);
  if (uCount > 5.5) color = cloudPass(color, sky, p, aspect, t, 0.006, 0.10, 0.84, vec2(0.20, 0.10), 43.7, 1.0);
  if (uCount > 4.5) color = cloudPass(color, sky, p, aspect, t, 0.008, 0.62, 0.73, vec2(0.24, 0.12), 71.3, 0.85);
  if (uCount > 3.5) color = cloudPass(color, sky, p, aspect, t, 0.011, 0.33, 0.60, vec2(0.34, 0.16), 17.3, 0.55);
  if (uCount > 2.5) color = cloudPass(color, sky, p, aspect, t, 0.013, 0.80, 0.47, vec2(0.30, 0.15), 29.9, 0.45);
  if (uCount > 1.5) color = cloudPass(color, sky, p, aspect, t, 0.016, 0.05, 0.35, vec2(0.46, 0.20), 91.1, 0.15);
  color = cloudPass(color, sky, p, aspect, t, 0.020, 0.48, 0.20, vec2(0.56, 0.24), 57.2, 0.0);
  gl_FragColor = vec4(color, 1.0);
}`;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
};

type Props = { cloudColor: string; skyTopColor: string; skyBottomColor: string; count?: number; pixelSize?: number; className?: string };

export function PixelClouds({ cloudColor, skyTopColor, skyBottomColor, count = 6, pixelSize = 6, className }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;image-rendering:pixelated";
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return; // the CSS sky gradient stays
    el.appendChild(canvas);

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.remove();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform1f(u("uCount"), count);
    gl.uniform3fv(u("uCloudColor"), rgb(cloudColor));
    gl.uniform3fv(u("uSkyTopColor"), rgb(skyTopColor));
    gl.uniform3fv(u("uSkyBottomColor"), rgb(skyBottomColor));
    const uTime = u("uTime");
    const uRes = u("uResolution");
    const uPix = u("uPixelSize");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = Math.max(1, Math.round(el.offsetWidth * dpr));
      canvas.height = Math.max(1, Math.round(el.offsetHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uPix, pixelSize * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3); // resizing clears the canvas; repaint at once
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(el);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const draw = () => {
      if (visible) {
        gl.uniform1f(uTime, still ? 0 : (performance.now() - t0) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [cloudColor, skyTopColor, skyBottomColor, count, pixelSize]);

  return (
    <div
      ref={box}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: `linear-gradient(to bottom, ${skyTopColor}, ${skyBottomColor})` }}
    />
  );
}
