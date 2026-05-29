#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

void main() {
  // 不需要 MVP 变换，顶点已经是 NDC 坐标
  gl_Position = vec4(aVertexPosition, 1.0);
}
