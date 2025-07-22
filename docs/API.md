# Silent Watcher API Documentation

## Overview

The Silent Watcher API provides RESTful endpoints for accessing WhatsApp monitoring data. All API endpoints require JWT authentication except for health checks.

## Base URL

```
http://localhost:3000/api
```

## Authentication

### Login

**POST** `/auth/login`

Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### Using the Token

Include the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Refresh Token

**POST** `/auth/refresh`

Refresh your JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Logout

**POST** `/auth/logout`

Invalidate the current token.

**Headers:** `Authorization: Bearer <token>`

## Messages API

### Get Messages

**GET** `/api/messages`

Retrieve messages with filtering and pagination.

**Query Parameters:**
- `chat` (string): Filter by chat ID
- `days` (number): Number of days to look back (default: 7)
- `type` (string): Message type filter (text, image, video, audio, document, sticker, location, contact, poll, reaction, system)
- `state` (string): Message state filter (all, edited, deleted)
- `search` (string): Search in message content
- `limit` (number): Number of messages per page (default: 50, max: 100)
- `offset` (number): Pagination offset (default: 0)

**Example Request:**
```
GET /api/messages?chat=1234567890@s.whatsapp.net&days=30&type=text&limit=20&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "3EB0C767D26A1B2E5C9A8F4D",
      "chatId": "1234567890@s.whatsapp.net",
      "senderId": "0987654321@s.whatsapp.net",
      "content": "Hello, world!",
      "messageType": "text",
      "timestamp": 1640995200,
      "isFromMe": false,
      "quotedMessageId": null,
      "mediaPath": null,
      "mediaType": null,
      "mediaMimeType": null,
      "mediaSize": null,
      "isForwarded": false,
      "forwardedFrom": null,
      "isEphemeral": false,
      "ephemeralDuration": null,
      "isViewOnce": false,
      "reactions": "[]",
      "createdAt": 1640995200,
      "updatedAt": 1640995200
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Get Single Message

**GET** `/api/messages/:id`

Retrieve a specific message by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "3EB0C767D26A1B2E5C9A8F4D",
    "chatId": "1234567890@s.whatsapp.net",
    "senderId": "0987654321@s.whatsapp.net",
    "content": "Hello, world!",
    "messageType": "text",
    "timestamp": 1640995200,
    "isFromMe": false,
    "reactions": "[]",
    "createdAt": 1640995200,
    "updatedAt": 1640995200
  }
}
```

### Get Message History

**GET** `/api/messages/:id/history`

Get the edit/deletion history for a message.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "event-1",
      "messageId": "3EB0C767D26A1B2E5C9A8F4D",
      "eventType": "created",
      "oldContent": null,
      "newContent": "Hello, world!",
      "timestamp": 1640995200,
      "metadata": "{}",
      "createdAt": 1640995200
    },
    {
      "id": "event-2",
      "messageId": "3EB0C767D26A1B2E5C9A8F4D",
      "eventType": "edited",
      "oldContent": "Hello, world!",
      "newContent": "Hello, universe!",
      "timestamp": 1640995260,
      "metadata": "{}",
      "createdAt": 1640995260
    }
  ]
}
```

## Chats API

### Get Chats

**GET** `/api/chats`

Retrieve all monitored chats.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1234567890@s.whatsapp.net",
      "name": "John Doe",
      "isGroup": false,
      "participantCount": null,
      "description": null,
      "profilePicture": null,
      "lastMessageId": "3EB0C767D26A1B2E5C9A8F4D",
      "lastMessageTime": 1640995200,
      "isArchived": false,
      "isMuted": false,
      "muteUntil": null,
      "createdAt": 1640995200,
      "updatedAt": 1640995200
    }
  ]
}
```

### Get Chat Messages

**GET** `/api/chats/:id/messages`

Get messages for a specific chat.

**Query Parameters:** Same as `/api/messages` (except `chat` parameter)

## Statistics API

### Get Overview Statistics

**GET** `/api/stats/overview`

