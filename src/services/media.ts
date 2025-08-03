import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import { writeFile, mkdir, stat, access } from 'fs/promises';
import { join, dirname } from 'path';
import sharp from 'sharp';
import { logger, logError } from '@/utils/logger.js';
import { generateId, sanitizeFilename, formatBytes } from '@/utils/helpers.js';
import { DatabaseService } from '@/services/database.js';
import type { Config, Message, Media } from '@/types/index.js';
import { MediaType } from '@/types/index.js';

export class MediaService {
  private config: Config;
  private databaseService: DatabaseService;
  private mediaBasePath: string;

  constructor(config: Config, databaseService: DatabaseService) {
    this.config = config;
    this.databaseService = databaseService;
    this.mediaBasePath = join(process.cwd(), 'data', 'media');
  }

  /**
   * Initialize media service
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure media directories exist
      const mediaTypes = ['images', 'videos', 'audio', 'documents', 'stickers'];
      for (const type of mediaTypes) {
        const dir = join(this.mediaBasePath, type);
        await mkdir(dir, { recursive: true });
      }

      logger.info('Media service initialized', { basePath: this.mediaBasePath });
    } catch (error) {
      logError(error as Error, { context: 'Media service initialization' });
      throw error;
    }
  }

  /**
   * Process media from WhatsApp message
   */
  public async processMessageMedia(waMessage: WAMessage, message: Message): Promise<void> {
    if (!message.mediaPath || !message.mediaType) {
      return;
    }

    try {
      // Check file size limit
      if (message.mediaSize && message.mediaSize > this.config.media.maxSizeMB * 1024 * 1024) {
        logger.warn('Media file too large, skipping download', {
          messageId: message.id,
          size: formatBytes(message.mediaSize),
          limit: `${this.config.media.maxSizeMB}MB`
        });
        return;
      }

      // Download media
      const buffer = await downloadMediaMessage(waMessage, 'buffer', {});
      if (!buffer) {
        logger.warn('Failed to download media buffer', { messageId: message.id });
        return;
      }

      // Generate file paths
      const fileName = this.generateFileName(message, waMessage);
      const filePath = join(this.mediaBasePath, message.mediaPath);
      const fullPath = join(dirname(filePath), fileName);

      // Ensure directory exists
      await mkdir(dirname(fullPath), { recursive: true });

      let finalBuffer = buffer;
      let thumbnailPath: string | undefined;
      let isCompressed = false;
      let originalSize = buffer.length;

      // Process image compression and thumbnails
      if (message.mediaType === MediaType.IMAGE && this.config.media.compressionEnabled) {
        const processed = await this.processImage(buffer, fullPath);
        finalBuffer = processed.buffer;
        thumbnailPath = processed.thumbnailPath;
        isCompressed = processed.isCompressed;
      }

      // Process video thumbnails
      if (message.mediaType === MediaType.VIDEO) {
        thumbnailPath = await this.generateVideoThumbnail(buffer, fullPath);
      }

      // Write file to disk
      await writeFile(fullPath, finalBuffer);

      // Create media record in database
      const mediaRecord: Omit<Media, 'createdAt'> = {
        id: generateId(),
        messageId: message.id,
        fileName,
        filePath: fullPath,
        mimeType: message.mediaMimeType || 'application/octet-stream',
        size: finalBuffer.length,
        width: await this.getImageWidth(finalBuffer, message.mediaType),
        height: await this.getImageHeight(finalBuffer, message.mediaType),
        duration: (await this.getMediaDuration(waMessage)) ?? undefined,
        thumbnailPath,
        isCompressed,
        originalSize
      };

      await this.createMediaRecord(mediaRecord);

      logger.debug('Media processed successfully', {
        messageId: message.id,
        fileName,
        size: formatBytes(finalBuffer.length),
        compressed: isCompressed
      });

    } catch (error) {
      logError(error as Error, {
        context: 'Media processing',
        messageId: message.id,
        mediaPath: message.mediaPath
      });
    }
  }

  /**
   * Process image compression and thumbnail generation
   */
  private async processImage(buffer: Buffer, filePath: string): Promise<{
    buffer: Buffer;
    thumbnailPath?: string;
    isCompressed: boolean;
  }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      let processedBuffer = buffer;
      let isCompressed = false;

      // Compress if image is large
      if (metadata.width && metadata.height && (metadata.width > 1920 || metadata.height > 1080)) {
        processedBuffer = await image
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        isCompressed = true;
      }

      // Generate thumbnail
      const thumbnailPath = filePath.replace(/\.[^.]+$/, '_thumb.jpg');
      await image
        .resize(200, 200, { fit: 'inside' })
        .jpeg({ quality: 70 })
        .toFile(thumbnailPath);

