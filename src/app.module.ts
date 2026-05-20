import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { QueueModule } from './queue/queue.module';
import { ApiModule } from './api/api.module';
import { HttpLoggerMiddleware } from './common/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Connect BullMQ to Redis — reads REDIS_HOST and REDIS_PORT from .env
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'redis'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    // Bull Board UI — available at http://localhost:3000/queues
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'message-queue',
      adapter: BullAdapter,
    }),

    PrismaModule,
    AiModule,
    WhatsAppModule,
    QueueModule,
    ApiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
