export interface SpectrumReport {
  totalEnergy: number
  maxEnergy: number

  radialBins: number[]
  directionalBins: number[]

  radialNormalized: number[]
  directionalNormalized: number[]
}
