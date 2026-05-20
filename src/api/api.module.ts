import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ApiController } from './api.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'message-queue' })],
  controllers: [ApiController],
  providers: [ConversationService],
  exports: [ConversationService], // exported so QueueModule can use it
})
export class ApiModule {}
