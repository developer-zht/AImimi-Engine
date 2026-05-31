import { BASES } from '@/_config/basePaths'
import urlJoin from 'url-join'

const T = BASES.textures

// 纹理资源路径配置
export const TexturePaths = {
  // ========================================
  // Skybox
  // ========================================
  // ==================== SDR ====================
  SKY_09_CUBEMAP: urlJoin(T, 'environment/cubemap/sky_09_cubemap/'),
  SKY_18_CUBEMAP: urlJoin(T, 'environment/cubemap/sky_18_cubemap/'),
  SKY_SUNSET: urlJoin(T, 'environment/cubemap/sky_sunset/'),
  // ==================== HDR ====================
  // qwantani
  QWANTANI_AFTERNOON_PURESKY_2K_HDR: urlJoin(
    T,
    '/environment/equirectangular/qwantani_puresky/afternoon_puresky_2k.hdr'
  ),
  // citrus orchard
  CITRUS_ORCHARD_PURESKY_2K_HDR: urlJoin(
    T,
    'environment/equirectangular/citrus_orchard/puresky_2k.hdr'
  ),
  CITRUS_ORCHARD_ROAD_PURESKY_2K_HDR: urlJoin(
    T,
    'environment/equirectangular/citrus_orchard/road_puresky_2k.hdr'
  ),
  CITRUS_ORCHARD_INDUSTRIAL_SUNSET_PURESKY_2K_HDR: urlJoin(
    T,
    'environment/equirectangular/citrus_orchard/industrial_sunset_puresky_2k.hdr'
  ),
  // kloofendal_puresky
  KLOOFENDAL_06_PURESKY_2K_EXR: urlJoin(
    T,
    'environment/equirectangular/kloofendal_puresky/06_puresky_2k.exr'
  ),
  KLOOFENDAL_43D_CLEAR_PURESKY_2K_EXR: urlJoin(
    T,
    'environment/equirectangular/kloofendal_puresky/43d_clear_puresky_2k.exr'
  ),

  // ========================================
  // Water / Ocean
  // ========================================
  FOAM001_COLOR_1K_PNG: urlJoin(T, 'water/foam/Foam001_1K-PNG/Foam001_1K-PNG_Color.png')
}
