import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

function getDefaultEnvFilePaths() {
  return [
    resolve(process.cwd(), 'apps/api/.env'),
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env'),
  ]
}

export function loadApiEnvFile(envFilePath?: string) {
  const envFilePaths = envFilePath === undefined ? getDefaultEnvFilePaths() : [envFilePath]
  const matchingEnvFilePath = envFilePaths.find((path) => existsSync(path))

  if (matchingEnvFilePath === undefined) {
    return
  }

  loadEnvFile(matchingEnvFilePath)
}
