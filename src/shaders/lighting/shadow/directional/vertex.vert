#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
// attribute vec2 aTextureCoord;

uniform mat4 uModelMatrix;
// uniform mat4 uViewMatrix;
// uniform mat4 uProjectionMatrix;
uniform mat4 uLightVP;

// varying vec3 vNormal;
// varying vec2 vTextureCoord;
// varying float vDepth;

void main(void ) {
  // vNormal = aNormalPosition;
  // vTextureCoord = aTextureCoord;

  // vDepth = gl_Position.z;

  gl_Position = uLightVP * uModelMatrix * vec4(aVertexPosition, 1.0);
}
