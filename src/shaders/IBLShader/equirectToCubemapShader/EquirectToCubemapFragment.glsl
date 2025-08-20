#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uEquirectangularMap; // HDR/EXR输入图像

varying vec3 vWorldPosition;

const vec2 invAtan = vec2(0.1591, 0.3183); // 1/(2π), 1/π

/**
 * 采样 equirectangular 贴图
 * 理论：球坐标系（和传统的球坐标系的角度表示不一样）转换
 * 步骤：
 *  - 世界坐标(x,y,z) -> 球坐标(θ,φ)
 *    - θ(方位角，与x轴的夹角) = atan2(z, x) ∈ [-π,+π]
 *    - φ(仰角，与xz平面的夹角) = asin(y) ∈ [-π/2,+π/2]
 *  - 球坐标(θ,φ) -> 采样坐标系(u,v)
 *    - 球坐标系的 (θ,φ) 两个坐标能够确定 equirectangular texture 上的一个点
 *    - 采样坐标系的 (u,v) 两个坐标同样能确定 equirectangular texture 上的一个点
 *    - θ ∈ [-π,+π] -> / 2π -> [-1/2,+1/2] -> + 1/2  -> u ∈ [0,1]
 *    - φ ∈ [-π/2,+π/2] -> / π -> [-1/2,+1/2] -> + 1/2 -> v ∈ [0,1]
 */
vec2 sampleSphericalMap(vec3 worldPos) {
  vec3 vector = normalize(worldPos);
  vec2 uv = vec2(atan(vector.z, vector.x), asin(vector.y));
  uv *= invAtan;
  uv += 0.5;

  return uv;
}

void main() {
  vec2 uv = sampleSphericalMap(vWorldPosition);
  vec3 color = texture2D(uEquirectangularMap, uv).rgb;
  gl_FragColor = vec4(color, 1.0);
}
