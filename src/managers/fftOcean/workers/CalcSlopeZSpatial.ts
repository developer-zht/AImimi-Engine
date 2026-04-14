import { SerializedSpectrum } from '@/types/worker'
import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { Complex } from '@/math/Complex'
import {
  deserializeArraysToSpectrum,
  serializeSpatialToArrays
} from '@/managers/fftOcean/utils/spectrumSerializer'

const fftProcessor = new FFTProcessor()

addEventListener('message', (event: MessageEvent<SerializedSpectrum>) => {
  const serializedSpectrum = event.data
  const { realArray, imagArray, dimension } = serializedSpectrum

  // 反序列化为 Complex 对象
  const slopeZSpectrum: Complex[][] = deserializeArraysToSpectrum(realArray, imagArray, dimension)

  const slopeZSpatial = fftProcessor.ifft2DInterface(slopeZSpectrum)

  const serializedSlopeZSpatial = serializeSpatialToArrays(slopeZSpatial)

  postMessage(serializedSlopeZSpatial)
})