Get high-level statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMessages": 15420,
    "totalChats": 45,
    "totalMedia": 2340,
    "storageUsed": 1073741824,
    "activeChats": 12,
    "messagesLast24h": 156,
    "messagesLast7d": 1205,
    "messagesLast30d": 4890
  }
}
```

### Get Chat Statistics

**GET** `/api/stats/chats`

Get per-chat statistics.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "chatId": "1234567890@s.whatsapp.net",
      "chatName": "John Doe",
      "messageCount": 450,
      "mediaCount": 23,
      "lastActivity": 1640995200,
      "averageMessagesPerDay": 15.2
    }
  ]
}
```

### Get Media Statistics

**GET** `/api/stats/media`

Get media file statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 2340,
    "totalSize": 1073741824,
    "byType": {
      "image": { "count": 1200, "size": 536870912 },
      "video": { "count": 340, "size": 402653184 },
      "audio": { "count": 600, "size": 104857600 },
      "document": { "count": 150, "size": 26214400 },
      "sticker": { "count": 50, "size": 3145728 }
    }
  }
}
```

## Media API

### Get Media File

**GET** `/api/media/:id`

Download a media file.

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file data with appropriate Content-Type header

### Get Media Thumbnail

**GET** `/api/media/:id/thumbnail`

Get a thumbnail for image/video files.

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary thumbnail data (JPEG format)

## Bot Management API

### Get Bot Status

**GET** `/api/bot/status` (Admin only)

Get detailed bot status information.

**Response:**
```json
{
  "success": true,
  "data": {
    "whatsapp": {
      "isConnected": true,
      "connectionState": "open",
      "qrCode": null,
      "lastConnected": 1640995200,
      "messagesProcessed": 15420,
      "uptime": 86400
    },
    "database": {
      "connected": true
    },
    "system": {
      "uptime": 86400,
      "memory": {
        "rss": 134217728,
        "heapTotal": 67108864,
        "heapUsed": 33554432,
        "external": 16777216,
        "arrayBuffers": 8388608
      },
      "version": "0.1.0"
    }
  }
}
```

## Export API

### Export Data

**POST** `/api/export` (Admin only)

Export messages in various formats.

**Request Body:**
```json
{
  "format": "json",
  "chat": "1234567890@s.whatsapp.net",
  "days": 30,
  "type": "text",
  "includeMedia": false
}
```

**Response:** File download with appropriate Content-Type

## Health Check

### Application Health

**GET** `/health` (No authentication required)

Basic health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "uptime": 86400
  }
}
```

### Detailed Health

**GET** `/api/health`

Detailed health check with authentication.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "uptime": 86400,
    "whatsapp": {
      "connected": true,
      "state": "open",
      "messagesProcessed": 15420
    },
    "database": {
      "connected": true
    }
  }
}
```

## Error Responses

All API endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited:
- **Authentication endpoints**: 5 requests per 15 minutes
- **General API endpoints**: 100 requests per 15 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## WebSocket API

### Connection

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/websocket?token=your-jwt-token');
```

### Message Format

```json
{
  "type": "message",
  "data": {
    "event": "new_message",
    "message": { /* message object */ }
  }
}
```

### Event Types

- `new_message` - New message received
- `message_updated` - Message edited or deleted
- `message_reaction` - Message reaction added/removed
- `connection_status` - WhatsApp connection status changed
- `bot_status` - Bot status update

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class SilentWatcherAPI {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getMessages(params = {}) {
    const response = await this.client.get('/messages', { params });
    return response.data;
  }

  async getMessage(id) {
    const response = await this.client.get(`/messages/${id}`);
    return response.data;
  }

  async getStats() {
    const response = await this.client.get('/stats/overview');
    return response.data;
  }
}

// Usage
const api = new SilentWatcherAPI('http://localhost:3000/api', 'your-jwt-token');
const messages = await api.getMessages({ days: 7, limit: 50 });
```

### Python

```python
import requests

class SilentWatcherAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_messages(self, **params):
        response = requests.get(
            f'{self.base_url}/messages',
            headers=self.headers,
            params=params
        )
        return response.json()
    
    def get_message(self, message_id):
        response = requests.get(
            f'{self.base_url}/messages/{message_id}',
            headers=self.headers
        )
        return response.json()

# Usage
api = SilentWatcherAPI('http://localhost:3000/api', 'your-jwt-token')
messages = api.get_messages(days=7, limit=50)
```
