attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;
attribute vec4 aTangent;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vPosWorld;
varying vec3 vNormalWorld;
varying vec2 vTextureCoord;
varying vec4 vTangentWorld;
varying float vDepth;

void main() {
  vec4 posWorld = uModelMatrix * vec4(aVertexPosition, 1.0);
  // 如果 model matrix 的最后一行不是 (0, 0, 0, 1)（比如含有投影或仿射变换），w ≠ 1，就必须除以 w 才能得到正确的 3D 坐标。这里是一种防御性写法——确保即使 model matrix 不寻常也不会出错
  vPosWorld = (posWorld / posWorld.w).xyz;

  // vec4 normalWorld = uModelMatrix * vec4(aNormalPosition, 0.0);
  vec3 normalWorld = uNormalMatrix * aNormalPosition;
  vNormalWorld = normalize(normalWorld);

  vTextureCoord = aTextureCoord;

  // mat4 × vec4 会把 w 当齐次坐标，但是 w 不应该被改变！
  // vTangentWorld = uModelMatrix * aTangent;
  vTangentWorld = vec4(mat3(uModelMatrix) * aTangent.xyz, aTangent.w);

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
  vDepth = gl_Position.w;
}
