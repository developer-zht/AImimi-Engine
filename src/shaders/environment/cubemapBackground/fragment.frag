#ifdef GL_ES
precision highp float;
#endif

varying vec3 vTexCoord;

uniform samplerCube uSkyboxMap;

void main() {
  gl_FragColor = textureCube(uSkyboxMap, vTexCoord);
}
