import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'
import { type ConfiguredMailService, MailService } from './mail.service'
import { mailTemplateRegistry } from './templates'
import {
  type CapturedMailMessage,
  createMailTransport,
  MAIL_CAPTURED_MESSAGES,
  MAIL_TRANSPORT,
  type MailTransport,
  type SmtpTransportConfig,
} from './transport'

function buildTransportConfig(config: ConfigService<EnvConfig>): SmtpTransportConfig {
  return {
    NODE_ENV: config.get('NODE_ENV') ?? 'development',
    SMTP_HOST: config.get('SMTP_HOST'),
    SMTP_PORT: config.get('SMTP_PORT'),
    SMTP_USERNAME: config.get('SMTP_USERNAME'),
    SMTP_PASSWORD: config.get('SMTP_PASSWORD'),
  }
}

@Module({
  providers: [
    {
      provide: MAIL_CAPTURED_MESSAGES,
      useValue: [] satisfies CapturedMailMessage[],
    },
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService, MAIL_CAPTURED_MESSAGES],
      useFactory: (
        config: ConfigService<EnvConfig>,
        capturedMessages: CapturedMailMessage[],
      ): MailTransport => createMailTransport(buildTransportConfig(config), capturedMessages),
    },
    {
      provide: MailService,
      inject: [ConfigService, MAIL_TRANSPORT],
      useFactory: (
        config: ConfigService<EnvConfig>,
        transport: MailTransport,
      ): ConfiguredMailService =>
        new MailService({
          mailFrom: config.get('MAIL_FROM') ?? '',
          registry: mailTemplateRegistry,
          transport,
        }),
    },
  ],
  exports: [MailService, MAIL_CAPTURED_MESSAGES],
})
export class MailModule {}
