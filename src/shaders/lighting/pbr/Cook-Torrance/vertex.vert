#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTextureCoord;
varying vec3 vFragPos;
varying vec3 vNormal;

void main(void ) {
  vFragPos = (uModelMatrix * vec4(aVertexPosition, 1.0)).xyz;

  vNormal = (uModelMatrix * vec4(aNormalPosition, 0.0)).xyz;

  vTextureCoord = aTextureCoord;

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);

}
