#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;
attribute vec4 aTangent;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

uniform mat4 uLightVP;

varying highp vec3 vWorldPos;
varying highp vec3 vNormalWorld;
varying highp vec2 vTexCoord;
varying highp vec4 vTangent;

// Shadow map related variables
varying highp vec4 vPositionFromLight;

void main() {
  vec4 posWorld = uModelMatrix * vec4(aVertexPosition, 1.0);
  // 如果 model matrix 的最后一行不是 (0, 0, 0, 1)（比如含有投影或仿射变换），w ≠ 1，就必须除以 w 才能得到正确的 3D 坐标。这里是一种防御性写法——确保即使 model matrix 不寻常也不会出错
  vWorldPos = (posWorld.xyzw / posWorld.w).xyz;
  // vNormal = (uModelMatrix * vec4(aNormalPosition, 0.0)).xyz;
  vNormalWorld = uNormalMatrix * aNormalPosition, 0.0;
  vTexCoord = aTextureCoord;
  vTangent = aTangent;

  vPositionFromLight = uLightVP * uModelMatrix * vec4(aVertexPosition, 1.0);

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
}
