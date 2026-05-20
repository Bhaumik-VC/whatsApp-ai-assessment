import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueProcessor } from './queue.processor';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../ai/ai.module';
import { ApiModule } from '../api/api.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'message-queue' }),
    forwardRef(() => WhatsAppModule),
    AiModule,
    ApiModule, // provides ConversationService
  ],
  providers: [QueueProcessor],
})
export class QueueModule {}
