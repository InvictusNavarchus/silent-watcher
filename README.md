# Silent Watcher

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/InvictusNavarchus/silent-watcher/releases)
[![License](https://img.shields.io/badge/license-MPL--2.0-orange.svg)](https://www.mozilla.org/en-US/MPL/2.0/)
[![Development Status](https://img.shields.io/badge/status-heavily%20under%20development-red.svg)](https://github.com/InvictusNavarchus/silent-watcher)

A WhatsApp bot using Baileys that silently monitors and logs all WhatsApp activities. 

> ⚠️ **DEVELOPMENT STATUS**: This project is heavily under development. Many features described below are planned but not yet implemented or fully tested. Currently, only the basic backend monitoring functionality is working.

## Features

### ✅ Currently Working
- 🔍 **Basic Message Monitoring**: Captures messages and logs them to database and files
- 🗄️ **Database Storage**: SQLite database with message storage
- 📝 **File Logging**: Comprehensive logging to files in `data/logs/`
- 🚀 **Production Deployment**: PM2 process management
### 🚧 Planned/In Development
- 📊 **Real-time Dashboard**: React-based web interface *(not working)*
- 📱 **Media Handling**: Automatic download and storage of media files *(partially working)*
- 🔐 **Secure Access**: JWT-based authentication *(not implemented)*
-  **Docker Support**: Containerized deployment *(not working)*
- 🧪 **Complete Test Coverage**: Comprehensive test suite *(in progress)*

## Tech Stack

### Backend
- **Runtime**: Node.js 22+ with TypeScript 5.8+
- **WhatsApp Client**: @whiskeysockets/baileys
- **Database**: better-sqlite3
- **Web Framework**: Express 5+
- **Logger**: winston
- **Testing**: Jest with ts-jest

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: React built-in hooks + Context API
- **Testing**: React Testing Library

## Current Usage

**⚠️ Important**: Currently, the main working functionality is the backend monitoring service.

### Available Deployment Methods:

1. **Direct Node.js**: Run the backend service directly
2. **PM2 Process Management**: Use PM2 for production deployment with auto-restart
3. **Manual Data Access**: View captured data through:
   - Log files in `data/logs/` directory
   - SQLite database at `data/database/your-database.db`
   - Use any SQLite browser/tool to query the database

**Note**: The web frontend and Docker deployment are not functional yet.

## Quick Start (Backend Only)

### Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm 10+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd silent-watcher
```

2. Install dependencies:
```bash
pnpm install
pnpm approve-builds  # Required for better-sqlite3
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the backend:
```bash
pnpm build
```

5. Start the bot:

**Option A - Direct Node.js:**
```bash
pnpm start
```

**Option B - PM2 (Production):**
```bash
pnpm pm2:start    # Start with PM2
pnpm pm2:logs     # View logs
pnpm pm2:stop     # Stop the service
pnpm pm2:restart  # Restart the service
```

### Monitoring the Bot

Since the web interface isn't working yet, monitor the bot through:

- **Live logs**: `tail -f data/logs/app.log`
- **Error logs**: `tail -f data/logs/error.log`
- **Debug logs**: `tail -f data/logs/debug.log`
- **Database**: Use any SQLite tool to open `data/database/invicta.db`

### Development

```bash
# Start in development mode (backend only)
pnpm dev

# Run tests (limited coverage)
pnpm test

# Lint code
pnpm lint
```

## Known Issues

- ❌ **Frontend**: React web interface doesn't start
- ❌ **Docker**: Docker compose configuration fails
- ❌ **Tests**: Many tests are incomplete or failing
- ⚠️ **Media Download**: Partially implemented, may not work for all media types

## Contributing

This project is in active development. Contributions are welcome, especially for:

- Fixing the frontend React application
- Implementing proper Docker support
- Expanding test coverage
- Improving media handling functionality

## Configuration

See `.env.example` for all available configuration options.

## License

This project is licensed under the [Mozilla Public License 2.0 (MPL-2.0)](https://www.mozilla.org/en-US/MPL/2.0/).
