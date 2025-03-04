/**
 * Multimodal Cache System
 * 
 * This module provides caching mechanisms for multimodal operations to improve efficiency,
 * reduce redundant processing, and optimize resource usage.
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import type { ImageAnalysisResult } from './image-processor';

/**
 * Cache entry with metadata and expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: Record<string, any>;
}

/**
 * Cache options for configuration
 */
export interface CacheOptions {
  /**
   * Maximum cache size (number of entries)
   */
  maxSize?: number;
  
  /**
   * Default time-to-live in milliseconds
   */
  defaultTTL?: number;
  
  /**
   * Eviction policy for when cache is full
   */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'random';
  
  /**
   * Whether to persist cache between sessions
   */
  persistent?: boolean;
  
  /**
   * Storage location for persistent cache
   */
  storagePath?: string;
  
  /**
   * Whether to compress cached data
   */
  compression?: boolean;
}

/**
 * Multimodal cache for storing and retrieving analysis results
 */
export class MultimodalCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private defaultTTL: number;
  private evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'random';
  private persistent: boolean;
  private storagePath?: string;
  private compression: boolean;
  
  /**
   * Create a new multimodal cache
   */
  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours
    this.evictionPolicy = options.evictionPolicy || 'lru';
    this.persistent = options.persistent || false;
    this.storagePath = options.storagePath;
    this.compression = options.compression || false;
    
    // Load persistent cache if enabled
    if (this.persistent && this.storagePath) {
      this.loadFromDisk();
    }
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 10 * 60 * 1000); // Every 10 minutes
    
    logger.info(`Initialized MultimodalCache with max size: ${this.maxSize}, TTL: ${this.defaultTTL}ms`);
  }
  
  /**
   * Generate a cache key for the given data
   */
  private generateKey(data: string | Buffer | Uint8Array, context?: string): string {
    const hash = createHash('sha256');
    
    if (typeof data === 'string') {
      hash.update(data);
    } else {
      hash.update(Buffer.from(data));
    }
    
    if (context) {
      hash.update(context);
    }
    
    return hash.digest('hex');
  }
  
  /**
   * Store image analysis result in cache
   */
  set(
    key: string,
    data: any,
    ttl: number = this.defaultTTL,
    metadata?: Record<string, any>
  ): void {
    // Check if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }
    
    const now = Date.now();
    const entry: CacheEntry<any> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata,
    };
    
    this.cache.set(key, entry);
    
    // Persist if enabled
    if (this.persistent && this.storagePath) {
      this.saveToDisk();
    }
  }
  
  /**
   * Cache an image analysis result
   */
  cacheImageAnalysis(
    imageData: string | Buffer | Uint8Array,
    result: ImageAnalysisResult,
    context?: string,
    ttl?: number
  ): string {
    const key = this.generateKey(imageData, context);
    this.set(key, result, ttl);
    return key;
  }
  
  /**
   * Get a cached entry
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    
    // Check if expired
    if (entry.expiresAt < now) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access stats
    entry.accessCount += 1;
    entry.lastAccessed = now;
    
    return entry.data;
  }
  
  /**
   * Get a cached image analysis result
   */
  getImageAnalysis(
    imageData: string | Buffer | Uint8Array,
    context?: string
  ): ImageAnalysisResult | null {
    const key = this.generateKey(imageData, context);
    return this.get<ImageAnalysisResult>(key);
  }
  
  /**
   * Check if a key exists in the cache and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove an entry from the cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    
    // Persist changes if enabled
    if (result && this.persistent && this.storagePath) {
      this.saveToDisk();
    }
    
    return result;
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    
    // Persist changes if enabled
    if (this.persistent && this.storagePath) {
      this.saveToDisk();
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRatio?: number;
    averageAge: number;
    oldestEntry: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    let oldestEntryAge = 0;
    
    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      totalAge += age;
      
      if (age > oldestEntryAge) {
        oldestEntryAge = age;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
      oldestEntry: oldestEntryAge,
    };
  }
  
  /**
   * Evict entries based on the configured policy
   */
  private evict(): void {
    if (this.cache.size === 0) {
      return;
    }
    
    const now = Date.now();
    
    // First check for expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        return;
      }
    }
    
    // Apply eviction policy if still needed
    switch (this.evictionPolicy) {
      case 'lru': {
        // Least Recently Used
        let oldestAccessTime = Infinity;
        let oldestKey = '';
        
        for (const [key, entry] of this.cache.entries()) {
          if (entry.lastAccessed < oldestAccessTime) {
            oldestAccessTime = entry.lastAccessed;
            oldestKey = key;
          }
        }
        
        this.cache.delete(oldestKey);
        break;
      }
      
      case 'lfu': {
        // Least Frequently Used
        let lowestAccessCount = Infinity;
        let lfuKey = '';
        
        for (const [key, entry] of this.cache.entries()) {
          if (entry.accessCount < lowestAccessCount) {
            lowestAccessCount = entry.accessCount;
            lfuKey = key;
          }
        }
        
        this.cache.delete(lfuKey);
        break;
      }
      
      case 'fifo': {
        // First In First Out
        let oldestTimestamp = Infinity;
        let oldestKey = '';
        
        for (const [key, entry] of this.cache.entries()) {
          if (entry.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.timestamp;
            oldestKey = key;
          }
        }
        
        this.cache.delete(oldestKey);
        break;
      }
      
      case 'random': {
        // Random eviction
        const keys = Array.from(this.cache.keys());
        const randomIndex = Math.floor(Math.random() * keys.length);
        this.cache.delete(keys[randomIndex]);
        break;
      }
    }
  }
  
  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`Removed ${removedCount} expired entries from cache`);
      
      // Persist changes if enabled
      if (this.persistent && this.storagePath) {
        this.saveToDisk();
      }
    }
  }
  
  /**
   * Save cache to disk (if persistence is enabled)
   */
  private saveToDisk(): void {
    if (!this.storagePath) {
      return;
    }
    
    // In a real implementation, this would serialize the cache to disk
    logger.debug('Cache persistence not fully implemented');
  }
  
  /**
   * Load cache from disk (if persistence is enabled)
   */
  private loadFromDisk(): void {
    if (!this.storagePath) {
      return;
    }
    
    // In a real implementation, this would deserialize the cache from disk
    logger.debug('Cache persistence not fully implemented');
  }
} 