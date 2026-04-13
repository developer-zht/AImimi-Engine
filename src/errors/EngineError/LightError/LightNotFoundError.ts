import { LightError } from './BaseError'

export class LightNotFoundError extends LightError {
  constructor(lightId: string) {
    super(`Light "${lightId}" not found or is not a shadow caster`, 'LIGHT_NOT_FOUND', {
      context: { lightId },
      recoverable: false
    })
  }
}