      return {
        buffer: processedBuffer,
        thumbnailPath,
        isCompressed
      };
    } catch (error) {
      logger.warn('Image processing failed, using original', { error });
      return {
        buffer,
        isCompressed: false
      };
    }
  }

  /**
   * Generate video thumbnail
   */
  private async generateVideoThumbnail(_buffer: Buffer, _filePath: string): Promise<string | undefined> {
    try {
      // For now, we'll skip video thumbnail generation as it requires ffmpeg
      // This can be implemented later with a video processing library
      logger.debug('Video thumbnail generation not implemented yet');
      return undefined;
    } catch (error) {
      logger.warn('Video thumbnail generation failed', { error });
      return undefined;
    }
  }

  /**
   * Generate safe filename for media
   */
  private generateFileName(message: Message, waMessage: WAMessage): string {
    const msg = waMessage.message;
    let originalName = '';

    // Try to get original filename
    if (msg?.documentMessage?.fileName) {
      originalName = msg.documentMessage.fileName;
    } else if (msg?.imageMessage?.caption) {
      originalName = msg.imageMessage.caption.substring(0, 50);
    } else if (msg?.videoMessage?.caption) {
      originalName = msg.videoMessage.caption.substring(0, 50);
    }

    // Sanitize filename
    if (originalName) {
      originalName = sanitizeFilename(originalName);
    }

    // Generate filename with message ID and timestamp
    const timestamp = new Date(message.timestamp * 1000).toISOString().slice(0, 19).replace(/:/g, '-');
    const extension = this.getFileExtension(message.mediaType!, message.mediaMimeType);
    
    if (originalName) {
      return `${timestamp}_${message.id.slice(0, 8)}_${originalName}${extension}`;
    } else {
      return `${timestamp}_${message.id.slice(0, 8)}${extension}`;
    }
  }

  /**
   * Get file extension based on media type and mime type
   */
  private getFileExtension(mediaType: MediaType, mimeType?: string): string {
    if (mimeType) {
      const extensions: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/avi': '.avi',
        'video/mov': '.mov',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg',
        'audio/wav': '.wav',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
      };

      if (extensions[mimeType]) {
        return extensions[mimeType];
      }
    }

    // Fallback based on media type
    const fallbacks: Record<MediaType, string> = {
      [MediaType.IMAGE]: '.jpg',
      [MediaType.VIDEO]: '.mp4',
      [MediaType.AUDIO]: '.ogg',
      [MediaType.DOCUMENT]: '.bin',
      [MediaType.STICKER]: '.webp'
    };

    return fallbacks[mediaType] || '.bin';
  }

  /**
   * Get image dimensions
   */
  private async getImageWidth(buffer: Buffer, mediaType: MediaType): Promise<number | undefined> {
    if (mediaType !== MediaType.IMAGE && mediaType !== MediaType.STICKER) {
      return undefined;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      return metadata.width;
    } catch {
      return undefined;
    }
  }

  private async getImageHeight(buffer: Buffer, mediaType: MediaType): Promise<number | undefined> {
    if (mediaType !== MediaType.IMAGE && mediaType !== MediaType.STICKER) {
      return undefined;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      return metadata.height;
    } catch {
      return undefined;
    }
  }

  /**
   * Get media duration for audio/video
   */
  private async getMediaDuration(waMessage: WAMessage): Promise<number | undefined> {
    const msg = waMessage.message;
    
    if (msg?.audioMessage?.seconds) {
      return Number(msg.audioMessage.seconds);
    }
    

    
    if (msg?.videoMessage?.seconds) {
      return Number(msg.videoMessage.seconds);
    }

    return undefined;
  }

  /**
   * Create media record in database
   */
  private async createMediaRecord(media: Omit<Media, 'createdAt'>): Promise<void> {
    await this.databaseService.createMedia(media);
  }

  /**
   * Get media file path
   */
  public async getMediaPath(mediaId: string): Promise<string | null> {
    try {
      // This would query the database for the media record
      // For now, return null
      return null;
    } catch (error) {
      logError(error as Error, { context: 'Get media path', mediaId });
      return null;
    }
  }

  /**
   * Check if media file exists
   */
  public async mediaExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get media file stats
   */
  public async getMediaStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const stats = await stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up old media files
   */
  public async cleanupOldMedia(olderThanDays: number): Promise<void> {
    try {
      logger.info('Starting media cleanup', { olderThanDays });
      
      // This would implement cleanup logic
      // Query database for old media records
      // Delete files and database records
      
      logger.info('Media cleanup completed');
    } catch (error) {
      logError(error as Error, { context: 'Media cleanup' });
    }
  }
}
