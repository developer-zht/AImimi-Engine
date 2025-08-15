attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Debug Code
uniform float uTime;

// 位移/法向纹理贴图
uniform sampler2D uDisplacementMap; // FFT 生成的位移贴图
uniform sampler2D uNormalMap; // FFT 生成的法线贴图（或梯度）

// 传入 Fragment 中的 Varying
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam; // 泡沫因子

void main() {
  vTexCoord = aTextureCoord;

  // 从纹理读取数据
  vec4 displacement = texture2D(uDisplacementMap, aTextureCoord);
  vec2 gradient = texture2D(uNormalMap, aTextureCoord).xy;

  // 应用位移
  vec3 displacedPos = aVertexPosition;
  displacedPos.xyz += displacement.xyz;

  // 世界坐标
  vec4 worldPos = uModelMatrix * vec4(displacedPos, 1.0);
  vWorldPosition = worldPos.xyz;

  /**
 * 计算法线
 * 如果模型矩阵 M 只包含旋转和平移（没有非均匀缩放、没有错切），就可以直接使用 uModelMatrix，因为旋转矩阵的逆就是转置，且它的转置 = 自身（正交矩阵）
 *  在大多数海面渲染中，网格是单位大小的平面，只做旋转和位置移动，所以直接用 mat3(uModelMatrix) 足够且更快。
 *  WebGL1.0 不支持 transpose 和 inverse，所以没办法在 Shader 中计算 transpose(inverse(uModelMatrix))
 */
  vNormal = normalize(mat3(uModelMatrix) * vec3(-gradient.x, 1.0, -gradient.y));

  // 传递泡沫因子（雅可比值）
  vFoam = displacement.w;

  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;

  /**
 * Debug Code
 * 简单的正弦波测试
 */
  // vec3 pos = aVertexPosition;
  // pos.y = sin(pos.x * 0.1 + uTime) * sin(pos.z * 0.1 + uTime) * 5.0;
  // gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);

}
