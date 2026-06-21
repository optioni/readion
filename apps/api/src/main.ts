import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { bootstrapApp } from './bootstrap'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await bootstrapApp(app)
  const port = process.env.PORT ?? 3001
  await app.listen(port)
}

bootstrap()
