#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uGBufferDepth; // Level 0: GBuffer depth 纹理，存的是 gl_Position.w（线性深度，比如 5.2、7.0 这样的浮点值），数据格式 vec4(vec3(vDepth), 1.0) → R=G=B=depth
uniform sampler2D uPrevDepthMipMap; // Level 1+: 上一级 depth mipmap
uniform vec3 uPrevMipSize; // 上一级的宽高 (prevWidth, prevHeight, 0)
uniform int uCurLevel; // 当前的 mip level

varying vec2 vTextureCoord;

// 最终的输出
// Level 0 输出:               vec4(vec3(depth), 1.0)    → R=G=B=depth
// Level 1+ 输出:              vec4(vec3(minDepth), 1.0) → R=G=B=minDepth
void main() {
  if (uCurLevel == 0) {
    // Level 0: 直接拷贝 GBuffer 深度
    gl_FragColor = vec4(texture2D(uGBufferDepth, vTextureCoord).xyz, 1.0);
  } else {
    // Level 1+: 对上一级做 2×2 min-reduction

    // 上一级的宽高
    vec2 prevSize = uPrevMipSize.xy;
    // 上一级的单像素 uv 步长，用来计算 uPrevDepthMipMap （上一级 depth mipmap）的采样坐标 uv
    vec2 texelSize = 1.0 / prevSize;

    // 当前像素对应上一级的 2×2 左下角坐标
    vec2 baseCoord = floor(gl_FragCoord.xy) * 2.0;

    // 采样 2×2 邻域（+0.5 采样像素中心）
    float d0 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(0.5, 0.5)) * texelSize).r; // (x, y)
    float d1 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(1.5, 0.5)) * texelSize).r; // (x + 1, y)
    float d2 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(0.5, 1.5)) * texelSize).r; // (x, y + 1)
    float d3 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(1.5, 1.5)) * texelSize).r; // (x + 1, y + 1)

    float minDepth = min(min(d0, d1), min(d2, d3));

    // 处理奇数宽度：额外采样右边一列
    // 整数取模在 GLSL ES 1.00 中不可用，用 mod() 替代
    bool oddWidth = mod(prevSize.x, 2.0) > 0.5;
    bool oddHeight = mod(prevSize.y, 2.0) > 0.5;

    if (oddWidth) {
      float e0 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(2.5, 0.5)) * texelSize).r;
      float e1 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(2.5, 1.5)) * texelSize).r;
      minDepth = min(minDepth, min(e0, e1));

      if (oddHeight) {
        float corner = texture2D(uPrevDepthMipMap, (baseCoord + vec2(2.5, 2.5)) * texelSize).r;
        minDepth = min(minDepth, corner);
      }
    }

    if (oddHeight) {
      float e2 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(0.5, 2.5)) * texelSize).r;
      float e3 = texture2D(uPrevDepthMipMap, (baseCoord + vec2(1.5, 2.5)) * texelSize).r;
      minDepth = min(minDepth, min(e2, e3));
    }

    gl_FragColor = vec4(vec3(minDepth), 1.0);
  }
}
