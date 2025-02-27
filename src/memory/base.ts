/**
 * Base interface for memory systems
 */
export interface Memory {
  /**
   * Add a message to memory
   * @param message The message to add
   */
  add(message: { role: string, content: string }): void;

  /**
   * Get all messages from memory
   * @returns Array of messages
   */
  get(): Array<{ role: string, content: string }>;

  /**
   * Clear all messages from memory
   */
  clear(): void;

  /**
   * Get the number of messages in memory
   * @returns The message count
   */
  size(): number;

  /**
   * Get the last N messages from memory
   * @param n Number of messages to retrieve
   * @returns Array of the last N messages
   */
  getLast(n: number): Array<{ role: string, content: string }>;
} 