/**
 * Shared GLSL for the GPGPU passes and the point renderer (spec 5.4).
 * Simplex noise: Ashima Arts / Stefan Gustavson (MIT) — see docs/CREDITS.md.
 */

export const NOISE_GLSL = /* glsl */ `
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute4(vec4 x) { return mod289v4(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute4(permute4(permute4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

#ifdef LOW_QUALITY
// Cheap divergence-free-ish field from sines (spec 5.4 note): far fewer ALU ops on mobile GPUs.
vec3 curlNoise(vec3 p) {
  return vec3(sin(p.y * 1.7 + p.z * 0.9) - cos(p.z * 1.3),
              sin(p.z * 1.9 + p.x * 0.7) - cos(p.x * 1.1),
              sin(p.x * 1.5 + p.y * 1.1) - cos(p.y * 1.7)) * 0.6;
}
#else
vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 q = p + vec3(31.4, 0.0, 0.0);
  vec3 r = p + vec3(0.0, 47.2, 0.0);
  float x0 = snoise(r + dz) - snoise(r - dz);
  float x1 = snoise(q + dy) - snoise(q - dy);
  float y0 = snoise(p + dx) - snoise(p - dx);
  float y1 = snoise(r + dx) - snoise(r - dx);
  float z0 = snoise(q + dx) - snoise(q - dx);
  float z1 = snoise(p + dy) - snoise(p - dy);
  return vec3(x0 - x1, y0 - y1, z0 - z1) / (2.0 * e) * 0.35;
}
#endif
`;

export const MORPH_UNIFORMS_GLSL = /* glsl */ `
uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform sampler2D tFromAux;
uniform sampler2D tToAux;
uniform sampler2D tTrans;
uniform float uMorph;
uniform float uStagger;
uniform int uTransition;
uniform float uTime;
uniform float uMotionTime;
uniform float uTurbulence;
uniform float uSwirl;
uniform float uBurst;
uniform float uRain;
uniform float uCrack;
uniform vec4 uCrackPlane;
uniform float uShapeRadius;
uniform vec3 uPivotFrom[4];
uniform vec3 uPivotTo[4];
`;

export const MORPH_GLSL = /* glsl */ `
#define PI 3.14159265359

float easeInOutCubic(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }

// type: 0 none, 1 rotY, 2 differential (~1/sqrt(r)), 3 wave, 4 pulse, 5 thermal, 6 flow, 7 tilted orbit.
// aux.r packs type + 8 * layer; motion happens around the layer pivot so side-by-side layers spin in place.
vec3 applyMotion(vec3 p, vec4 aux, float param, float t, float rnd, bool isFrom) {
  float packed = aux.r + 0.5;
  int type = int(mod(packed, 8.0));
  int layer = int(packed / 8.0);
  vec3 pivot = isFrom ? uPivotFrom[layer] : uPivotTo[layer];
  vec3 q = p - pivot;
  float speed = aux.g;
  if (type == 1) q = rotY(t * speed) * q;
  // Differential rotation without the "winding problem": rigid spin plus a bounded radius-dependent sway,
  // so spiral arms stay legible however long the beat is held.
  else if (type == 2) { float r = max(length(q.xz), 0.05); q = rotY(t * speed * 0.6 + 0.35 * sin(t * speed * 0.3) / sqrt(r)) * q; }
  else if (type == 3) q += vec3(0.0, sin(q.x * 1.7 + q.z * 0.9 + t * max(speed, 0.2) * 2.0) * 0.12 * max(param, 0.15), 0.0);
  else if (type == 4) q *= (1.0 + 0.04 * sin(t * max(speed, 0.2) * 2.0 + rnd * 6.2831));
  else if (type == 5) q += vec3(snoise(q * 3.0 + t * speed), snoise(q * 3.1 - t * speed), snoise(q * 2.9 + 7.0 + t * speed)) * 0.015;
  else if (type == 7) { float a = t * speed / max(param, 0.2); q = rotX(0.35) * rotY(a) * rotX(-0.35) * q; }
  return q + pivot;
}

vec3 morphBase(vec2 ref, out float localProgress, out float bell) {
  vec4 a = texture2D(tFrom, ref);
  vec4 b = texture2D(tTo, ref);
  vec4 aAux = texture2D(tFromAux, ref);
  vec4 bAux = texture2D(tToAux, ref);
  vec4 tr = texture2D(tTrans, ref);
  float rnd = tr.g;

  float st = uStagger;
  float lp = clamp((uMorph - tr.r * st) / max(1.0 - st, 1e-4), 0.0, 1.0);
  float e = easeInOutCubic(lp);
  localProgress = lp;
  bell = sin(PI * lp);

  vec3 pa = applyMotion(a.xyz, aAux, a.w, uMotionTime, rnd, true);
  vec3 pb = applyMotion(b.xyz, bAux, b.w, uMotionTime, rnd, false);
  vec3 p = mix(pa, pb, e);

  if (bell > 0.001) {
    float R = uShapeRadius;
    if (uTransition == 0) {
      p += curlNoise(p * 0.6 / R + uTime * 0.05) * bell * uTurbulence * R;
    } else if (uTransition == 1) {
      float r = length(p.xz);
      p = rotY(bell * uSwirl * (1.2 - clamp(r * 0.25 / R, 0.0, 1.0))) * p;
      p += curlNoise(p * 0.4 / R) * bell * uTurbulence * 0.5 * R;
    } else if (uTransition == 2) {
      vec3 dir = normalize(p + vec3(1e-3) + (vec3(rnd, fract(rnd * 7.13), fract(rnd * 3.71)) - 0.5) * 0.6 * R);
      p += dir * bell * uBurst * (0.4 + rnd) * R;
    } else if (uTransition == 3) {
      p = rotX(bell * PI * 0.5 * sign(p.y + 1e-3) * 0.5) * p;
    } else if (uTransition == 4) {
      p.y -= bell * uRain * (0.3 + rnd) * R;
    } else if (uTransition == 5) {
      p += curlNoise(p * 1.5 / R + rnd) * bell * uTurbulence * 1.6 * R;
    }
  }

  if (uCrack > 0.0) {
    float side = sign(dot(uCrackPlane.xyz, p) - uCrackPlane.w + 1e-4);
    p += uCrackPlane.xyz * side * uCrack * 0.09 * uShapeRadius;
  }
  return p;
}
`;
