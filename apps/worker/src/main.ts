import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule)
  app.enableShutdownHooks()
  const logger = new Logger('Worker')
  logger.log('Worker is ready')
}

bootstrap()
