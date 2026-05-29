#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

varying vec2 vUV;

void main() {
  vUV = aVertexPosition.xy * 0.5 + 0.5; // [-1,1] → [0,1]
  gl_Position = vec4(aVertexPosition, 1.0);
}
