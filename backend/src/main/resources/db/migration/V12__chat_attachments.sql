ALTER TABLE messages
    ADD COLUMN attachment_content_type VARCHAR(32),
    ADD COLUMN attachment_content BYTEA,
    ADD COLUMN attachment_storage_key VARCHAR(300),
    ADD COLUMN attachment_byte_size INTEGER;

CREATE UNIQUE INDEX uq_messages_attachment_storage_key
    ON messages(attachment_storage_key)
    WHERE attachment_storage_key IS NOT NULL;

