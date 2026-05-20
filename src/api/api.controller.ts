import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Conversation, Message } from '@prisma/client';
import { ConversationService } from './conversation.service';
import { OutgoingMessageJob } from '../common/interfaces/queue.interfaces';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('api')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private readonly conversationService: ConversationService,
    @InjectQueue('message-queue') private readonly messageQueue: Queue,
  ) {}

  // Queue a message to be sent to a WhatsApp number.
  // Returns immediately — delivery happens asynchronously.
  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() body: SendMessageDto): Promise<{ status: string; conversationId: string }> {
    try {
      const { phone, message } = body;
      const conversation = await this.conversationService.upsertConversation(phone);

      const job: OutgoingMessageJob = { phone, message, conversationId: conversation.id };
      await this.messageQueue.add('process-outgoing', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued outgoing message to ${phone}`);
      return { status: 'queued', conversationId: conversation.id };
    } catch (error) {
      this.logger.error('Failed to queue outgoing message', error);
      throw new BadRequestException('Failed to queue message');
    }
  }

  // Returns all conversations, newest first
  @Get('conversations')
  async getConversations(): Promise<Conversation[]> {
    try {
      return await this.conversationService.getAllConversations();
    } catch (error) {
      this.logger.error('Failed to fetch conversations', error);
      throw new BadRequestException('Failed to fetch conversations');
    }
  }

  // Returns all messages in a conversation, oldest first
  @Get('messages/:conversationId')
  async getMessages(@Param('conversationId') conversationId: string): Promise<Message[]> {
    try {
      const conversation = await this.conversationService.findConversationById(conversationId);
      if (!conversation) {
        throw new NotFoundException(`Conversation ${conversationId} not found`);
      }
      return await this.conversationService.getMessagesByConversation(conversationId);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch messages for ${conversationId}`, error);
      throw new BadRequestException('Failed to fetch messages');
    }
  }
}
