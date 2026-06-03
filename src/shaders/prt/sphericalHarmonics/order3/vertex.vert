#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Transport SH Coeffs: 16 coeffs split into 4 vec4
attribute vec4 aTransportSH0; // coeffs 0,1,2,3
attribute vec4 aTransportSH1; // coeffs 4,5,6,7
attribute vec4 aTransportSH2; // coeffs 8,9,10,11
attribute vec4 aTransportSH3; // coeffs 12,13,14,15

// Light SH Coeffs: 16 coeffs per channel, 3 channels(R, G, B)
uniform mat4 uLightSH_R; // 16 coeffs
uniform mat4 uLightSH_G; // 16 coeffs
uniform mat4 uLightSH_B; // 16 coeffs

varying vec3 vColor;

void main() {
  // dot(lightSH, transportSH) per channel
  // mat3 的列是 vec3, mat3[0]=col0, mat3[1]=col1, mat3[2]=col2
  // uLightSH_R 的 9 个元素按列主序排列:
  //   col0 = coeffs 0,1,2
  //   col1 = coeffs 3,4,5
  //   col2 = coeffs 6,7,8

  float r =
    dot(uLightSH_R[0], aTransportSH0) +
    dot(uLightSH_R[1], aTransportSH1) +
    dot(uLightSH_R[2], aTransportSH2) +
    dot(uLightSH_R[3], aTransportSH3);
  float g =
    dot(uLightSH_G[0], aTransportSH0) +
    dot(uLightSH_G[1], aTransportSH1) +
    dot(uLightSH_G[2], aTransportSH2) +
    dot(uLightSH_G[3], aTransportSH3);
  float b =
    dot(uLightSH_B[0], aTransportSH0) +
    dot(uLightSH_B[1], aTransportSH1) +
    dot(uLightSH_B[2], aTransportSH2) +
    dot(uLightSH_B[3], aTransportSH3);

  vColor = max(vec3(r, g, b), vec3(0.0));

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
}
