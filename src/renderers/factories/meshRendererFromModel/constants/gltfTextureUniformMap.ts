/**
 * MeshStandardMaterial 贴图字段名 → shader uniform 名。
 * key 和 Three.js MeshStandardMaterial 的属性名完全一致。
 */
export const GLTF_TEXTURE_UNIFORM_MAP: Record<string, string> = {
  // SharedTextureData 的字段
  diffuseImage: 'uDiffuseMap',
  normalImage: 'uNormalMap',
  aoImage: 'uAOMap',
  emissiveImage: 'uEmissiveMap',
  displacementImage: 'uDisplacementMap',
  alphaImage: 'uAlphaMap',
  // GLTFMeshData 特有
  metalnessImage: 'uMetalnessMap',
  roughnessImage: 'uRoughnessMap'
}
