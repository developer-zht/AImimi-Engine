#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// 传入 Fragment 中的 Varying
varying vec3 vTexCoord;

void main() {
  vTexCoord = aVertexPosition;
  mat4 viewMatrix = mat4(mat3(uViewMatrix)); // 通过取4x4矩阵左上角的3x3矩阵来移除变换矩阵的位移部分
  vec4 pos = uProjectionMatrix * viewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
  // vec4 pos = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);

  // gl_Position = pos;
  gl_Position = pos.xyww;
}
