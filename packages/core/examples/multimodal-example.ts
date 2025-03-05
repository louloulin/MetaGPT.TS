/**
 * Example demonstrating the usage of the multimodal generator
 */

import { MultimodalGenerator } from '../src/multimodal/multimodal-generator';
import { OpenAIProvider } from '../src/multimodal/providers/openai-provider';
import { logger } from '../src/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  // Initialize the OpenAI provider
  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORG_ID || '',
  });

  // Create a multimodal generator instance
  const generator = new MultimodalGenerator(provider);

  try {
    // 1. Generate an image
    logger.info('Generating an image...');
    const imageResult = await generator.generateImage({
      prompt: 'A futuristic city with flying cars and holographic billboards at night',
      width: 1024,
      height: 1024,
      numInferenceSteps: 50,
      guidanceScale: 7.5,
    });

    // Save the generated image
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, 'generated_city.png'),
      imageResult.imageData
    );

    // 2. Analyze the generated image
    logger.info('Analyzing the generated image...');
    const analysis = await generator.analyzeImage(
      imageResult.imageData,
      'Describe the key elements and atmosphere of this futuristic cityscape.'
    );
    logger.info('Image analysis:', analysis);

    // 3. Create and execute a multimodal plan
    logger.info('Creating a multimodal plan...');
    const plan = await generator.createPlan(
      'Create a visual story about technological evolution',
      {
        theme: 'progress',
        style: 'realistic',
        numImages: 3,
      }
    );

    logger.info('Executing the plan...');
    const results = await generator.executePlan(plan, {
      text: 'Show the progression of transportation technology from past to future.',
      requirements: [
        'Historical accuracy',
        'Clear technological progression',
        'Consistent art style',
      ],
    });

    // Save the results
    for (const [key, value] of Object.entries(results)) {
      if (value.images) {
        for (let i = 0; i < value.images.length; i++) {
          const image = value.images[i];
          await fs.writeFile(
            path.join(outputDir, `${key}_${i}.png`),
            image.imageData
          );
        }
      }
    }

    // 4. Demonstrate multimodal reasoning
    logger.info('Performing multimodal reasoning...');
    const images = await Promise.all([
      fs.readFile(path.join(outputDir, 'generated_city.png')),
      ...Object.entries(results)
        .filter(([_, value]) => value.images)
        .flatMap(([_, value]) => value.images.map((img: any) => img.imageData)),
    ]);

    // Use the generator's analyzeImage method for multimodal reasoning
    const reasoning = await generator.analyzeImage(
      Buffer.concat(images),
      'Compare and analyze the technological progression shown in these images, ' +
      'highlighting key innovations and their potential impact on society.'
    );
    logger.info('Multimodal reasoning result:', reasoning);

  } catch (error) {
    logger.error('Error in multimodal example:', error);
    throw error;
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_ORG_ID) {
    logger.error(
      'Please set OPENAI_API_KEY and OPENAI_ORG_ID environment variables'
    );
    process.exit(1);
  }

  main().catch((error) => {
    logger.error('Example failed:', error);
    process.exit(1);
  });
} 