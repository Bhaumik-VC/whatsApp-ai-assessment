import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  logger.log(`WhatsApp AI Assessment Platform running on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during bootstrap', error);
  process.exit(1);
});
