import { ExhaustiveMatchError } from '@/errors/LanguageError/ExhaustiveMatchError'

export function assertNever(value: never, message?: string) {
  throw new ExhaustiveMatchError(value, message)
}
