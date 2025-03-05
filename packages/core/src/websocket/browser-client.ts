import type { Message } from '../types/message';
import {
  WebSocketMessageSchema,
  WebSocketMessageType,
} from './types';
import type {
  WebSocketClient,
  WebSocketClientOptions,
  WebSocketMessage,
  WebSocketStreamOptions,
} from './types';

/**
 * Browser-compatible WebSocket client implementation
 * 
 * Features:
 * - Uses native browser WebSocket API
 * - Automatic reconnection with configurable attempts and intervals
 * - Message validation using Zod schema
 * - Support for streaming large messages in chunks
 * - Progress tracking for streaming operations
 * - Error handling and event callbacks
 */
export class BrowserWebSocketClient implements WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;

  /**
   * Create a new browser WebSocket client instance
   * @param options - Configuration options for the client
   */
  constructor(private options: WebSocketClientOptions) {
    this.options = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  /**
   * Connect to WebSocket server with automatic reconnection support
   * @throws Error if connection fails and max reconnection attempts are reached
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url, this.options.protocols);

        // Handle successful connection
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.options.onConnect?.();
          resolve();
        };

        // Handle incoming messages with validation
        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const message = WebSocketMessageSchema.parse(JSON.parse(event.data));
            this.options.onMessage?.(message);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.options.onError?.(new Error(`Invalid message format: ${message}`));
          }
        };

        // Handle connection errors
        this.ws.onerror = (event: Event) => {
          const error = new Error('WebSocket connection error');
          this.options.onError?.(error);
          reject(error);
        };

        // Handle disconnection and reconnection
        this.ws.onclose = () => {
          this.options.onDisconnect?.();
          if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts!) {
            this.reconnectTimeout = window.setTimeout(() => {
              this.reconnectAttempts++;
              this.connect().catch(error => {
                if (error instanceof Error) {
                  this.options.onError?.(error);
                } else {
                  this.options.onError?.(new Error(String(error)));
                }
              });
            }, this.options.reconnectInterval);
          }
        };
      } catch (error: unknown) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(String(error)));
        }
      }
    });
  }

  /**
   * Disconnect from WebSocket server and cleanup resources
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the WebSocket server
   * @param message - Message to send (either Message or WebSocketMessage format)
   * @throws Error if client is not connected
   */
  public async send(message: Message | WebSocketMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const wsMessage = 'type' in message ? message : {
      type: WebSocketMessageType.MESSAGE,
      payload: message,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    };

    this.ws.send(JSON.stringify(wsMessage));
  }

  /**
   * Stream a large message in chunks with progress tracking
   * @param message - Message to stream
   * @param options - Streaming options (chunk size, delay, progress callback)
   * @yields Each chunk of the message
   */
  public async *stream(
    message: Message,
    options: WebSocketStreamOptions = {}
  ): AsyncIterableIterator<string> {
    const {
      chunkSize = 1024,
      delay = 0,
      onProgress,
    } = options;

    const content = message.content;
    const totalChunks = Math.ceil(content.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = content.slice(i * chunkSize, (i + 1) * chunkSize);
      const progress = Math.round(((i + 1) / totalChunks) * 100);

      await this.send({
        type: i === totalChunks - 1 ? WebSocketMessageType.STREAM_END : WebSocketMessageType.STREAM,
        payload: {
          ...message,
          content: chunk,
          progress,
        },
        timestamp: Date.now(),
        id: crypto.randomUUID(),
      });

      onProgress?.(progress);
      yield chunk;

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Check if client is currently connected to the server
   * @returns true if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
} 