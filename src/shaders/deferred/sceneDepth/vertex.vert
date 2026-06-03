#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

varying vec2 vTextureCoord;

void main() {
  // FullScreenQuad 顶点范围 [-1, 1]，映射到 UV [0, 1]
  vTextureCoord = aVertexPosition.xy * 0.5 + 0.5;

  gl_Position = vec4(aVertexPosition, 1.0);
}
