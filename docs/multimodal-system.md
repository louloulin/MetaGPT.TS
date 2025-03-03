# Multimodal System

This document provides an overview of the multimodal capabilities in MetaGPT TypeScript. The multimodal system allows MetaGPT to work with different types of media, including images, audio, and potentially video, in addition to text.

## Overview

The multimodal system consists of several components:

1. **MultiModalProvider Interface**: Defines a standard interface for different multimodal service providers
2. **Provider Implementations**: Concrete implementations for specific services (e.g., OpenAI's GPT-4 Vision)
3. **MultiModalRole Integration**: Allows roles to process and generate multimodal content
4. **Type Definitions**: Strong typing for multimodal content and messages

## Features

- **Image processing and analysis**
- **Audio transcription and analysis**
- **Multimodal conversation support**
- **Provider-agnostic interface**
- **Streaming response support**
- **Role integration via mixin pattern**

## Usage

### Basic Image Analysis

```typescript
import { OpenAIMultiModalProvider } from '../src/multimodal/providers/openai-multimodal-provider';
import { ImageFormat } from '../src/multimodal/multimodal-provider';

// Create a multimodal provider
const provider = new OpenAIMultiModalProvider('your-api-key');

// Analyze an image
const analysis = await provider.analyzeImage(
  'path/to/image.jpg',
  ImageFormat.JPEG,
  'Describe what you see in this image in detail.'
);

console.log(analysis);
```

### Creating a Multimodal Role

```typescript
import { Role } from '../src/roles/role';
import { OpenAIMultiModalProvider } from '../src/multimodal/providers/openai-multimodal-provider';
import { createMultiModalRole } from '../src/multimodal/multimodal-role';

// Create a multimodal provider
const provider = new OpenAIMultiModalProvider('your-api-key');

// Create a multimodal-capable role class
const MultiModalAssistant = createMultiModalRole(Role, {
  provider: provider,
  model: 'gpt-4-vision-preview',
  temperature: 0.7,
});

// Create an instance of the multimodal role
const assistant = new MultiModalAssistant({
  name: 'ImageExpert',
  profile: 'an AI assistant that can analyze images',
  goal: 'To help users understand images',
  constraints: 'I can only analyze images that are provided to me',
});

// Process an image
const analysis = await assistant.processImage(
  'path/to/image.jpg',
  ImageFormat.JPEG
);
```

### Multimodal Conversations

```typescript
import { MediaType, ImageFormat } from '../src/multimodal/multimodal-provider';

// Generate a response to a multimodal query
const response = await assistant.generateMultiModalResponse({
  text: 'What can you tell me about this logo?',
  media: [
    {
      type: MediaType.IMAGE,
      data: 'https://example.com/logo.png',
      format: ImageFormat.PNG,
    },
  ],
});

// Generate a streaming response
for await (const chunk of assistant.generateMultiModalResponseStream({
  text: 'Analyze this chart and explain the trends.',
  media: [
    {
      type: MediaType.IMAGE,
      data: imageBuffer, // Can be a Buffer, Uint8Array, URL, or file path
      format: ImageFormat.PNG,
    },
  ],
})) {
  process.stdout.write(chunk);
}
```

## Supported Media Types

The multimodal system currently supports the following media types:

### Images
- PNG
- JPEG
- GIF
- WEBP

### Audio
- MP3
- WAV
- OGG

### Video (Limited support)
- MP4
- WEBM

## Supported Providers

Currently, the system includes implementations for:

- **OpenAI**: Supports GPT-4 Vision, GPT-4o, and other multimodal models
- (More providers will be added in future updates)

## Implementation Details

### MultiModalProvider Interface

The `MultiModalProvider` interface defines the contract that all provider implementations must follow. It includes methods for:

- Generating responses to multimodal prompts
- Analyzing images
- Analyzing audio
- Analyzing video

### Role Integration

The multimodal system integrates with MetaGPT's role system through a mixin pattern. The `MultiModalRoleMixin` function adds multimodal capabilities to any role class.

### Media Content Types

Media content is represented using strongly typed interfaces:

```typescript
interface MediaContent {
  type: MediaType;
  data: string | Buffer | Uint8Array;
  format?: ImageFormat | AudioFormat | VideoFormat;
  metadata?: Record<string, any>;
}
```

## Future Enhancements

1. **More Provider Implementations**: Support for Claude, Gemini, and other multimodal models
2. **Enhanced Video Support**: Better handling of video analysis and generation
3. **Media Generation**: Creating images based on text descriptions
4. **Cross-modal Reasoning**: Advanced reasoning across different modalities

## Examples

For complete examples of using the multimodal system, see:

- [multimodal-example.ts](../examples/multimodal-example.ts): Basic usage example
- (More examples will be added) 