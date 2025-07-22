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
- **Monitoring**: health checks

### Frontend Dependencies
- **Framework**: React 19+ with TypeScript
- **Build Tool**: Vite 7+ for fast development and builds
- **Styling**: Tailwind CSS 4+ (no complex component library)
- **State Management**: React built-in useState/useReducer + Context API (no external libraries)
- **Data Fetching**: Native fetch with custom hooks (no TanStack Query)
- **Routing**: React Router v6 for client-side navigation
- **Icons**: Lucide React for consistent iconography
- **Animations**: CSS transitions and simple React state (no Framer Motion)
- **Date/Time**: date-fns for date manipulation and formatting
- **Notifications**: Simple custom toast component
- **Virtual Scrolling**: Custom implementation or react-window if needed
- **Charts**: Simple Chart.js integration for basic analytics

## Configuration

### Environment Variables Examples (can be modified or extended if needed)
```env
# Bot Configuration
BOT_NAME=silent-watcher
PHONE_NUMBER=+1234567890 # needed when using pairing code
USE_PAIRING_CODE=false
AUTO_RECONNECT=true

# Database
DB_PATH=./data/database/silent-watcher.db

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

## Frontend Dashboard Specification

### Live Dashboard Features
- **Real-time Message Feed**: Live updates using WebSocket/Server-Sent Events
- **Message Audit Trail**: Clear visual indicators for message states (new, edited, deleted)
- **Configurable Time Range**: View messages from last X days (user configurable)
- **Advanced Filtering**: Filter by chat, message type, date range, sender
- **Search & Export**: Full-text search with JSON/CSV export capabilities
- **Responsive Design**: Mobile-first approach with desktop optimization

### Message State Visualization
- **New Messages**: Clean display with timestamp and sender info
- **Edited Messages**:
  - Clear "EDITED" badge with edit timestamp
  - Expandable diff view showing original vs current content
  - Edit history timeline for multiple edits
- **Deleted Messages**:
  - "DELETED" badge with deletion timestamp
  - Preserved original content with strikethrough styling
  - Deletion reason if available from WhatsApp
- **Reactions**: Emoji reactions displayed inline with message
- **Replies**: Threaded view showing reply context

### UI/UX Design Principles

#### Visual Design
- **Dark/Light Theme**: System preference detection with manual toggle
- **Color Coding**: Consistent color scheme for different message states
  - New: Default theme colors
  - Edited: Amber/yellow accent with subtle background
  - Deleted: Red accent with muted background
  - System: Blue accent for group events
- **Typography**: Clear hierarchy using modern font stack
- **Spacing**: Generous whitespace for readability
- **Accessibility**: WCAG 2.1 AA compliance with proper contrast ratios

#### Interactive Elements
- **Smooth Animations**: CSS transitions and simple React state for state changes
- **Hover States**: Subtle feedback for interactive elements
- **Loading States**: Skeleton screens and progress indicators
- **Error Handling**: Graceful error messages with retry options
- **Keyboard Navigation**: Full keyboard accessibility support

#### Performance Optimization
- **Virtual Scrolling**: Custom implementation or react-window if needed for large datasets
- **Lazy Loading**: Progressive loading of media and older messages
- **Caching**: Simple in-memory caching with custom hooks
- **Debounced Search**: Optimized search with minimal API calls using custom debounce hook

### Dashboard Layout

#### Header Section
- **Logo & Title**: Silent Watcher branding
- **Connection Status**: Real-time WhatsApp connection indicator
- **Time Range Selector**: Dropdown for configurable day ranges (1, 7, 30, 90 days)
- **Search Bar**: Global search with advanced filters
- **Theme Toggle**: Dark/light mode switcher
- **User Menu**: Settings, logout, help

#### Sidebar Navigation
- **Chat List**: Hierarchical list of all monitored chats
  - Individual contacts with profile pictures
  - Group chats with member counts
  - Unread message indicators
  - Last message preview
- **Filter Panel**: Advanced filtering options
  - Message type filters (text, media, system)
  - Date range picker
  - Sender selection
  - Message state filters (all, edited, deleted)

#### Main Content Area
- **Message Timeline**: Chronological message display
  - Chat bubbles with sender avatars
  - Message state badges and timestamps
  - Media thumbnails with lightbox view
  - Expandable message details
- **Message Details Panel**: Slide-out panel for detailed view
  - Full message metadata
  - Edit/deletion history
  - Media information
  - Technical details (message ID, encryption info)

#### Footer Section
- **Statistics Bar**: Real-time stats (total messages, active chats, storage used)
- **Status Indicators**: Bot health, database status, last sync time

### API Endpoints Enhancement
```
# Message Management
GET /api/messages?chat=&days=&type=&state=&search=&limit=&offset=
GET /api/messages/:id/history
GET /api/messages/:id/media

# Chat Management
GET /api/chats
GET /api/chats/:id/messages
GET /api/chats/:id/participants

# Media & Files
GET /api/media/:id
GET /api/media/:id/thumbnail
POST /api/export (JSON/CSV export)

# Real-time Updates
GET /api/events (Server-Sent Events)
WS /api/websocket (WebSocket connection)

# Analytics & Stats
GET /api/stats/overview
GET /api/stats/chats
GET /api/stats/media
GET /api/health
```

### Security & Authentication
- **JWT-based Authentication**: Secure token-based auth system
- **Role-based Access**: Admin/viewer roles with different permissions
- **Session Management**: Automatic logout and session refresh
- **Rate Limiting**: API rate limiting with user feedback
- **HTTPS Enforcement**: Secure connections in production
- **CORS Configuration**: Proper cross-origin resource sharing setup

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
