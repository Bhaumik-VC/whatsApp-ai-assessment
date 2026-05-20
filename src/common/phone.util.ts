// Extracts the phone number from a Baileys JID.
// e.g. "919999999999@s.whatsapp.net" → "919999999999"
export function phoneFromJid(jid: string): string {
  return jid.split('@')[0];
}

// Generates a deterministic threadId from a phone number.
// Used to group messages from the same contact into one thread.
export function threadIdFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `thread_${digits}`;
}
