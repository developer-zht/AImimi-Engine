// 这段代码在 WebGL / OpenGL ES 环境下编译
// 桌面 OpenGL 环境：没有 GL_ES 宏，float 默认就是高精度，写 precision 反而会报错
// 所以 #ifdef 跳过了这行
#ifdef GL_ES
precision highp float;
#endif

// Shadertoy 内置变量 → 手动声明为 uniform
uniform vec3 iResolution; // viewport resolution (pixels)
uniform float iTime; // shader playback time (seconds)
uniform vec4 iMouse; // mouse pixel coords (xy: current, zw: click)

/**
 * Clouds over the Sea and Snowy Peaks
 * by Lerrain 2025-02-20
 *
 * The seashore at the foot of the snowy mountains
 * the beautiful scenery during the day, and the moments of sunrise and sunset.
 *
 * By holding down the mouse button and dragging, you can adjust the angle.
 * Referenced the examples of @IQ, and used the method of @nimitz for cloud rendering.
 */

#define QUALITY 1 //1:fast 2:good 3:film
#if QUALITY == 3
#define MAX_FAR 40000.0
#define ITER(x) (18 - int(log((x) * RES_FACTOR) * 0.693))
#define CLOUD_QUALITY 400
#define CLOUD_ITER 12
#define CLOUD_THICK 0.9
#define MARCH_SURFACE 0.2
#define MARCH_STEP 0.0005
#define MARCH_REF_SCALE 1.01
#define SHADOW_STEP 1.2
#define SEA_DEEP 2000.0
#elif QUALITY == 1
#define MAX_FAR 15000.0
#define ITER(x) (13 - int(log((x) * RES_FACTOR) * 0.693))
#define CLOUD_QUALITY 100
#define CLOUD_ITER 5
#define CLOUD_THICK 0.7
#define MARCH_SURFACE 0.5
#define MARCH_STEP 0.002
#define MARCH_REF_SCALE 10.0
#define SHADOW_STEP 2.0
#define SEA_DEEP 300.0
#else
#define MAX_FAR 20000.0
#define ITER(x) (15 - int(log((x) * RES_FACTOR) * 0.693))
#define CLOUD_QUALITY 150
#define CLOUD_ITER 6
#define CLOUD_THICK 0.8
#define MARCH_SURFACE 0.4
#define MARCH_STEP 0.002
#define MARCH_REF_SCALE 4.0
#define SHADOW_STEP 2.0
#define SEA_DEEP 500.0
#endif

#define PI 3.1415926
#define SEA_MAX 1.25
#define SURFACE_MAX 2000.0
#define CLOUD_MAX 3000.0
#define SUN_COLOR vec3(0.95, 0.96, 1.2)

const vec2 WIND = vec2(-0.6, -1.5);

vec3 LIGHT;
vec3 BASE_COLOR;
vec3 ATOM_COLOR;
vec3 HLIT_COLOR;
vec3 ENV_COLOR;
float CLOUDS = 0.0;
float CLOUD_HEIGHT = 1200.0;
float RES_FACTOR = 1.0;
float TIME = 0.33;
float BRIGHT = 0.5;

