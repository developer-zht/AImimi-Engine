import { Vec3 } from '@/math/types/math'

/**
 * 贴图字段 → 对应的颜色字段名 + 静态 fallback。
 * key 和 GLTFMeshData / OBJMeshData 的属性名完全一致。
 */
interface FallbackEntry {
  colorField: string | null
  fallback: Vec3
}

export const TEXTURE_FALLBACK_MAP: Record<string, FallbackEntry> = {
  diffuseImage: { colorField: 'diffuseColor', fallback: [1.0, 1.0, 1.0] },
  specularImage: { colorField: 'specularColor', fallback: [1.0, 1.0, 1.0] },
  normalImage: { colorField: null, fallback: [0.5, 0.5, 1.0] },
  metalnessImage: { colorField: null, fallback: [0, 0, 0] },
  roughnessImage: { colorField: null, fallback: [0.5, 0.5, 0.5] },
  aoImage: { colorField: null, fallback: [1.0, 1.0, 1.0] },
  emissiveImage: { colorField: 'emissiveColor', fallback: [0, 0, 0] },
  displacementImage: { colorField: null, fallback: [0, 0, 0] },
  alphaImage: { colorField: null, fallback: [1.0, 1.0, 1.0] }
}
