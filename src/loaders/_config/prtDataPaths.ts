import { BASES } from '@/_config/basePaths'
import urlJoin from 'url-join'

const P = BASES.prtSHTxt

export const PRTDataPaths = {
  // ========================================
  // SH
  // ========================================
  // ==================== 2 Order Indoor ====================
  SH_ORDER2_INDOOR_LIGHT: urlJoin(P, 'Indoor/light.txt'),
  SH_ORDER2_INDOOR_MARY_SHADOWED: urlJoin(P, 'Indoor/transport_mary_shadowed.txt'),
  SH_ORDER2_INDOOR_MARY_UNSHADOWED: urlJoin(P, 'Indoor/transport_mary_unshadowed.txt'),
  SH_ORDER2_INDOOR_MARY_INTERREFLECTION: urlJoin(P, 'Indoor/transport_mary_interreflection.txt')
}
