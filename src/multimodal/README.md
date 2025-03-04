# MetaGPT-TS Multimodal System

## Overview

The Multimodal System in MetaGPT-TS enables agents to perceive, process, and generate various types of media content beyond just text. This system expands the capabilities of MetaGPT agents to work with images, audio, and video, creating a more versatile and powerful AI framework.

## Key Features

- **Media Type Support**: Process images, audio, and (in the future) video content
- **Multimodal Roles**: Extend roles with multimodal capabilities using simple mixins
- **Provider Abstraction**: Consistent interface for different multimodal service providers
- **Image Generation**: Generate images from text prompts with control over style and parameters
- **Image Editing**: Edit images with inpainting, variations, and format conversion
- **Caching System**: Efficient caching of analysis results to reduce redundant processing
- **Memory System**: Store and retrieve multimodal content with advanced query capabilities

## Architecture

The Multimodal System consists of the following components:

1. **MultiModalProvider Interface**: Defines the contract for multimodal service providers
2. **Provider Implementations**: Concrete providers for different services (e.g., StabilityAI)
3. **MultiModalRoleMixin**: Extends standard roles with multimodal capabilities
4. **ImageProcessor**: Handles advanced image processing operations
5. **ImageGenerator**: Generates and edits images based on text prompts
6. **MultimodalCache**: Caches analysis results to improve efficiency
7. **MultimodalMemory**: Stores and retrieves multimodal content

## Providers

### StabilityAI Provider

The `StabilityMultiModalProvider` integrates with Stability AI's API to provide image generation capabilities:

- Text-to-image generation with customizable parameters
- Support for different engines and models
- Style control and negative prompts
- Placeholder implementations for image analysis

### Adding New Providers

To add a new multimodal provider:

1. Create a new class that implements the `MultiModalProvider` interface
2. Implement the required methods for your specific provider
3. Handle provider-specific authentication and API calls

## Usage Examples

### Basic Usage with Multimodal Role

```typescript
import { StabilityMultiModalProvider } from './multimodal/providers/stability-provider';
import { MultiModalRoleMixin } from './multimodal/multimodal-role';
import { Role } from './role';

// Create a base role
const baseRole = new Role({
  name: 'Artist',
  description: 'I am an AI artist that can create beautiful images.',
});

// Create a provider
const provider = new StabilityMultiModalProvider({
  apiKey: 'YOUR_STABILITY_API_KEY',
});

// Extend the role with multimodal capabilities
const multimodalRole = MultiModalRoleMixin(baseRole, {
  provider,
  model: 'stable-diffusion-xl-1024-v1-0',
});

// Now use the multimodal role
const response = await multimodalRole.chat('Please create an image of a futuristic city.');
```

### Image Generation Example

```typescript
import { StabilityMultiModalProvider } from './multimodal/providers/stability-provider';
import { ImageGenerator } from './multimodal/image-generator';
import * as fs from 'fs/promises';

async function generateImage() {
  // Create a provider
  const provider = new StabilityMultiModalProvider({
    apiKey: 'YOUR_STABILITY_API_KEY',
  });
  
  // Create image generator
  const generator = new ImageGenerator(provider);
  
  // Generate an image
  const result = await generator.generateImage({
    prompt: 'A serene landscape with mountains and a lake at sunset',
    width: 1024,
    height: 768,
    style: 'photographic',
    styleStrength: 0.7,
  });
  
  // Save the image
  await fs.writeFile('generated-image.png', result.imageData);
  console.log('Image generated with metadata:', result.metadata);
}
```

## Image Processing and Generation

The system includes two main components for working with images:

### ImageProcessor

The `ImageProcessor` class provides advanced image analysis capabilities:

- Feature extraction and recognition
- Region detection and classification
- Text extraction from images
- Image comparison and similarity

### ImageGenerator

The `ImageGenerator` class provides image generation and editing capabilities:

- Text-to-image generation with style control
- Image editing with prompts
- Inpainting (replacing portions of images)
- Generating variations of existing images
- Image format conversion

## Multimodal Memory

The `MultimodalMemory` system provides storage and retrieval for multimodal content:

- Store different types of media (text, images, mixed)
- Query by modality, time range, tags, or importance
- Associate related memories
- Apply time-based decay
- Consolidate important memories

## Cache System

The `MultimodalCache` improves efficiency by caching analysis results:

- Configurable cache size and TTL (time-to-live)
- Multiple eviction policies (LRU, LFU, FIFO)
- Optional persistence to disk
- Cache statistics and performance monitoring

## Best Practices

1. **Provider Selection**: Choose the appropriate provider based on your specific needs (image quality, cost, etc.)
2. **Caching Strategy**: Configure caching appropriately for your workload to balance performance and resource usage
3. **Error Handling**: Always handle errors gracefully as external API calls may fail
4. **Resource Management**: Be mindful of API rate limits and costs when using external providers
5. **Privacy Considerations**: Be aware of data privacy implications when processing user-provided media

## Limitations and Future Work

Current limitations:

- Limited support for audio and video processing
- Some providers have simulated functionality for demonstration purposes
- Not all features are available in all providers

Future plans:

- Add more provider implementations (OpenAI, Google, etc.)
- Enhance audio and video processing capabilities
- Implement more advanced memory and reasoning with multimodal content
- Add support for multimodal embeddings and vector search

## Contributing

We welcome contributions to the Multimodal System! Areas that would benefit from community contributions:

- Additional provider implementations
- Enhanced media processing algorithms
- Testing and performance optimization
- Documentation and examples 