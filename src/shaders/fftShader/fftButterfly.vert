attribute vec3 aVertexPosition;
varying vec2 vUV;

void main() {
  // 全屏四边形，UV 坐标范围 [0, 1]
  vUV = aVertexPosition.xy * 0.5 + 0.5;
  gl_Position = vec4(aVertexPosition, 1.0);
}
