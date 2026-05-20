import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WhatsAppService } from './whatsapp.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'message-queue' }),
    forwardRef(() => QueueModule),
  ],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
