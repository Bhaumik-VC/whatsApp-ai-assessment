import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GrokOutput } from '../common/interfaces/grok.interfaces';
import { threadIdFromPhone } from '../common/phone.util';
import { Conversation, Message } from '@prisma/client';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Atomically find-or-create a conversation for this phone number.
  // Uses Prisma's native upsert — safe under concurrent requests.
  async upsertConversation(phone: string): Promise<Conversation> {
    try {
      return await this.prisma.conversation.upsert({
        where: { phone },
        update: {},
        create: { phone, threadId: threadIdFromPhone(phone) },
      });
    } catch (error) {
      this.logger.error(`upsertConversation failed for ${phone}`, error);
      throw error;
    }
  }

  // Returns null if the conversation doesn't exist
  async findConversationById(id: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  async saveUserMessage(conversationId: string, text: string): Promise<Message> {
    return this.prisma.message.create({
      data: { conversationId, sender: 'user', message: text },
    });
  }

  // Saves the AI reply along with its classification and sentiment
  async saveAiMessage(conversationId: string, grokOutput: GrokOutput): Promise<Message> {
    return this.prisma.message.create({
      data: {
        conversationId,
        sender: 'ai',
        message: grokOutput.reply,
        aiOutput: {
          classification: grokOutput.classification,
          sentiment: grokOutput.sentiment,
          raw: grokOutput.raw,
        },
      },
    });
  }

  async saveOutboundMessage(conversationId: string, text: string): Promise<Message> {
    return this.prisma.message.create({
      data: { conversationId, sender: 'outbound', message: text },
    });
  }

  async getAllConversations(): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
