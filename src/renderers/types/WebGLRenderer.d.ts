import type { Light, UpdatedLightParamters } from '@/types/light'
import type { MeshRender } from '@/renderers/MeshRender'

interface LightObj {
  entity: Light
  meshRender: MeshRender
}

export interface UpdatedTimeParameter {
  uTime: number
}

export type UpdatedParamters = UpdatedLightParamters & UpdatedTimeParameter
