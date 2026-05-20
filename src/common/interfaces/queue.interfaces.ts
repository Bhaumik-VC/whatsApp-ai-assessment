// Job pushed to the queue when a WhatsApp message arrives
export interface IncomingMessageJob {
  phone: string;
  text: string;
}

// Job pushed to the queue when the API sends a message
export interface OutgoingMessageJob {
  phone: string;
  message: string;
  conversationId: string;
}
