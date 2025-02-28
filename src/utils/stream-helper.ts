import { logger } from './logger';
import type { LLMProvider } from '../types/llm';

export interface StreamOptions {
  timeout?: number;
  debug?: boolean;
}

export async function handleLLMResponse(
  llm: LLMProvider,
  prompt: string,
  actionName: string,
  options: StreamOptions = {}
): Promise<string> {
  const {
    timeout = 30000, // 默认30秒超时
    debug = false
  } = options;

  const startTime = Date.now();
  let content = '';
  let lastChunkTime = startTime;
  let totalChunks = 0;

  try {
    if (!llm.chatStream) {
      logger.info(`[${actionName}] Using non-stream mode`);
      const response = await Promise.race([
        llm.chat(prompt),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), timeout)
        )
      ]);
      content = response;
      
      if (debug) {
        logger.debug(`[${actionName}] Response time: ${Date.now() - startTime}ms`);
        logger.debug(`[${actionName}] Response length: ${content.length} chars`);
      }
    } else {
      logger.info(`[${actionName}] Using stream mode`);
      const stream = await llm.chatStream(prompt);
      
      for await (const chunk of stream) {
        content += chunk;
        totalChunks++;
        
        const currentTime = Date.now();
        if (currentTime - lastChunkTime > timeout) {
          throw new Error('Stream chunk timeout');
        }
        lastChunkTime = currentTime;

        if (debug) {
          logger.debug(`[${actionName}] Chunk ${totalChunks}: ${chunk.length} chars`);
        }
      }

      if (debug) {
        const totalTime = Date.now() - startTime;
        logger.debug(`[${actionName}] Stream complete:`);
        logger.debug(`  - Total time: ${totalTime}ms`);
        logger.debug(`  - Total chunks: ${totalChunks}`);
        logger.debug(`  - Average chunk time: ${totalTime / totalChunks}ms`);
        logger.debug(`  - Total length: ${content.length} chars`);
        logger.debug(`  - Average chunk size: ${content.length / totalChunks} chars`);
      }
    }

    return content;
  } catch (error) {
    const errorTime = Date.now() - startTime;
    logger.error(`[${actionName}] Error after ${errorTime}ms:`);
    logger.error(`  - Error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`  - Chunks received: ${totalChunks}`);
    logger.error(`  - Content length: ${content.length} chars`);
    throw error;
  }
} 