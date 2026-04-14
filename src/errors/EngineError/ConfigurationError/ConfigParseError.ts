import { ConfigurationError } from './BaseError'

/**
 * 配置解析错误
 */
export class ConfigParseError extends ConfigurationError {
  constructor(configPath: string, cause: Error) {
    super(`Failed to parse configuration file: ${configPath}`, 'CONFIG_PARSE_ERROR', {
      configPath,
      cause
    })
  }

  override toUserMessage(): string {
    return `配置文件格式错误：${this.configPath}`
  }
}
