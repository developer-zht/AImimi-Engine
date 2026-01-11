import { ConfigurationError } from './BaseError'

/**
 * 配置文件不存在
 */

export class ConfigNotFoundError extends ConfigurationError {
  constructor(configPath: string) {
    super(`Configuration file not found: ${configPath}`, 'CONFIG_NOT_FOUND', { configPath })
  }

  override toUserMessage(): string {
    return `配置文件不存在：${this.configPath}`
  }
}
