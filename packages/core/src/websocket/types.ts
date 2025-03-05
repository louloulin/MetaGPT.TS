import { z } from 'zod';
import type { Message } from '../types/message';

/**
 * WebSocket message types for different communication scenarios
 */
export enum WebSocketMessageType {
  /** Connection established */
  CONNECT = 'connect',
  /** Connection terminated */
  DISCONNECT = 'disconnect',
  /** Regular message */
  MESSAGE = 'message',
  /** Error occurred */
  ERROR = 'error',
  /** Streaming chunk */
  STREAM = 'stream',
  /** End of stream */
  STREAM_END = 'stream_end',
}

/**
 * Schema for WebSocket messages with validation
 */
export const WebSocketMessageSchema = z.object({
  /** Message type from WebSocketMessageType enum */
  type: z.nativeEnum(WebSocketMessageType),
  /** Message payload - can be any valid JSON data */
  payload: z.any(),
  /** Timestamp of message creation */
  timestamp: z.number().default(() => Date.now()),
  /** Unique message identifier */
  id: z.string().uuid().default(() => crypto.randomUUID()),
});

/**
 * WebSocket message type
 */
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * Configuration options for WebSocket client
 */
export interface WebSocketClientOptions {
  /** WebSocket server URL */
  url: string;
  /** WebSocket protocols */
  protocols?: string | string[];
  /** Whether to attempt reconnection on disconnect */
  reconnect?: boolean;
  /** Interval between reconnection attempts in ms */
  reconnectInterval?: number;
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;
  /** Callback for received messages */
  onMessage?: (message: WebSocketMessage) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback for successful connection */
  onConnect?: () => void;
  /** Callback for disconnection */
  onDisconnect?: () => void;
}

/**
 * Configuration options for WebSocket server
 */
export interface WebSocketServerOptions {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host?: string;
  /** URL path for WebSocket endpoint */
  path?: string;
  /** Callback for new client connections */
  onConnection?: (client: WebSocket) => void;
  /** Callback for received messages */
  onMessage?: (message: WebSocketMessage, client: WebSocket) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Options for streaming messages over WebSocket
 */
export interface WebSocketStreamOptions {
  /** Size of each chunk in bytes */
  chunkSize?: number;
  /** Delay between chunks in ms */
  delay?: number;
  /** Callback for streaming progress */
  onProgress?: (progress: number) => void;
}

/**
 * Interface for WebSocket client implementation
 */
export interface WebSocketClient {
  /** Connect to WebSocket server */
  connect(): Promise<void>;
  /** Disconnect from WebSocket server */
  disconnect(): Promise<void>;
  /** Send a message */
  send(message: Message | WebSocketMessage): Promise<void>;
  /** Stream a message in chunks */
  stream(message: Message, options?: WebSocketStreamOptions): AsyncIterableIterator<string>;
  /** Check connection status */
  isConnected(): boolean;
}

/**
 * Interface for WebSocket server implementation
 */
export interface WebSocketServer {
  /** Start the WebSocket server */
  start(): Promise<void>;
  /** Stop the WebSocket server */
  stop(): Promise<void>;
  /** Broadcast a message to all clients */
  broadcast(message: Message | WebSocketMessage): Promise<void>;
  /** Get list of connected clients */
  getClients(): WebSocket[];
  /** Check server status */
  isRunning(): boolean;
} 