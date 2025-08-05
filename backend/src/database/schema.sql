-- Silent Watcher Database Schema
-- SQLite database for WhatsApp message monitoring and audit trails

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Messages table - Primary message storage
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'poll', 'reaction', 'system')),
    timestamp INTEGER NOT NULL,
    is_from_me BOOLEAN NOT NULL DEFAULT 0,
    quoted_message_id TEXT,
    original_message_id TEXT,
    media_path TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document', 'sticker')),
    media_mime_type TEXT,
    media_size INTEGER,
    is_forwarded BOOLEAN NOT NULL DEFAULT 0,
    forwarded_from TEXT,
    is_ephemeral BOOLEAN NOT NULL DEFAULT 0,
    ephemeral_duration INTEGER,
    is_view_once BOOLEAN NOT NULL DEFAULT 0,
    is_edited BOOLEAN NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    reactions TEXT DEFAULT '[]', -- JSON array of reactions
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (quoted_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    FOREIGN KEY (original_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Message events table - Audit trail for message changes
CREATE TABLE IF NOT EXISTS message_events (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'edited', 'deleted', 'reaction_added', 'reaction_removed')),
    old_content TEXT,
    new_content TEXT,
    timestamp INTEGER NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON object for additional data
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Chats table - Chat metadata and participant info
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_group BOOLEAN NOT NULL DEFAULT 0,
    participant_count INTEGER,
    description TEXT,
    profile_picture TEXT,
    last_message_id TEXT,
    last_message_time INTEGER,
    is_archived BOOLEAN NOT NULL DEFAULT 0,
    is_muted BOOLEAN NOT NULL DEFAULT 0,
    mute_until INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Media table - Media file metadata and paths
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    duration INTEGER,
    thumbnail_path TEXT,
    is_compressed BOOLEAN NOT NULL DEFAULT 0,
    original_size INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Contacts table - Contact information and profile updates
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    push_name TEXT,
    phone_number TEXT,
    profile_picture TEXT,
    status TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT 0,
    is_business BOOLEAN NOT NULL DEFAULT 0,
    business_name TEXT,
    last_seen INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Groups table - Group-specific data and member management
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    profile_picture TEXT,
    owner_id TEXT NOT NULL,
    admin_ids TEXT DEFAULT '[]', -- JSON array of admin IDs
    participant_ids TEXT DEFAULT '[]', -- JSON array of participant IDs
    settings TEXT DEFAULT '{}', -- JSON object for group settings
    invite_code TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (owner_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (id) REFERENCES chats(id) ON DELETE CASCADE
);

-- System events table - Bot status, connection events, errors
CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN ('bot_started', 'bot_stopped', 'connection_opened', 'connection_closed', 'qr_code_generated', 'authentication_success', 'authentication_failure', 'error', 'warning', 'info')),
    description TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON object for additional data
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_message_events_message_id ON message_events(message_id);
CREATE INDEX IF NOT EXISTS idx_message_events_event_type ON message_events(event_type);
CREATE INDEX IF NOT EXISTS idx_message_events_timestamp ON message_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_chats_is_group ON chats(is_group);
CREATE INDEX IF NOT EXISTS idx_chats_last_message_time ON chats(last_message_time);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);

CREATE INDEX IF NOT EXISTS idx_media_message_id ON media(message_id);
CREATE INDEX IF NOT EXISTS idx_media_mime_type ON media(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at);

CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_updated_at ON groups(updated_at);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp);

-- Full-text search for messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    id UNINDEXED,
    content,
    sender_id UNINDEXED,
    chat_id UNINDEXED,
    content='messages',
    content_rowid='rowid'
);

-- Triggers to keep FTS table in sync
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, id, content, sender_id, chat_id) 
    VALUES (new.rowid, new.id, new.content, new.sender_id, new.chat_id);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, content, sender_id, chat_id) 
    VALUES ('delete', old.rowid, old.id, old.content, old.sender_id, old.chat_id);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, content, sender_id, chat_id) 
    VALUES ('delete', old.rowid, old.id, old.content, old.sender_id, old.chat_id);
    INSERT INTO messages_fts(rowid, id, content, sender_id, chat_id) 
    VALUES (new.rowid, new.id, new.content, new.sender_id, new.chat_id);
END;

-- Trigger to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_messages_updated_at 
    AFTER UPDATE ON messages
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE messages SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_chats_updated_at 
    AFTER UPDATE ON chats
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE chats SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_contacts_updated_at 
    AFTER UPDATE ON contacts
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE contacts SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_groups_updated_at 
    AFTER UPDATE ON groups
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE groups SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
