import { MORPH_GLSL, MORPH_UNIFORMS_GLSL, NOISE_GLSL } from "./common.glsl";

/** GPGPU interactive layer (spec 5.5): a damped spring offset that the cursor ray pushes away. */
export const VELOCITY_FRAG = /* glsl */ `
${MORPH_UNIFORMS_GLSL}
uniform float uDt;
uniform vec3 uPointer;
uniform vec3 uPointerDir;
uniform float uPointerStrength;
${NOISE_GLSL}
${MORPH_GLSL}
void main() {
  vec2 ref = gl_FragCoord.xy / resolution.xy;
  vec3 off = texture2D(tOffset, ref).xyz;
  vec3 vel = texture2D(tVelocity, ref).xyz;
  vec3 force = vec3(0.0);
  if (uPointerStrength > 0.0) {
    float lp, bell;
    vec3 base = morphBase(ref, lp, bell);
    vec3 p = base + off;
    vec3 toP = p - uPointer;
    vec3 proj = uPointer + uPointerDir * dot(toP, uPointerDir);
    vec3 away = p - proj;
    float d = length(away);
    float radius = 0.18 * uShapeRadius;
    float f = uPointerStrength * smoothstep(radius, 0.0, d);
    force = normalize(away + 1e-5) * f;
  }
  vec3 spring = -off * 18.0;
  vec3 damping = -vel * 6.5;
  vel += (force + spring + damping) * uDt;
  gl_FragColor = vec4(vel, 1.0);
}
`;

export const OFFSET_FRAG = /* glsl */ `
uniform float uDt;
uniform float uShapeRadius;
void main() {
  vec2 ref = gl_FragCoord.xy / resolution.xy;
  vec3 off = texture2D(tOffset, ref).xyz + texture2D(tVelocity, ref).xyz * uDt;
  gl_FragColor = vec4(clamp(off, vec3(-0.5 * uShapeRadius), vec3(0.5 * uShapeRadius)), 1.0);
}
`;

/** Render: final position, size, colour (spec 5.6). */
export const POINTS_VERT = /* glsl */ `
${MORPH_UNIFORMS_GLSL}
attribute vec2 aRef;
uniform sampler2D tOffsetTex;
uniform sampler2D tFromCol;
uniform sampler2D tToCol;
uniform float uDensity;
uniform float uHighlightLo;
uniform float uHighlightHi;
uniform float uDimOthers;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uMaxPointSize;
uniform float uFogDensity;
uniform float uFogStart;
uniform float uTwinkle;
uniform float uGlobalAlpha;
uniform float uSpore;
uniform float uDustAlpha;
varying vec4 vColor;
varying float vGlow;
${NOISE_GLSL}
${MORPH_GLSL}
void main() {
  vec4 tr = texture2D(tTrans, aRef);
  float rnd = tr.g;
  // Real-time density degradation without rebuilding buffers.
  if (rnd > uDensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }

  float lp, bell;
  vec3 base = morphBase(aRef, lp, bell);
  vec3 p = base + texture2D(tOffsetTex, aRef).xyz;

  vec4 ca = texture2D(tFromCol, aRef);
  vec4 cb = texture2D(tToCol, aRef);
  float e = easeInOutCubic(lp);
  vec4 col = mix(ca, cb, e);

  vec4 aAux = texture2D(tFromAux, aRef);
  vec4 bAux = texture2D(tToAux, aRef);
  float region = mix(aAux.b, bAux.b, step(0.5, e));
  float size = mix(aAux.a, bAux.a, e);
  bool isDust = region > 0.99999;
  if (isDust) col.a *= uDustAlpha;

  // Spores (crack event): a few particles rise slowly from the fracture plane.
  if (uSpore > 0.0 && fract(rnd * 13.37) < 0.035 && !isDust) {
    float h = fract(uTime * 0.08 + rnd * 7.0);
    vec3 onPlane = p - uCrackPlane.xyz * (dot(uCrackPlane.xyz, p) - uCrackPlane.w);
    p = mix(p, onPlane + vec3(0.0, h * 0.5 * uShapeRadius, 0.0), uSpore);
    col.rgb = mix(col.rgb, vec3(1.0), 0.5 * uSpore);
  }

  float hi = 1.0;
  if (uHighlightLo >= 0.0) {
    float idx = region * 65535.0;
    hi = (idx > uHighlightLo - 0.5 && idx < uHighlightHi + 0.5) ? 1.0 : 0.0;
  }
  float dim = mix(1.0, hi > 0.5 ? 1.25 : 0.4, uDimOthers);

  float flowPulse = 1.0;
  float bt = mod(bAux.r + 0.5, 8.0);
  if (int(bt) == 6) {
    vec4 bp = texture2D(tTo, aRef);
    flowPulse = 0.7 + 0.6 * pow(0.5 + 0.5 * sin(bp.w * 12.0 - uMotionTime * 2.5 * max(bAux.g, 0.3)), 6.0);
  }
  float twinkle = 1.0 - uTwinkle * 0.15 + uTwinkle * 0.15 * sin(uTime * (1.5 + rnd * 4.0) + rnd * 40.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float att = 1.0 / max(-mv.z, 0.1);
  gl_PointSize = clamp(uPointSize * size * uPixelRatio * att * (1.0 + bell * 0.6) * twinkle, 0.0, uMaxPointSize);

  float fog = exp(-uFogDensity * max(-mv.z - uFogStart, 0.0));
  vColor = vec4(col.rgb * dim * flowPulse * fog, col.a * fog * uGlobalAlpha);
  vGlow = bell;
}
`;

export const POINTS_FRAG = /* glsl */ `
varying vec4 vColor;
varying float vGlow;
uniform float uIntensity;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.2) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * (1.0 + vGlow * 0.35) * a * uIntensity, a);
}
`;

/** Full-screen background: ink-0 with an almost imperceptible radial lift toward the optical center. */
export const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
export const BG_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec2 uCenter;
uniform vec2 uAspect;
uniform vec3 uInk0;
uniform vec3 uInk1;
void main() {
  vec2 d = (vUv - uCenter) * uAspect;
  float t = smoothstep(0.85, 0.0, length(d));
  gl_FragColor = vec4(mix(uInk0, uInk1, t * 0.9), 1.0);
}
`;
