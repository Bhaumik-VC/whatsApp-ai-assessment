import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrokOutput } from '../common/interfaces/grok.interfaces';

// Internal types — only used inside this file
interface GrokApiResponse {
  choices: { message: { content: string } }[];
}

interface ParsedGrokJson {
  reply?: string;
  classification?: string;
  sentiment?: string;
}

@Injectable()
export class GrokService {
  private readonly logger = new Logger(GrokService.name);
  private readonly apiUrl = 'https://api.x.ai/v1/chat/completions';
  private readonly model = 'grok-beta';
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('GROK_API_KEY');
    if (!key) {
      throw new Error('GROK_API_KEY is not set. Add it to your .env file.');
    }
    this.apiKey = key;
  }

  async chat(userMessage: string): Promise<GrokOutput> {
    // Tell Grok to always return a fixed JSON so we can parse it reliably
    const systemPrompt = `You are an AI assistant for a WhatsApp assessment platform.
Analyse the user's message and respond ONLY with a valid JSON object — no markdown fences, no extra text.
The JSON must have exactly these three fields:
{
  "reply": "<your friendly response to the user>",
  "classification": "<one of: query | complaint | feedback | greeting | other>",
  "sentiment": "<one of: positive | neutral | negative>"
}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3, // lower = more consistent output
        }),
      });

      if (!response.ok) {
        throw new Error(`Grok API error ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as GrokApiResponse;
      const raw = data.choices?.[0]?.message?.content ?? '';

      return this.parseGrokResponse(raw);
    } catch (error) {
      this.logger.error('Grok API call failed', error);
      throw error;
    }
  }

  // Parses the JSON Grok returns. Falls back to raw text if parsing fails.
  private parseGrokResponse(raw: string): GrokOutput {
    try {
      // Strip markdown code fences in case Grok wraps the response in ```json ... ```
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(cleaned) as ParsedGrokJson;

      const validClassifications = ['query', 'complaint', 'feedback', 'greeting', 'other'] as const;
      const validSentiments = ['positive', 'neutral', 'negative'] as const;

      const classification = validClassifications.includes(parsed.classification as any)
        ? (parsed.classification as GrokOutput['classification'])
        : 'other';

      const sentiment = validSentiments.includes(parsed.sentiment as any)
        ? (parsed.sentiment as GrokOutput['sentiment'])
        : 'neutral';

      return {
        reply: typeof parsed.reply === 'string' ? parsed.reply : raw,
        classification,
        sentiment,
        raw,
      };
    } catch {
      this.logger.warn('Could not parse Grok JSON, using raw text as reply');
      return { reply: raw, classification: 'other', sentiment: 'neutral', raw };
    }
  }
}
