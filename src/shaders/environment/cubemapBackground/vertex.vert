#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix; // 完整 view matrix，保留平移
uniform mat4 uProjectionMatrix;

varying vec3 vTexCoord;

void main() {
  vTexCoord = aVertexPosition;

  // 使用完整的 view matrix（保留平移），这样相机移动/缩放会影响 cubemap
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
}
