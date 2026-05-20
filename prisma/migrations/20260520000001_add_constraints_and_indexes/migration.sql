-- Add unique constraint: one conversation per phone number
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_phone_key" UNIQUE ("phone");

-- Add unique constraint on thread_id
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_thread_id_key" UNIQUE ("thread_id");

-- Add index on conversation_id for faster message lookups
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- Update foreign key to cascade deletes (deleting a conversation removes all its messages)
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversation_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
