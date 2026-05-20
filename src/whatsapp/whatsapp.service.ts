import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcodeTerminal from 'qrcode-terminal';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { phoneFromJid } from '../common/phone.util';
import { IncomingMessageJob } from '../common/interfaces/queue.interfaces';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private socket: WASocket | null = null;
  private connected = false;

  constructor(
    @InjectQueue('message-queue')
    private readonly messageQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      // Saves session to auth_info — no QR re-scan needed after first login
      const { state, saveCreds } = await useMultiFileAuthState('auth_info');
      const { version } = await fetchLatestBaileysVersion();

      // Suppress all Baileys internal logs — only forward warns/errors to NestJS Logger
      const noop = () => {};
      const baileysLogger = {
        level: 'silent', trace: noop, debug: noop, info: noop,
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
        fatal: (msg: string) => this.logger.error(msg),
        child: () => ({ level: 'silent', trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child: () => ({} as any) }),
      } as any;

      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, { level: 'silent' } as any),
        },
        printQRInTerminal: false,
        logger: baileysLogger,
      });

      // Save session credentials whenever they change (e.g. after QR scan)
      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.logger.log('Scan this QR code to connect WhatsApp:');
          qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
          this.connected = false;
          const boom = lastDisconnect?.error as Boom | undefined;
          const statusCode = boom?.output?.statusCode;
          // loggedOut means the user removed the device — reconnecting would just loop QRs
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
          if (shouldReconnect) {
            await this.connect();
          } else {
            this.logger.error('Logged out. Delete auth_info folder and restart.');
          }
        }

        if (connection === 'open') {
          this.connected = true;
          this.logger.log('WhatsApp connected');
        }
      });

      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return; // 'notify' = new message; other types are history syncs
        for (const msg of messages) {
          await this.handleIncomingMessage(msg);
        }
      });
    } catch (error) {
      this.logger.error('Failed to connect to WhatsApp', error);
      throw error;
    }
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
    try {
      if (msg.key.fromMe) return; // skip our own messages
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) return; // skip group chats

      // Baileys stores text in different fields depending on message type
      const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? null;
      if (!text?.trim()) return;

      const job: IncomingMessageJob = { phone: phoneFromJid(jid), text: text.trim() };

      await this.messageQueue.add('process-incoming', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued incoming message from ${job.phone}`);
    } catch (error) {
      this.logger.error('Failed to handle incoming message', error);
    }
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('WhatsApp is not connected. Scan the QR code shown in the logs first.');
    }

    try {
      const jid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text });
      this.logger.log(`Message sent to ${phone}`);
    } catch (error) {
      this.logger.error(`Failed to send message to ${phone}`, error);
      throw error;
    }
  }
}
