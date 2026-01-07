import { ConfigurationError } from './BaseError'

/**
 * 配置验证错误
 */
export class ConfigValidationError extends ConfigurationError {
  public readonly validationErrors: string[]

  constructor(configPath: string, validationErrors: string[]) {
    super(`Configuration validation failed: ${configPath}`, 'CONFIG_VALIDATION_ERROR', {
      configPath,
      context: { validationErrors }
    })

    this.validationErrors = validationErrors
  }

  override toUserMessage(): string {
    return `配置验证失败：${this.validationErrors.join(', ')}`
  }
}