mat3 setCamera(vec3 ro, vec3 ta) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(0, 1, 0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

vec4 permute(vec4 x) {
  x *= x * 34.0 + 1.0;
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float n3d(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i -= floor(i * (1.0 / 289.0)) * 289.0;
  vec4 p = permute(
    permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
      i.x +
      vec4(0.0, i1.x, i2.x, 1.0)
  );

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0, 0, 0, 0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  //Normalise gradients
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)); //taylorInvSqrt
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float n2d(vec2 p) {
  vec2 i = floor(p);
  p -= i;
  p *= p * (3.0 - p * 2.0);
  return dot(
    mat2(fract(sin(mod(vec4(0, 1, 113, 114) + dot(i, vec2(1, 113)), 6.2831853)) * 43758.5453)) * vec2(1.0 - p.y, p.y),
    vec2(1.0 - p.x, p.x)
  );
}

float hill(vec2 p, int iter) {
  float a = 0.0;
  float b = 0.52;
  for (int i = 0; i < iter; i++) {
    a += b * n2d(p);
    b *= 0.52;
    p *= 2.0;
  }
  return (a - 0.52) * 200.0;
}

const mat2 m2 = mat2(
   0.8, -0.6,
   0.6,  0.8
);
float mountain(vec2 p, int iter) {
  float a = 0.0;
  float b = 1.0;
  float d = 0.0;
  p.y += 200.0;
  for (int i = 0; i < iter; i++) {
    vec2 f2 = fract(p);
    float f = length(f2 * (1.0 - f2));
    d += f * f * (3.0 - 2.0 * f);
    a += b * n2d(p) / (1.5 + d);
    b *= 0.5;
    p = m2 * p * 2.05;
  }
  return a * 1800.0;
}

float ground(vec2 pos, int iter) {
  float x = pos.x + sin(pos.y * 0.001) * 1000.0;
  float a = 0.0;
  if (x > 0.0) a = mountain(pos * 0.0007, iter) * pow(smoothstep(0.0, 5000.0, x), 3.0);
  float h = smoothstep(5000.0, 0.0, x);
  if (h > 0.0) a += hill(pos * 0.005, iter) * h + min((x + 1000.0) * 0.001, 0.0) * 10.0;
  return a + x * 0.005;
}

vec3 calcNormal(vec3 pos, int iter, float f) {
  vec2 eps = vec2(f, 0.0);
  return normalize(
    vec3(
      ground(pos.xz - eps.xy, iter) - ground(pos.xz + eps.xy, iter),
      2.0 * eps.x,
      ground(pos.xz - eps.yx, iter) - ground(pos.xz + eps.yx, iter)
    )
  );
}

float softShadow(vec3 ro, float start, float limit, float shadowStep, int iter) {
  float res = 1.0;
  for (float t = start; t < limit; t *= shadowStep) {
    vec3 pos = ro + t * LIGHT;
    float h = pos.y - ground(pos.xz, iter);
    res = min(res, 16.0 * h / t);
    if (res < 0.001 || pos.y > SURFACE_MAX || pos.y < 0.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 rotateY(vec3 p, float a) {
  float sa = sin(a);
  float ca = cos(a);
  return vec3(p.x * ca + p.z * sa, p.y, p.z * ca - p.x * sa);
  //return p * mat3(ca,.0,sa,.0,1.,.0,-sa,.0,ca);
}

vec3 getThickness(vec3 rd) {
  #define atmoDepth 8228.0
  #define earthRadius 6371000.0
  #define mieDepth 1800
  #define ozoneHeight 30000.0

  const vec4 cns = earthRadius + vec4(atmoDepth, mieDepth, ozoneHeight, ozoneHeight + atmoDepth);
  const float r2 = earthRadius * earthRadius;
  float b = -rd.y * earthRadius;
  vec4 z = sqrt(cns * cns + (b * b - r2));
  return vec3(b + z.xy, z.w - z.z);
}

vec4 getSky(vec3 rd, float addDepth) {
  #define rayleighCoefficient vec3(5.6e-6, 1.25e-5, 2.9e-5)
  #define mieCoefficient 16e-6
  #define ozoneCoefficient (vec3(3.426, 8.298, 0.356) * 6e-7)

  const vec3 addCol = vec3(1);
  const mat3 coeffs = mat3(rayleighCoefficient, vec3(mieCoefficient), ozoneCoefficient) / 0.693147;
  vec3 thickness = getThickness(rd) + addDepth * addCol;
  float rdl = max(dot(rd, LIGHT), 0.0);

  vec3 rayleighScatter = thickness.x * (0.4 * rdl * rdl + 1.12) * rayleighCoefficient;
  float g = 0.8 - LIGHT.y * 0.15 - mieCoefficient * 1500.0;
  float g2 = g * g;
  float a = inversesqrt(g2 - (2.0 * g * rdl - 1.0));
  float phaseMie = (0.4 + LIGHT.y * 0.1 + mieCoefficient * 7000.0) * (1.0 - g2) * a * a * a;
  float mieScatter = thickness.y * phaseMie * mieCoefficient;

  vec3 sunCoeff = coeffs * (getThickness(LIGHT) + addDepth * addCol);
  vec3 viewCoeff = coeffs * thickness;
  vec3 absorption = (exp2(-viewCoeff) - exp2(-sunCoeff)) / ((sunCoeff - viewCoeff) * 0.693147);

  return vec4(
    clamp(SUN_COLOR * (rayleighScatter + mieScatter) * absorption * (0.6 + LIGHT.y * 0.3), 0.0, 1.0),
    sunCoeff
  );
}

vec3 getLgtDir(float toD) {
  float xk = pow(toD, 1.5);
  toD = xk / (xk + pow(1.0 - toD, 1.5));
  toD = -toD * 6.283853 - 1.5708 + 0.1;
  return normalize(vec3(sin(toD) * 0.4 + 0.4, sin(toD) + 0.69, cos(toD)));
}

vec4 cloudMap(vec3 p, int iter) {
  p.y -= CLOUD_HEIGHT;
  //p.x -= 5000.;
  float time = (iTime - 200.0) * 1.5;
  p.xz += 70.0 * time * WIND;
  p *= vec3(0.00333, 0.005, 0.00333);
  float att = clamp(0.25 + CLOUD_HEIGHT / 800.0 - abs(p.y) * 0.25, 0.0, 1.0);
  vec3 drv = vec3(0);

  float z = 0.5;
  float trk = 0.9;
  float dspAmp = 0.2 * 0.9;

  float off = n2d(p.xz) - 0.4 + CLOUDS;
  float ofst = 12.1 - time * 0.1;
  float rz = n3d(p * 0.1);
  //float rz = n3d(p*0.8); rz*=rz*rz;

  const mat3 m3x =
    mat3(
       0.33338,  0.56034, -0.71817,
      -0.87887,  0.32651, -0.15323,
       0.15162,  0.69596,  0.61339
    ) *
    2.01;
  p *= 0.9;
  for (int i = 0; i < iter; i++) {
    p += sin(p.yzx * trk - trk * 2.0) * dspAmp;

    vec3 c = cos(p);
    vec3 s = sin(p);
    vec3 cs = cos(p.yzx + s.xyz + ofst);
    vec3 ss = sin(p.yzx + s.xyz + ofst);
    vec3 s2 = sin(p + s.zxy + ofst);
    vec3 cdrv = (c * (cs - s * ss) - s * ss.yzx - s.zxy * s2) * z;

    rz += (dot(s, cs) + off) * z * (i == 0 ? 0.2 : 1.0);
    drv += cdrv;

    p += cdrv * 0.05;
    p.xz += time * 0.15;

    dspAmp *= 0.7;
    z *= 0.57;
    trk *= 2.1;
    p *= m3x;
  }

  return vec4(rz * att, drv);
}

vec4 getClouds(vec3 ro, vec3 rd, int quality, int subIter, float far, vec3 skyCol, float sun) {
  vec4 rez = vec4(0);
  float t = 0.1;
  float st = 5000.0 / float(quality);
  float ct = st * 0.04;
  float rdl = length(rd.xz);
  float brt = smoothstep(0.1, 0.03, BRIGHT);
  for (int i = 0; i < quality && t < far; i++) {
    vec3 pos = ro + t * rd;
    float fxz = t * rdl;
    if (fxz > 10000.0) pos.y += (fxz - 10000.0) / 10000.0 * 500.0;
    if (rd.y > 0.0 && pos.y > CLOUD_MAX) break;

    int iter = ITER(t) - subIter;
    vec4 cld = cloudMap(pos, iter);
    vec4 col = vec4(0);
    if (cld.x > 0.5) {
      float den = clamp(cld.x, 0.0, 1.0);
      float dif =
        clamp((cld.x - cloudMap(pos + LIGHT * 80.0, iter).x) * 0.4 + 0.2, 0.11, 2.0) * 2.5 +
        clamp((cld.x - cloudMap(pos + LIGHT * 150.0, iter).x) * 0.2 - 0.03, -0.02, 1.0) * 4.0;
      float nl = max(dot(cld.yzw, -LIGHT), -1.2);
      col = vec4(BASE_COLOR + ATOM_COLOR * (nl * 0.25 + 0.7) * dif * 0.2, 0.1) * pow(den * 1.02, 8.0);
      col.rgb += col.a * clamp((nl * 0.8 + 0.1) * dif, 0.0, 1.0) * HLIT_COLOR;
      #if QUALITY == 3
      col.rgb *= clamp(
        softShadow(pos, 10.0, min(MAX_FAR, SURFACE_MAX / max(0.01, LIGHT.y)), SHADOW_STEP * 2.0, max(1, ITER(t) - 5)),
        0.0,
        1.0
      );
      #endif
    }
    col += vec4(skyCol, 1.0) * clamp(exp2(t * 0.0001 / (abs(rd.y) + 0.35) - 11.7), 0.0, 1.0);
    rez += (1.0 - rez.a) * col * ct;
    if (rez.a > CLOUD_THICK) break;

    float dn = clamp(cld.x + 1.9, 0.0, 3.0);
    t += clamp(7.0 - dn * dn * 0.85, 1.2, 7.0) * st;
  }
  rez *= 1.0 / CLOUD_THICK;
  if (sun > 0.0) {
    float a = clamp(1.0 - rez.a, 0.0, 1.0);
    a *= a;
    float s = clamp(pow(sun + (0.0003 + 0.0002 * brt), a * brt * 5000.0 + 5000.0), 0.0, 1.0);
    rez.rgb += a * (1.0 - a) * clamp(pow(sun, brt * 1000.0 + 1000.0), 0.0, 1.0) * ENV_COLOR;
    rez.rgb += (30.0 * brt * brt + 1.0) * a * s * ENV_COLOR;
  }
  return clamp(rez, 0.0, 1.0);
}

float seaSurf(vec2 pxz) {
  vec2 MV = iTime * WIND;
  float waterNoise = n2d(pxz * 0.1 + MV);
  waterNoise += n2d(pxz * 0.4 - MV) * 0.2;
  waterNoise += n2d(pxz * 1.6 + MV) * 0.03;
  waterNoise += n2d(pxz * 4.0 - MV) * 0.004;
  return waterNoise;
}

vec3 drawMountain(vec3 pos, vec3 rd, vec3 light, float resT, float sshLimit, float waterSsh) {
  if (light.y <= 0.0) return vec3(0);

  float f = n2d(0.005 * pos.xz);
  float h = smoothstep(700.0, 1500.0, pos.y + 500.0 * f);
  float sl = smoothstep(400.0, 600.0, pos.y + 100.0 * f);
  vec3 col = mix(vec3(0.18, 0.13, 0.11), vec3(0.09, 0.08, 0.07), sl) * 0.45; //vec3(0.18,0.13,0.11) vec3(0.07,0.08,0.11)
  vec3 nor = calcNormal(pos, ITER(resT), 0.0004 * resT * RES_FACTOR);
  float s;
  if (h > 0.0) {
    float e = smoothstep(1.0 - 0.5 * h, 1.0 - 0.1 * h, nor.y * (1.2 + clamp(pos.y - 1000.0, 0.0, 200.0) / 600.0));
    float o = 0.3 + 0.7 * smoothstep(0.0, 0.1, nor.x + h * h);
    s = smoothstep(0.1, 0.9, h * e * o);
  } else {
    s = 0.0;
  }
  float gs = n2d(pos.xz * 0.01);
  float bs = smoothstep(0.6, 0.9, nor.y) * smoothstep(1000.0, 500.0, pos.y + 200.0 * f);
  col = mix(col, vec3(0.06, 0.07 - 0.015 * smoothstep(400.0, 700.0, pos.y + gs * 300.0), 0.0), bs);
  col = mix(col, 0.21 * vec3(0.62, 0.65, 0.7), s);

  float dif = clamp(dot(nor, light), 0.0, 1.0);
  float sst = clamp(resT * 0.01, 0.1, 150.0);
  // float ssh = clamp(softShadow(pos, sst, sshLimit, SHADOW_STEP, max(1, ITER(sst) - 4)), 0.0, 1.0);
  float ssh = clamp(softShadow(pos, sst, sshLimit, SHADOW_STEP, ITER(sst) - 4 > 1 ? ITER(sst) - 4 : 1), 0.0, 1.0);
  if (ssh > 0.2) {
    float cloudFar = (pos.y + CLOUD_HEIGHT) / light.y;
    float sha = cloudMap(pos + light * cloudFar, ITER(sst) - 3).x * 0.5;
    ssh = min(ssh, 1.0 - sha);
  }
  dif *= min(waterSsh, ssh);

  float dom = clamp(0.5 + 0.5 * nor.y, 0.3, 1.0);
  vec3 lin = 0.2 * mix(0.8 * vec3(0.1, 0.2, 0.1), vec3(0.7, 0.9, 1.5) * 3.0, dom);
  float bac = clamp(dot(normalize(vec3(-light.x, 0.1, -light.z)), nor), 0.0, 1.0);
  lin += 3.5 * (1.0 - BRIGHT * 0.1) * vec3(1.0, 0.9, 0.8) * dif * ENV_COLOR * (1.0 + s * 4.0);
  lin += 35.0 * (1.0 - BRIGHT * 0.2) * vec3(1.1, 1.0, 0.9) * bac * BASE_COLOR;

  vec3 res = col * lin;
  if (light.y > 0.0 && waterSsh > 1.0) {
    vec3 ref = reflect(rd, nor);
    float fre = 0.05 + 0.95 * pow(1.0 + clamp(dot(nor, rd), -1.0, 0.0), 5.0);
    float spc = clamp(dot(ref, light), 0.0, 1.0);
    res *= 1.0 + pow(spc, 25.0 - (1.0 - s) * 20.0) * vec3(2.0 + s * 15.0 + (1.0 - s) * 10.0) * ssh * fre;
    float ran = n2d(pos.xz * 0.1);
    float mxt = 5.0 + ran * 20.0;
    if (pos.y < mxt) {
      #if QUALITY == 3
      vec3 nor = calcNormal(pos, ITER(resT), 0.001 * resT * RES_FACTOR);
      vec3 ref = reflect(rd, nor);
      float fre = 0.02 + 0.98 * pow(1.0 + clamp(dot(nor, rd), -1.0, 0.0), 5.0);
      float spc = clamp(dot(ref, light), 0.0, 1.0);
      #endif
      float sc = 1.0 - clamp(pos.y, 0.0, mxt) / mxt;
      sc = sc * sc;
      res = res * (1.0 - sc * 0.5) + ENV_COLOR * pow(spc, 50.0) * ssh * 10.0 * sc * sqrt(fre);
    }
  }

  if (light.y < 0.1) res *= light.y * 10.0;
  return res;
}

float raymarch(vec3 ro, vec3 rd, float scale, out int type) {
  for (float t = 1.0; t < MAX_FAR; ) {
    vec3 pos = ro + t * rd;
    if (scale == 1.0 && pos.y < 0.0) {
      type = 0;
      return t;
    }
    if (rd.y > 0.0 && pos.y > SURFACE_MAX) break;

    float y = ground(pos.xz, ITER(t));
    type = 1;

    if (scale == 1.0 && y < SEA_MAX) {
      float sy = seaSurf(pos.xz);
      if (sy > y) {
        y = sy;
        type = 0;
      }
    }

    float h = pos.y - y;
    float d = t * MARCH_STEP * RES_FACTOR;
    if (h < d * MARCH_SURFACE) return t;
    t += max(d, h * MARCH_SURFACE * (7000.0 - clamp(pos.x, 1000.0, 4000.0)) / 6000.0) * scale;
  }
  return MAX_FAR; //未命中
}

vec3 drawSky(vec3 rd, out float sun) {
  sun = clamp(dot(LIGHT, rd), 0.0, 1.0);
  vec4 sky = getSky(rd, 0.0);
  //float t = smoothstep(.245, .285, abs(.515-TIME)); //76~80 23~27
  float brt = smoothstep(0.05, 0.2, BRIGHT) * 0.4 + 0.6;
  return sky.rgb * mix(sky.a * brt, 1.0, smoothstep(0.1, 0.2, BRIGHT));
}

vec3 waterNormal(vec2 pos, float f) {
  vec2 eps = vec2(f, 0.0);
  return normalize(
    vec3(seaSurf(pos - eps.xy) - seaSurf(pos + eps.xy), 2.0 * eps.x, seaSurf(pos - eps.yx) - seaSurf(pos + eps.yx))
  );
}

vec3 drawSea(vec3 pos, vec3 rd, float resT) {
  vec3 seaColor = vec3(0.25, 0.5, 0.75);
  vec3 normal = waterNormal(pos.xz, pow(resT * 0.05, 2.7) * 0.0005 * RES_FACTOR);

  //折射
  // vec3 ret = refract(rd, normal, 1.0f / 1.3333f);
  vec3 ret = refract(rd, normal, 1.0 / 1.3333);
  float rT = MARCH_STEP;
  vec3 pis;
  for (float a; rT < SEA_DEEP; rT += 0.01 + max(a * MARCH_SURFACE, (resT + rT) * MARCH_STEP * RES_FACTOR)) {
    pis = pos + rT * ret;
    a = pis.y - ground(pis.xz, ITER(resT + rT));
    if (a <= MARCH_STEP * RES_FACTOR * (resT + rT)) break;
  }
  // vec3 lightRet = -refract(-LIGHT, normal, 1.0f / 1.3333f);
  vec3 lightRet = -refract(-LIGHT, normal, 1.0 / 1.3333);
  float m = 1.0 - ret.y / lightRet.y;
  float k = log(0.94) * m;
  seaColor *= 0.01 / k * (exp(rT * k) - 1.0);
  if (rT < SEA_DEEP) {
    float sst = clamp(resT * 0.1, 0.1, 150.0);
    float ssh = clamp(
      softShadow(
        pos,
        sst,
        min(MAX_FAR, SURFACE_MAX / max(0.01, LIGHT.y)),
        SHADOW_STEP,
        ITER(sst) - 4 > 1
          ? ITER(sst) - 4
          : 1
      ),
      0.0,
      1.0
    );
    vec3 col = drawMountain(pis, ret, lightRet, resT + rT, rT, ssh);
    seaColor += col * pow(0.94, rT * m);
  }
  seaColor *= 0.98 - 0.98 * pow(1.0 - max(dot(LIGHT, normal), 0.0), 5.0);

  //反射
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, normal), 0.0), 5.0);
  vec3 ref = normalize(reflect(rd, normal));
  //ref.y = abs(ref.y);
  vec3 fCol;
  int refType;
  float sun = 0.0;
  float refResT = raymarch(pos, ref, MARCH_REF_SCALE, refType);
  if (refResT < MAX_FAR) {
    vec3 refPos = pos + refResT * ref;
    fCol = drawMountain(refPos, ref, LIGHT, refResT + resT, min(MAX_FAR, SURFACE_MAX / max(0.01, LIGHT.y)), 2.0);
  } else {
    fCol = drawSky(ref, sun);
  }

  vec4 cld = getClouds(pos, ref, CLOUD_QUALITY / 4, 5, refResT, fCol, sun);
  fCol = fCol * (1.0 - cld.w) + cld.xyz;
  return seaColor + fCol * fresnel;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
  vec3 ro, ta;
  float alpha = 1.0;
  if (iMouse.z + iMouse.w > 0.0) {
    vec2 lk = iMouse.xy / iResolution.xy;
    ro = vec3(0, 20.0 + lk.y * lk.y * 1000.0, (0.5 - lk.x) * 5000.0);
    ta = vec3(ro.x + lk.y * 5000.0, 20, 0);
    ro.y += max(0.0, ground(ro.xz, 6));
    ta.y += max(0.0, ground(ta.xz, 6));
    TIME = 0.37;
    CLOUDS = 0.0;
  } else {
    // int phase = int(iTime / 20.0) % 6;
    int phase = int(mod(iTime / 20.0, 6.0));
    float time = mod(iTime, 20.0) * 0.05;
    if (phase == 2) {
      //落日
      ro = vec3(
        1000.0 - time * 8000.0,
        max(1200.0 - sin(PI * min(0.5, time * 0.7)) * 1200.0, 20.0),
        -100.0 - time * 1000.0
      );
      ta = vec3(1000, 0, 50000.0 * (time + 0.2) + time * 500.0);
      TIME = 0.76 + 0.044 * time;
      CLOUDS = 0.2;
    } else if (phase == 3) {
      //缓慢倒退
      ro = vec3(-960.0 - time * 40.0, 40.0, 680.0 + time * 40.0);
      ta = vec3(50.0, 0, 200);
      TIME = 0.24 + 0.18 * time;
      ro.y = max(ro.y, ground(ro.xz, 2) + 20.0);
      CLOUDS = 0.0;
    } else if (phase == 4) {
      //高空日出
      ro = vec3(8000.0 - time * 2000.0, 1800.0 + 500.0 * time, -2000.0 + time * 6000.0);
      ta = vec3(ro.x - 10000.0, 1000.0 - 5000.0 * time, ro.z - 20000.0);
      ro.y = max(ro.y, 800.0 + ground(ro.xz, 1));
      TIME = 0.24 + time * 0.04;
      CLOUDS = 0.2 - time * 0.2;
      CLOUD_HEIGHT = 1600.0;
    } else if (phase == 1) {
      //低到高
      float deg = -time / 1.0;
      ro = vec3(-1030.0 - time * 200.0, 50.0 + time * time * 1000.0, -200);
      ta = vec3(cos(deg) * 3000.0 + ro.x, 50, sin(deg) * 3000.0);
      TIME = 0.43 + 0.05 * time;
      CLOUDS = 0.0;
    } else if (phase == 0) {
      //日出
      ro = vec3(-3000, 20.0 + time * 20.0, time * 500.0);
      ta = vec3(-1000, 1000, -5000.0 + time * 500.0); //200.*(25.-time*time)
      TIME = 0.23 + time * 0.08;
      CLOUDS = 0.4 - time * 0.5;
    } else {
      //环视
      float tt = time * 0.7 + 0.5;
      tt = tt * tt + 0.1;
      float deg = (time - 0.6) * 1.7;
      ro = vec3(-1300.0 + tt * 50.0, 10.0 + tt * 40.0, -1550.0);
      ta = vec3(ro.x + cos(deg) * 10000.0, 5.0 + tt * 40.0, ro.z + sin(deg) * 10000.0);
      TIME = 0.41 + time * 0.02;
      CLOUDS = 0.0;
    }
    if (iTime > 5.0) alpha = 1.0 - max(abs(time - 0.5) - 0.48, 0.0) * 50.0;
  }

  mat3 ca = setCamera(ro, ta);
  vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float pl = length(p) + 0.0001;
  vec3 rd = ca * normalize(vec3(p * tan(pl / 3.0) * 3.0 / pl, 1.732));
  //vec3 rd = ca * normalize(vec3(p*(tan(pl/1.732)*1.732/tan(pl/5.)/5.), 1.732));
  RES_FACTOR = 3840.0 / float(iResolution.x);
  LIGHT = getLgtDir(TIME);

  float sunUp = max(dot(LIGHT, vec3(0, 1, 0)), 0.0);
  float sunUp3 = clamp(sunUp * sunUp * sunUp * 6.0, 0.0, 1.0);
  float sunDw = pow(1.0 - sunUp, 6.0);
  float bsd = dot(LIGHT.xz, rd.xz);
  float sd = max(bsd, 0.0);
  float sd2 = max(bsd * 0.55 + 0.53, 0.0);

  vec3 topSky = clamp(getSky(vec3(0, 1, 0), 0.0).xyz, 0.0, 1.0);
  BASE_COLOR = mix(topSky, vec3(0.05, 0.066, 0.09), clamp(sunUp3, 0.0, 0.6)) * 0.2;

  float extraDepth = 14e4 * ((1.0 - bsd) * 0.2 + 0.9) * pow(1.0 - sunUp, 4.0);
  HLIT_COLOR =
    clamp(getSky(rotateY(normalize(LIGHT - vec3(0, 0.001, 0)), 0.15), extraDepth).xyz, 0.0, 1.0) *
    sd2 *
    mix(sunDw, sunDw * sunDw, sd) *
    8.0;

  vec3 bSkyCol = getSky(rd, extraDepth * 5.0 * (sunUp * 0.8 + 0.2)).rgb;
  ATOM_COLOR = mix(bSkyCol * (sunUp * 0.3 + 0.7), vec3(1.0, 0.8, 0.75) * dot(bSkyCol, vec3(0.38)), sunUp3);
  ENV_COLOR = ATOM_COLOR / ATOM_COLOR.r;
  BRIGHT = smoothstep(0.295, 0.075, abs(0.515 - TIME));

  float resT;
  float sun = 0.0;
  int type = -1;
  vec3 fCol;
  resT = raymarch(ro, rd, 1.0, type);
  vec3 pos = ro + rd * resT;

  if (resT < MAX_FAR) {
    if (type == 0) {
      fCol = drawSea(pos, rd, resT);
    } else {
      fCol = drawMountain(pos, rd, LIGHT, resT, min(MAX_FAR, SURFACE_MAX / max(0.01, LIGHT.y)), 2.0);
    }
  } else {
    fCol = drawSky(rd, sun);
  }

  vec4 cld = getClouds(ro, rd, CLOUD_QUALITY, 3, resT, fCol, sun);
  fCol = fCol * (1.0 - cld.w) + cld.xyz;

  fCol = pow(clamp(fCol * 1.1 - 0.02, 0.0, 1.0), vec3(0.4545));
  fCol = fCol * fCol * (3.0 - 2.0 * fCol);
  fragColor = vec4(fCol * alpha, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
