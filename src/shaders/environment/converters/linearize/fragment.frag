#ifdef GL_ES
precision highp float;
#endif

uniform samplerCube uSrcCubemap;
uniform int uIsSRGB;

varying vec3 vWorldPosition;

void main() {
  vec3 color = textureCube(uSrcCubemap, normalize(vWorldPosition)).rgb;

  if (uIsSRGB == 1) {
    color = pow(color, vec3(2.2));
  }

  gl_FragColor = vec4(color, 1.0);
}
