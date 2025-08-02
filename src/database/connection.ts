import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@/utils/logger.js';
import type { Config } from '@/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseConnection {
  private db: Database.Database | null = null;
  private config: Config['database'];

  constructor(config: Config['database']) {
    this.config = config;
  }

  /**
   * Initialize database connection and create tables
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing database connection', { path: this.config.path });
      
      this.db = new Database(this.config.path, {
        verbose: (message?: unknown) => {
          if (typeof message === 'string') {
            logger.debug('Database query', { query: message });
          }
        }
      });

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      this.db.pragma('mmap_size = 268435456'); // 256MB

      // Create tables from schema
      await this.createTables();
      
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  /**
   * Get database instance
   */
  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Create database tables from schema file
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      // Split schema into individual statements and execute
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        this.db.exec(statement);
      }

      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Failed to create database tables', { error });
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  public async migrate(): Promise<void> {
    // TODO: Implement migration system for future schema changes
    logger.info('Database migrations completed');
  }

  /**
   * Optimize database performance
   */
  public async optimize(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      logger.info('Optimizing database');
      
      // Analyze tables for query optimization
      this.db.exec('ANALYZE');
      
      // Vacuum database to reclaim space
      this.db.exec('VACUUM');
      
      // Update statistics
      this.db.exec('PRAGMA optimize');
      
      logger.info('Database optimization completed');
    } catch (error) {
      logger.error('Database optimization failed', { error });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public getStats(): Record<string, unknown> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = {
        pageCount: this.db.pragma('page_count', { simple: true }),
        pageSize: this.db.pragma('page_size', { simple: true }),
        cacheSize: this.db.pragma('cache_size', { simple: true }),
        journalMode: this.db.pragma('journal_mode', { simple: true }),
        synchronous: this.db.pragma('synchronous', { simple: true }),
        walCheckpoint: this.db.pragma('wal_checkpoint', { simple: true })
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      return {};
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection', { error });
      }
    }
  }

  /**
   * Check if database is connected
   */
  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Execute a transaction
   */
  public transaction<T>(fn: (db: Database.Database) => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }

  /**
   * Backup database to file
   */
  public async backup(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      logger.info('Creating database backup', { backupPath });

      // Use better-sqlite3's backup method correctly
      await this.db.backup(backupPath, {
        progress: (info) => {
          logger.debug('Backup progress', {
            totalPages: info.totalPages,
            remainingPages: info.remainingPages
          });
          return 100; // Continue with all remaining pages
        }
      });

      logger.info('Database backup completed successfully');
      return;
    } catch (error) {
      logger.error('Database backup failed', { error });
      throw error;
    }
  }
}
