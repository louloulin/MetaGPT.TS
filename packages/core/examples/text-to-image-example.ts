/**
 * Text-to-Image Generation Example
 * 
 * This example demonstrates how to use the MultiModal system to generate images from text prompts
 * using the Stability AI provider. It showcases various image generation capabilities including
 * basic text-to-image generation, image editing, and variations.
 * 
 * Key features demonstrated:
 * - Setting up a Stability AI multimodal provider
 * - Creating an ImageGenerator instance
 * - Generating images from text prompts with different parameters
 * - Image editing capabilities (simulated)
 * - Creating image variations (simulated)
 * 
 * Usage:
 * $ STABILITY_API_KEY=your_api_key bun run examples/text-to-image-example.ts
 * 
 * Note: This example requires a Stability AI API key to be set in the STABILITY_API_KEY environment variable.
 */

import { StabilityMultiModalProvider } from '../src/multimodal/providers/stability-provider';
import { ImageGenerator, type ImageGenerationParams } from '../src/multimodal/image-generator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../src/utils/logger';

// Configure output directory
const OUTPUT_DIR = path.join(process.cwd(), 'generated-images');

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

// Function to save an image buffer to disk
async function saveImage(imageData: Buffer, fileName: string): Promise<string> {
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, imageData);
  return filePath;
}

async function main() {
  // Check for API key
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    logger.error('STABILITY_API_KEY environment variable is required');
    process.exit(1);
  }

  // Ensure output directory exists
  await ensureOutputDir();
  
  // Create Stability AI provider
  const provider = new StabilityMultiModalProvider({
    apiKey,
    options: {
      defaultEngine: 'stable-diffusion-xl-1024-v1-0',
      apiVersion: 'v1'
    }
  });
  
  // Create image generator
  const imageGenerator = new ImageGenerator(provider, {
    defaultModel: 'stable-diffusion-xl-1024-v1-0'
  });
  
  try {
    logger.info('Starting text-to-image generation example...');
    
    // Example 1: Basic image generation
    logger.info('Example 1: Basic image generation');
    const basicImage = await imageGenerator.generateImage({
      prompt: 'A serene lake at sunset with mountains in the background, digital art style',
      width: 1024,
      height: 1024,
      numInferenceSteps: 30,
      guidanceScale: 7.5,
      style: 'digital-art',
      styleStrength: 0.7,
      format: 'png',
      quality: 90
    });
    
    const basicImagePath = await saveImage(basicImage.imageData, 'basic-image.png');
    logger.info(`Basic image saved to: ${basicImagePath}`);
    logger.info(`Generation time: ${basicImage.metadata.generationTime}ms`);
    
    // Example 2: Detailed generation with negative prompt
    logger.info('Example 2: Detailed generation with negative prompt');
    const detailedImage = await imageGenerator.generateImage({
      prompt: 'A cyberpunk cityscape at night with neon lights, flying cars, and tall skyscrapers, highly detailed',
      negativePrompt: 'blurry, low quality, distorted, deformed, ugly, bad anatomy',
      width: 1024,
      height: 768,
      numInferenceSteps: 50,
      guidanceScale: 8.0,
      style: 'neon',
      styleStrength: 0.8,
      format: 'png',
      quality: 95,
      seed: 42 // Fixed seed for reproducibility
    });
    
    const detailedImagePath = await saveImage(detailedImage.imageData, 'detailed-image.png');
    logger.info(`Detailed image saved to: ${detailedImagePath}`);
    logger.info(`Generation time: ${detailedImage.metadata.generationTime}ms`);
    
    // Example 3: Multiple styles
    const styles = ['photographic', 'anime', 'comic', 'fantasy'];
    logger.info('Example 3: Multiple styles');
    
    const basePrompt = 'A magical forest with glowing mushrooms and a small cottage';
    
    for (const style of styles) {
      logger.info(`Generating image with style: ${style}`);
      const styledImage = await imageGenerator.generateImage({
        prompt: basePrompt,
        width: 768,
        height: 768,
        style: style as any,
        styleStrength: 0.8,
        numInferenceSteps: 30,
        guidanceScale: 7.5,
        format: 'png',
        quality: 90
      });
      
      const stylePath = await saveImage(styledImage.imageData, `style-${style}.png`);
      logger.info(`${style} style image saved to: ${stylePath}`);
    }
    
    // Example 4: Image variations (simulated in this example)
    logger.info('Example 4: Image variations (simulated)');
    
    // Using the first generated image as a base
    const variations = await imageGenerator.generateVariations(
      basicImage.imageData,
      3, // Generate 3 variations
      {
        variationStrength: 0.5,
        guidanceScale: 7.0
      }
    );
    
    for (let i = 0; i < variations.length; i++) {
      const variationPath = await saveImage(variations[i].imageData, `variation-${i+1}.png`);
      logger.info(`Variation ${i+1} saved to: ${variationPath}`);
    }
    
    // Example 5: Image editing (simulated in this example)
    logger.info('Example 5: Image editing (simulated)');
    
    // Create a mask (this would be a real mask in a production environment)
    const mockMask = Buffer.from('mock-mask-data');
    
    const editedImage = await imageGenerator.inpaintImage(
      basicImage.imageData,
      mockMask,
      'Add a small wooden boat on the lake',
      {
        strength: 0.8,
        numInferenceSteps: 40
      }
    );
    
    const editedImagePath = await saveImage(editedImage.imageData, 'edited-image.png');
    logger.info(`Edited image saved to: ${editedImagePath}`);
    
    logger.info('Text-to-image generation examples completed successfully!');
    logger.info(`All generated images can be found in: ${OUTPUT_DIR}`);
    
  } catch (error: any) {
    logger.error(`Error in text-to-image example: ${error.message}`);
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