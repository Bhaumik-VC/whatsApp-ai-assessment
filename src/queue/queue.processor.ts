import { Processor, Process } from '@nestjs/bull';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { ConversationService } from '../api/conversation.service';
import { GrokService } from '../ai/grok.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { IncomingMessageJob, OutgoingMessageJob } from '../common/interfaces/queue.interfaces';

@Processor('message-queue')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly grokService: GrokService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsAppService: WhatsAppService,
  ) {}

  // Incoming WhatsApp message → save to DB → ask Grok → save reply → send back
  @Process('process-incoming')
  async handleIncoming(job: Job<IncomingMessageJob>): Promise<void> {
    const { phone, text } = job.data;
    this.logger.log(`Processing incoming message from ${phone}`);

    try {
      const conversation = await this.conversationService.upsertConversation(phone);
      await this.conversationService.saveUserMessage(conversation.id, text);

      const grokOutput = await this.grokService.chat(text);
      await this.conversationService.saveAiMessage(conversation.id, grokOutput);

      await this.whatsAppService.sendMessage(phone, grokOutput.reply);
      this.logger.log(`Replied to ${phone}`);
    } catch (error) {
      this.logger.error(`Failed to process incoming message from ${phone}`, error);
      throw error; // let BullMQ retry
    }
  }

  // Outgoing API message → save to DB first → then deliver via WhatsApp (best-effort)
  @Process('process-outgoing')
  async handleOutgoing(job: Job<OutgoingMessageJob>): Promise<void> {
    const { phone, message, conversationId } = job.data;
    this.logger.log(`Processing outgoing message to ${phone}`);

    // Always save to DB regardless of WhatsApp connection status
    await this.conversationService.saveOutboundMessage(conversationId, message);

    try {
      await this.whatsAppService.sendMessage(phone, message);
      this.logger.log(`Delivered to ${phone}`);
    } catch (error) {
      this.logger.warn(`Saved to DB but WhatsApp delivery failed for ${phone}: ${(error as Error).message}`);
    }
  }
}
