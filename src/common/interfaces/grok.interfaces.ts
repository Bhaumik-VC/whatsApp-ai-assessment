// What we get back from Grok and store in the database
export interface GrokOutput {
  reply: string;
  classification: 'query' | 'complaint' | 'feedback' | 'greeting' | 'other';
  sentiment: 'positive' | 'neutral' | 'negative';
  raw: string; // original text from Grok before parsing
}
