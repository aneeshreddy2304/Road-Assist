ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_request
  ON chat_messages (request_id, created_at ASC);
