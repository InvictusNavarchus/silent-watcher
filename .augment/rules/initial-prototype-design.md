---
type: "manual"
---

# Silent Watcher - WhatsApp Bot Specification

## Overview
Create a robust, production-ready WhatsApp bot using Baileys that silently monitors and logs all WhatsApp activities with comprehensive audit trails and real-time web interface.

## Core Functionality

### Message Capture & Logging
- **All Message Types**: Text, images, videos, audio, documents, stickers, locations, contacts, polls, reactions
- **Message Events**: New messages, edits, deletions, reactions, forwards, replies
- **Media Handling**: Download and store all media files with metadata
- **Group Events**: Member additions/removals, admin changes, group settings updates
- **Status Updates**: Presence changes, typing indicators, read receipts
- **Special Messages**: Ephemeral messages, view-once media, business messages

### Data Organization
```
data/
├── media/
│   ├── images/
│   ├── videos/
│   ├── audio/
│   ├── documents/
│   └── stickers/
├── logs/
│   ├── app.log
│   ├── error.log
│   └── audit.log
├── database/
│   └── silent-watcher.db
└── auth/
    └── baileys_auth_info/
```

## Database Schema

### Core Tables
- `messages`: Primary message storage with full content
- `message_events`: Audit trail for edits/deletions/reactions
- `chats`: Chat metadata and participant info
- `media`: Media file metadata and paths
- `contacts`: Contact information and profile updates
- `groups`: Group-specific data and member management
- `system_events`: Bot status, connection events, errors

### Data Retention
- Configurable retention period (default: 90 days)
- Automatic cleanup of old media files
- Database vacuum and optimization scheduling

## Tech Stack

### Core Dependencies
- **Runtime**: Node.js 22+ (current LTS) with TypeScript 5.8+
- **Package Manager**: pnpm 10+
- **WhatsApp Client**: @whiskeysockets/baileys (v6.7.18)
- **Database**: better-sqlite3 3.9+
- **Logger**: winston 3.17+
- **Web Framework**: express 5+
- **Process Manager**: pm2 6+
- **Environment**: dotenv 16+

### Additional Dependencies
- **Validation**: zod for runtime type checking
- **Monitoring**: prometheus metrics, health checks

## Configuration

### Environment Variables
```env
# Bot Configuration
BOT_NAME=silent-watcher
PHONE_NUMBER=+1234567890
USE_PAIRING_CODE=true
AUTO_RECONNECT=true

# Database
DB_PATH=./data/database/silent-watcher.db
DB_BACKUP_INTERVAL=3600000
DATA_RETENTION_DAYS=90

# Web Interface
WEB_ENABLED=true
WEB_HOST=127.0.0.1
WEB_PORT=3000
WEB_AUTH_ENABLED=true
WEB_USERNAME=admin
WEB_PASSWORD=secure_password
WEB_DEFAULT_DAYS=7

# Media Storage
MEDIA_DOWNLOAD_ENABLED=true
MEDIA_MAX_SIZE_MB=100
MEDIA_COMPRESSION_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m
```

## Web Interface Features

### Dashboard
- Real-time message feed with filtering
- Chat statistics and analytics
- Media gallery with thumbnails
- Search functionality across all messages
- Export capabilities (JSON, CSV)

### Security
- Authentication with configurable credentials
- Rate limiting and request validation
- HTTPS support with SSL certificates
- CORS configuration for secure access

### API Endpoints
```
GET /api/messages?chat=&days=&type=
GET /api/chats
GET /api/media/:id
GET /api/stats
GET /api/health
```

## Error Handling & Resilience

### Connection Management
- Automatic reconnection with exponential backoff
- QR code regeneration handling
- Session persistence and recovery
- Network failure detection and recovery

### Data Integrity
- Database transaction management
- Atomic operations for message processing
- Backup and recovery procedures
- Data validation and sanitization

### Monitoring
- Health check endpoints
- Performance metrics collection
- Error alerting and notifications
- Resource usage monitoring

## Code Quality Standards

### Architecture
- **Modular Design**: Clear separation of concerns with focused modules
- **Simple Imports**: Direct ESM imports instead of dependency injection
- **Event-Driven**: Reactive architecture for message processing
- **Type Safety**: Comprehensive type definitions for all data structures

### Project Structure
```
src/
├── types/           # Type definitions and interfaces
├── database/        # Database connection and queries
├── services/        # Business logic (message, media, chat services)
├── handlers/        # Baileys event handlers
├── web/            # Express web interface
├── utils/          # Utility functions and helpers
├── config/         # Configuration management
└── main.ts         # Application entry point
```

### Module Responsibilities
- **handlers/**: Listen to Baileys events, minimal logic
- **services/**: Core business logic, data processing
- **database/**: All database operations and queries
- **web/**: HTTP routes and API endpoints
- **utils/**: Shared utilities (logger, file helpers, etc.)

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```


### Project Structure
```
src/
├── types/           # Type definitions
├── database/        # Database models and migrations
├── services/        # Business logic services
├── handlers/        # Message and event handlers
├── web/            # Web interface
├── utils/          # Utility functions
├── config/         # Configuration management
└── main.ts         # Application entry point
```

## Deployment & Operations

### PM2 Configuration
```json
{
  "name": "silent-watcher",
  "script": "dist/main.js",
  "instances": 1,
  "autorestart": true,
  "watch": false,
  "max_memory_restart": "1G",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Installation Notes
- Run `pnpm install` followed by `pnpm approve-builds` for better-sqlite3
- Configure environment variables before first run
- Ensure proper file permissions for data directory
- Set up log rotation for production environments

## Security Considerations
- Secure storage of authentication credentials
- Encrypted database option for sensitive data
- Access logging for web interface
- Regular security updates and dependency audits
