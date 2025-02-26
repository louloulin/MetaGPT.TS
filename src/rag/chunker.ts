/**
 * Document Chunker
 * 
 * A component responsible for splitting documents into manageable chunks
 * that can be embedded and stored in vector databases.
 * 
 * @module rag/chunker
 * @category RAG
 */

import { z } from 'zod';

/**
 * Chunking strategy options
 */
export enum ChunkingStrategy {
  /** Split by character/token count */
  TOKEN = 'token',
  /** Split by sentences */
  SENTENCE = 'sentence',
  /** Split by paragraphs */
  PARAGRAPH = 'paragraph',
  /** Split by fixed size */
  FIXED = 'fixed',
}

/**
 * Chunker configuration schema
 */
export const ChunkerConfigSchema = z.object({
  /** Strategy for chunking */
  strategy: z.nativeEnum(ChunkingStrategy).default(ChunkingStrategy.TOKEN),
  /** Maximum size of each chunk */
  maxSize: z.number().default(1000),
  /** Overlap between chunks */
  overlap: z.number().default(200),
  /** Whether to include metadata in chunks */
  includeMetadata: z.boolean().default(true),
});

export type ChunkerConfig = z.infer<typeof ChunkerConfigSchema>;

/**
 * Interface for document chunks
 */
export interface Chunker {
  /**
   * Split a document into chunks
   * @param text Document text to split
   * @param metadata Optional metadata to include with chunks
   * @returns Array of document chunks
   */
  chunk(text: string, metadata?: Record<string, any>): string[];
  
  /**
   * Update the chunker configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<ChunkerConfig>): void;
}

/**
 * Base implementation of the Chunker interface
 */
export class BaseChunker implements Chunker {
  protected config: ChunkerConfig;
  
  /**
   * Create a new chunker
   * @param config Chunker configuration
   */
  constructor(config?: Partial<ChunkerConfig>) {
    this.config = ChunkerConfigSchema.parse(config || {});
  }
  
  /**
   * Split document into chunks
   * @param text Document text
   * @param metadata Optional metadata
   * @returns Array of text chunks
   */
  chunk(text: string, metadata?: Record<string, any>): string[] {
    switch (this.config.strategy) {
      case ChunkingStrategy.TOKEN:
        return this.chunkByToken(text);
      case ChunkingStrategy.SENTENCE:
        return this.chunkBySentence(text);
      case ChunkingStrategy.PARAGRAPH:
        return this.chunkByParagraph(text);
      case ChunkingStrategy.FIXED:
        return this.chunkByFixed(text);
      default:
        return this.chunkByToken(text);
    }
  }
  
  /**
   * Update the chunker configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<ChunkerConfig>): void {
    this.config = ChunkerConfigSchema.parse({
      ...this.config,
      ...config,
    });
  }
  
  /**
   * Chunk by token/character count
   * @param text Document text
   * @returns Array of chunks
   */
  protected chunkByToken(text: string): string[] {
    const chunks: string[] = [];
    const { maxSize, overlap } = this.config;
    
    let currentPos = 0;
    while (currentPos < text.length) {
      // Calculate end position for this chunk
      const endPos = Math.min(currentPos + maxSize, text.length);
      
      // Extract the chunk
      const chunk = text.substring(currentPos, endPos);
      chunks.push(chunk);
      
      // Move to next position, accounting for overlap
      currentPos = endPos - overlap;
      
      // Ensure we're making progress
      if (currentPos <= 0 || currentPos >= text.length) {
        break;
      }
    }
    
    return chunks;
  }
  
  /**
   * Chunk by sentences
   * @param text Document text
   * @returns Array of chunks
   */
  protected chunkBySentence(text: string): string[] {
    // Simple sentence splitting (can be improved)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      // If adding this sentence would exceed the max size,
      // store the current chunk and start a new one
      if (currentChunk.length + sentence.length > this.config.maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        
        // Start new chunk with overlap if possible
        const overlapText = currentChunk.substring(
          Math.max(0, currentChunk.length - this.config.overlap)
        );
        currentChunk = overlapText + sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    // Add the final chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Chunk by paragraphs
   * @param text Document text
   * @returns Array of chunks
   */
  protected chunkByParagraph(text: string): string[] {
    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    
    let currentChunk = '';
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;
      
      // If adding this paragraph would exceed the max size,
      // store the current chunk and start a new one
      if (currentChunk.length + trimmedParagraph.length > this.config.maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = trimmedParagraph;
      } else {
        if (currentChunk.length > 0) {
          currentChunk += '\n\n';
        }
        currentChunk += trimmedParagraph;
      }
    }
    
    // Add the final chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Chunk by fixed size
   * @param text Document text
   * @returns Array of chunks
   */
  protected chunkByFixed(text: string): string[] {
    return this.chunkByToken(text); // Simplified implementation
  }
} 