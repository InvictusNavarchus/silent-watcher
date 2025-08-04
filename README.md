# Silent Watcher

A robust, production-ready WhatsApp bot using Baileys that silently monitors and logs all WhatsApp activities with comprehensive audit trails and real-time web interface.

## Features

- 🔍 **Complete Message Monitoring**: Captures all message types, edits, deletions, reactions, and forwards
- 📊 **Real-time Dashboard**: Beautiful React-based web interface with live updates
- 🗄️ **Comprehensive Logging**: SQLite database with full audit trails
- 📱 **Media Handling**: Automatic download and storage of all media files
- 🔐 **Secure Access**: JWT-based authentication with role management
- 🚀 **Production Ready**: PM2 configuration, logging, and monitoring
- 🧪 **Test Driven**: 90%+ test coverage with comprehensive test suite

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

## Quick Start

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

4. Build the project:
```bash
pnpm build
```

5. Start the bot:
```bash
pnpm start
```

### Development

```bash
# Start in development mode
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint
```

## Configuration

See `.env.example` for all available configuration options.

## License

This project is licensed under the [Mozilla Public License 2.0 (MPL-2.0)](https://www.mozilla.org/en-US/MPL/2.0/).
