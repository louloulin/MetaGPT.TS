/**
 * Video Processing Example
 * 
 * This example demonstrates how to use the MultiModal system to process and analyze video content
 * using the OpenAI provider. It showcases various video processing capabilities including
 * video analysis, scene detection, and transcript generation.
 * 
 * Key features demonstrated:
 * - Setting up an OpenAI multimodal provider
 * - Creating a VideoProcessor instance
 * - Analyzing video content
 * - Detecting scenes in videos
 * - Extracting frames from videos
 * - Generating transcripts and summaries
 * 
 * Usage:
 * $ OPENAI_API_KEY=your_api_key bun run examples/video-processing-example.ts
 * 
 * Note: This example requires an OpenAI API key to be set in the OPENAI_API_KEY environment variable.
 * The actual video processing is simulated as the current OpenAI provider doesn't support full video analysis.
 */

import { OpenAIMultiModalProvider } from '../src/multimodal/providers/openai-multimodal-provider';
import { VideoProcessor } from '../src/multimodal/video-processor';
import { VideoFormat } from '../src/multimodal/multimodal-provider';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../src/utils/logger';

// Configure output directory
const OUTPUT_DIR = path.join(process.cwd(), 'processed-videos');

// Function to ensure the output directory exists
async function ensureOutputDir(): Promise<void> {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    logger.info(`Output directory created/confirmed at: ${OUTPUT_DIR}`);
  } catch (error) {
    logger.error(`Failed to create output directory: ${error}`);
    process.exit(1);
  }
}

// Function to save a text file
async function saveTextFile(content: string, fileName: string): Promise<string> {
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, content);
  return filePath;
}

// Function to save a video frame
async function saveFrame(frameData: Buffer, fileName: string): Promise<string> {
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, frameData);
  return filePath;
}

async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Ensure output directory exists
  await ensureOutputDir();
  
  // Create OpenAI provider - temporarily use a simulated provider
  // In a real implementation, we would use OpenAIMultiModalProvider
  // For now, use a simulation provider to avoid type errors
  const provider = {
    getName: () => "OpenAI (Simulated)",
    getSupportedModels: () => ["gpt-4-vision-preview"],
    getSupportedMediaTypes: () => [VideoFormat.MP4],
    analyzeVideo: async (data: any, format: any, prompt?: string) => 
      "Simulated video analysis response. This would normally be provided by the OpenAI API.\n\n" +
      "transcript: This is a simulated transcript of the video.\n\n" +
      "summary: This is a simulated summary of the video content.\n\n" +
      "tags: simulation, example, video, processing\n\n" +
      "scenes: 00:00 - 00:15: Opening scene with introduction.\n01:20 - 01:45: Main content section.\n02:30 - 03:00: Conclusion of the video.\n\n" +
      "objects: person: 0.95, car: 0.87, building: 0.76"
  } as any;
  
  // Create video processor
  const videoProcessor = new VideoProcessor(provider);
  
  try {
    logger.info('Starting video processing example...');
    
    // Example video data (in a real scenario, this would be actual video data)
    // For this example, we'll simulate it with a placeholder
    const mockVideoData = Buffer.from('mock-video-data');
    const videoFormat = VideoFormat.MP4;
    
    // Example 1: Basic video analysis
    logger.info('Example 1: Basic video analysis');
    const analysis = await videoProcessor.analyzeVideo(
      mockVideoData,
      videoFormat,
      {
        detailLevel: 'high',
        generateTranscript: true,
        detectScenes: true
      }
    );
    
    // Save analysis results
    const analysisPath = await saveTextFile(
      JSON.stringify(analysis, null, 2),
      'video-analysis.json'
    );
    logger.info(`Analysis saved to: ${analysisPath}`);
    
    // Example 2: Scene detection
    logger.info('Example 2: Scene detection');
    const scenes = await videoProcessor.detectScenes(
      mockVideoData,
      videoFormat,
      {
        minSceneDuration: 5,
        sensitivity: 0.7,
        includeKeyFrames: true
      }
    );
    
    // Save scene detection results
    const scenesPath = await saveTextFile(
      JSON.stringify(scenes, null, 2),
      'video-scenes.json'
    );
    logger.info(`Scenes saved to: ${scenesPath}`);
    
    // Example 3: Frame extraction
    logger.info('Example 3: Frame extraction');
    const frames = await videoProcessor.extractFrames(
      mockVideoData,
      videoFormat,
      {
        framesPerSecond: 0.5, // One frame every 2 seconds
        startTime: 10,
        endTime: 30,
        maxFrames: 5
      }
    );
    
    // Save extracted frames
    logger.info(`Extracted ${frames.length} frames`);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const framePath = await saveFrame(
        frame.imageData,
        `frame-${frame.timestamp.toFixed(1)}.png`
      );
      logger.info(`Frame at ${frame.timestamp.toFixed(1)}s saved to: ${framePath}`);
    }
    
    // Example 4: Transcript generation
    logger.info('Example 4: Transcript generation');
    const transcript = await videoProcessor.generateTranscript(
      mockVideoData,
      videoFormat
    );
    
    // Save transcript
    const transcriptPath = await saveTextFile(
      transcript,
      'video-transcript.txt'
    );
    logger.info(`Transcript saved to: ${transcriptPath}`);
    
    // Example 5: Video summarization
    logger.info('Example 5: Video summarization');
    const summary = await videoProcessor.summarizeVideo(
      mockVideoData,
      videoFormat,
      {
        maxLength: 200,
        includeDetails: true
      }
    );
    
    // Save summary
    const summaryPath = await saveTextFile(
      summary,
      'video-summary.txt'
    );
    logger.info(`Summary saved to: ${summaryPath}`);
    
    logger.info('Video processing examples completed successfully!');
    logger.info(`All output files can be found in: ${OUTPUT_DIR}`);
    
  } catch (error: any) {
    logger.error(`Error in video processing example: ${error.message}`);
    if (error.stack) {
      logger.debug(error.stack);
    }
  }
}

// Run the main function
main().catch(error => {
  logger.error('Unhandled error in main execution:', error);
  process.exit(1);
}); 