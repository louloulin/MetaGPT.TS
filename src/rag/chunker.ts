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
  /** Split by semantic units */
  SEMANTIC = 'semantic',
}

/**
 * Chunker configuration schema
 */
export const ChunkerConfigSchema = z.object({
  /** Strategy for chunking */
  strategy: z.nativeEnum(ChunkingStrategy).default(ChunkingStrategy.PARAGRAPH),
  /** Maximum size of each chunk */
  maxSize: z.number().default(1000),
  /** Overlap between chunks */
  overlap: z.number().default(200),
  /** Whether to include metadata in chunks */
  includeMetadata: z.boolean().default(true),
  /** Whether to respect semantic boundaries when chunking */
  respectSemanticBoundaries: z.boolean().default(true),
  /** Minimum size of semantic chunks */
  minSemanticChunkSize: z.number().default(200),
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
      case ChunkingStrategy.SEMANTIC:
        return this.chunkBySemantic(text);
      default:
        return this.chunkByParagraph(text);
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
   * Chunk by semantic units (headings, paragraphs, lists, etc.)
   * @param text Document text
   * @returns Array of chunks
   */
  protected chunkBySemantic(text: string): string[] {
    const chunks: string[] = [];
    
    // Step 1: Detect document structure using regex patterns
    // - Headings (markdown/html style)
    // - Lists (bullet points, numbered)
    // - Code blocks
    // - Paragraphs
    
    // Define patterns for semantic boundaries
    const headingPattern = /(?:^|\n)(?:#{1,6} .+|\<h[1-6]\>.+\<\/h[1-6]\>)/g;
    const listItemPattern = /(?:^|\n)(?:[\*\-\+]|\d+\.) .+/g;
    const codeBlockPattern = /(?:^|\n)```[\s\S]*?```/g;
    const paragraphPattern = /(?:^|\n)\s*\n(.+?)(?:\n\s*\n|$)/g;
    
    // Identify semantic sections
    const sections: { type: string; start: number; end: number; content: string }[] = [];
    
    // Find headings
    let match;
    while ((match = headingPattern.exec(text)) !== null) {
      const nextHeadingPos = text.indexOf('\n', match.index + match[0].length);
      const end = nextHeadingPos !== -1 ? nextHeadingPos : text.length;
      
      sections.push({
        type: 'heading',
        start: match.index,
        end: end,
        content: text.substring(match.index, end)
      });
    }
    
    // Find list items and group them
    const listMatches: RegExpExecArray[] = [];
    while ((match = listItemPattern.exec(text)) !== null) {
      listMatches.push(match);
    }
    
    // Group consecutive list items
    for (let i = 0; i < listMatches.length; i++) {
      const start = listMatches[i].index;
      let end = start + listMatches[i][0].length;
      
      // Check if next match is a consecutive list item
      while (i + 1 < listMatches.length && 
            listMatches[i + 1].index <= end + 2) { // Allow for newlines
        end = listMatches[i + 1].index + listMatches[i + 1][0].length;
        i++;
      }
      
      sections.push({
        type: 'list',
        start: start,
        end: end,
        content: text.substring(start, end)
      });
    }
    
    // Find code blocks
    while ((match = codeBlockPattern.exec(text)) !== null) {
      sections.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        content: match[0]
      });
    }
    
    // Find paragraphs
    while ((match = paragraphPattern.exec(text)) !== null) {
      // Skip if this paragraph overlaps with any section we've already found
      const start = match.index;
      const end = start + match[0].length;
      
      const overlaps = sections.some(section => 
        (start >= section.start && start < section.end) ||
        (end > section.start && end <= section.end)
      );
      
      if (!overlaps) {
        sections.push({
          type: 'paragraph',
          start: start,
          end: end,
          content: match[0]
        });
      }
    }
    
    // Sort sections by their position in the document
    sections.sort((a, b) => a.start - b.start);
    
    // Step 2: Group sections into chunks while respecting semantic boundaries
    let currentChunk = '';
    let lastSectionEnd = 0;
    
    for (const section of sections) {
      // If there's a gap, include the text in between
      if (section.start > lastSectionEnd) {
        const gap = text.substring(lastSectionEnd, section.start);
        if (gap.trim().length > 0) {
          currentChunk += gap;
        }
      }
      
      // If adding this section would exceed the max size, finish the current chunk
      if (currentChunk.length + section.content.length > this.config.maxSize && 
          currentChunk.length >= this.config.minSemanticChunkSize) {
        // Save current chunk
        chunks.push(currentChunk);
        
        // Start new chunk with overlap from end of previous chunk if needed
        if (this.config.overlap > 0 && this.config.overlap < currentChunk.length) {
          const overlapText = currentChunk.substring(currentChunk.length - this.config.overlap);
          currentChunk = overlapText;
        } else {
          currentChunk = '';
        }
      }
      
      // Add the section to the current chunk
      currentChunk += section.content;
      lastSectionEnd = section.end;
    }
    
    // Add any remaining text
    if (lastSectionEnd < text.length) {
      const remainingText = text.substring(lastSectionEnd);
      if (remainingText.trim().length > 0) {
        currentChunk += remainingText;
      }
    }
    
    // Add the final chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // If no chunks were created (perhaps the document was empty), return an empty array
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