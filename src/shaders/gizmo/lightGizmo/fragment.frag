#ifdef GL_ES
precision highp float;
#endif

uniform vec3 uLightColor;

void main(void ) {
  gl_FragColor = vec4(clamp(uLightColor, 0.0, 1.0), 1.0);
}
