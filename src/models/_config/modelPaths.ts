import { BASES } from '@/_config/basePaths'
import urlJoin from 'url-join'

const M = BASES.models

export const ModelPaths = {
  // ==================== HW1 ====================
  HW1_MARY: urlJoin(M, 'hw1/mary/'),
  HW1_FLOOR: urlJoin(M, 'hw1/floor/'),

  // ==================== HW2 ====================
  HW2_MARY: urlJoin(M, 'hw2/mary/'),
  HW2_BUNNY: urlJoin(M, 'hw2/bunny/'),

  // ==================== HW3 ====================
  HW3_CAVE: urlJoin(M, 'hw3/cave/'),
  HW3_CUBE: urlJoin(M, 'hw3/cube/'),

  // ==================== HW4 ====================
  HW4_BALL: urlJoin(M, 'hw4/ball/'),
  HW4_SPHERE: urlJoin(M, 'hw4/sphere/')
}
