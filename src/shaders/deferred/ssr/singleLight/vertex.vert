#ifdef GL_ES
precision highp float;
#endif

// 全屏 quad 只有 position（4 个顶点，2 个三角形，覆盖 NDC [-1,1]）
// 没有 aNormalPosition、aTextureCoord —— 后处理不需要模型几何信息
attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
// attribute vec2 aTextureCoord;

// uniform mat4 uModelMatrix;
// uniform mat4 uViewMatrix;
// uniform mat4 uProjectionMatrix;

// uniform mat4 uLightVP;

// vScreenUV: 屏幕空间 UV [0,1]×[0,1]
// 用途：在 fragment shader 中采样 GBuffer 纹理
//
// 计算方式：NDC [-1,1] → UV [0,1]
// position.xy = -1 → uv = 0
// position.xy =  1 → uv = 1
varying vec2 vScreenUV;

// varying mat4 vWorldToScreen;
// varying vec4 vWorldPos;

void main(void ) {
  // vec4 worldPos = uModelMatrix * vec4(aVertexPosition, 1.0);
  // vWorldPos = worldPos.xyzw / worldPos.w;

  // vWorldToScreen = uProjectionMatrix * uViewMatrix;

  // aVertexPosition.xy 范围是 [-1, 1]（FullScreenQuad 的 4 个角）
  // * 0.5 + 0.5 映射到 [0, 1]，作为采样坐标
  vScreenUV = aVertexPosition.xy * 0.5 + 0.5;

  // 直接输出 NDC 坐标，不需要任何 MVP 变换
  // 因为全屏 quad 本身就定义在 NDC 空间
  gl_Position = vec4(aVertexPosition, 1.0);
}
