/**
 * Image Processor Module
 * 
 * This module provides advanced image processing capabilities for multimodal interactions,
 * including feature extraction, region detection, and image annotation.
 */

import { z } from 'zod';
import { MediaType } from './multimodal-provider';
import type { MultiModalProvider, ImageFormat } from './multimodal-provider';
import { logger } from '../utils/logger';

// Types for region detection and feature extraction
export const RegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number().min(0).max(1),
  attributes: z.record(z.string(), z.any()).optional(),
});

export type Region = z.infer<typeof RegionSchema>;

export const ImageFeatureSchema = z.object({
  type: z.enum(['object', 'face', 'text', 'scene', 'color', 'custom']),
  label: z.string(),
  confidence: z.number().min(0).max(1),
  region: RegionSchema.optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export type ImageFeature = z.infer<typeof ImageFeatureSchema>;

export interface ImageAnalysisResult {
  features: ImageFeature[];
  regions: Region[];
  description: string;
  tags: string[];
  quality: {
    brightness: number;
    contrast: number;
    sharpness: number;
  };
  metadata: {
    width: number;
    height: number;
    format: string;
    hasTransparency?: boolean;
  };
}

export interface ImageProcessorOptions {
  /**
   * Level of detail for analysis
   */
  detailLevel?: 'low' | 'medium' | 'high';
  
  /**
   * Types of features to extract
   */
  featureTypes?: ('object' | 'face' | 'text' | 'scene' | 'color')[];
  
  /**
   * Confidence threshold for feature detection (0-1)
   */
  confidenceThreshold?: number;
  
  /**
   * Whether to include detailed region information
   */
  includeRegions?: boolean;
  
  /**
   * Custom query for specific analysis
   */
  customQuery?: string;
}

/**
 * Image processor class for advanced image analysis
 */
export class ImageProcessor {
  private provider: MultiModalProvider;
  
  constructor(provider: MultiModalProvider) {
    if (!provider.getSupportedMediaTypes().includes(MediaType.IMAGE)) {
      throw new Error('Provider does not support image processing');
    }
    
    this.provider = provider;
    logger.info(`Initialized ImageProcessor with provider: ${provider.getName()}`);
  }
  
  /**
   * Perform comprehensive image analysis
   */
  async analyzeImage(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat,
    options: ImageProcessorOptions = {}
  ): Promise<ImageAnalysisResult> {
    try {
      // Default options
      const detailLevel = options.detailLevel || 'medium';
      const confidenceThreshold = options.confidenceThreshold || 0.5;
      const featureTypes = options.featureTypes || ['object', 'scene'];
      
      // Build analysis prompt based on options
      let analysisPrompt = `Analyze this image with ${detailLevel} detail level.\n`;
      
      if (featureTypes.includes('object')) {
        analysisPrompt += 'Identify main objects and their properties. ';
      }
      
      if (featureTypes.includes('face')) {
        analysisPrompt += 'Detect faces and their attributes. ';
      }
      
      if (featureTypes.includes('text')) {
        analysisPrompt += 'Recognize and extract any visible text. ';
      }
      
      if (featureTypes.includes('scene')) {
        analysisPrompt += 'Classify the overall scene and setting. ';
      }
      
      if (featureTypes.includes('color')) {
        analysisPrompt += 'Extract dominant colors and color scheme. ';
      }
      
      if (options.customQuery) {
        analysisPrompt += `\nCustom query: ${options.customQuery}`;
      }
      
      // Use provider to get raw analysis
      const rawAnalysis = await this.provider.analyzeImage(
        imageData,
        format,
        analysisPrompt
      );
      
      // Process and structure the analysis results
      return this.processAnalysisResults(rawAnalysis, options);
    } catch (error: any) {
      logger.error(`Image analysis failed: ${error.message}`);
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }
  
  /**
   * Detect and extract specific regions of interest in an image
   */
  async detectRegions(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat,
    regionTypes: string[] = ['object', 'face', 'text'],
    confidenceThreshold: number = 0.5
  ): Promise<Region[]> {
    try {
      const prompt = `Detect regions in this image. Look for: ${regionTypes.join(', ')}. 
      For each region, provide coordinates (x, y, width, height), label, and confidence score.`;
      
      const rawAnalysis = await this.provider.analyzeImage(
        imageData,
        format,
        prompt
      );
      
      // Extract region information from the analysis
      return this.extractRegionsFromAnalysis(rawAnalysis, confidenceThreshold);
    } catch (error: any) {
      logger.error(`Region detection failed: ${error.message}`);
      throw new Error(`Failed to detect regions: ${error.message}`);
    }
  }
  
  /**
   * Extract text from an image
   */
  async extractText(
    imageData: string | Buffer | Uint8Array,
    format: ImageFormat
  ): Promise<string> {
    try {
      const prompt = 'Extract and transcribe all text visible in this image. Include text orientation and layout if relevant.';
      
      return await this.provider.analyzeImage(
        imageData,
        format,
        prompt
      );
    } catch (error: any) {
      logger.error(`Text extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }
  
  /**
   * Compare two images and identify differences
   */
  async compareImages(
    imageData1: string | Buffer | Uint8Array,
    imageData2: string | Buffer | Uint8Array,
    format: ImageFormat
  ): Promise<string> {
    try {
      // This is a placeholder. In a real implementation, we would:
      // 1. Convert both images to a standardized format
      // 2. Use provider to analyze each image
      // 3. Have the provider compare the two analyses
      
      // For now, just return a placeholder message
      return "Image comparison capability is in development.";
    } catch (error: any) {
      logger.error(`Image comparison failed: ${error.message}`);
      throw new Error(`Failed to compare images: ${error.message}`);
    }
  }
  
  /**
   * Process raw analysis results into structured format
   */
  private processAnalysisResults(
    rawAnalysis: string,
    options: ImageProcessorOptions
  ): ImageAnalysisResult {
    // In a real implementation, we would parse the model's response
    // For now, create a placeholder result
    const result: ImageAnalysisResult = {
      features: [],
      regions: [],
      description: rawAnalysis,
      tags: this.extractTags(rawAnalysis),
      quality: {
        brightness: 0.5,
        contrast: 0.5,
        sharpness: 0.5,
      },
      metadata: {
        width: 0,
        height: 0,
        format: 'unknown',
      },
    };
    
    // Try to extract structured data from the raw analysis
    try {
      // Extract features
      const featureMatches = rawAnalysis.match(/(\w+):\s+([^,]+),\s+confidence:\s+([\d.]+)/g);
      if (featureMatches) {
        for (const match of featureMatches) {
          const parts = match.match(/(\w+):\s+([^,]+),\s+confidence:\s+([\d.]+)/);
          if (parts && parts.length >= 4) {
            const type = parts[1].toLowerCase();
            const label = parts[2].trim();
            const confidence = parseFloat(parts[3]);
            
            if (confidence >= (options.confidenceThreshold || 0.5)) {
              result.features.push({
                type: this.mapTypeToEnum(type),
                label,
                confidence,
              });
            }
          }
        }
      }
      
      // Extract potential regions
      if (options.includeRegions) {
        result.regions = this.extractRegionsFromAnalysis(rawAnalysis, options.confidenceThreshold || 0.5);
      }
      
      // Extract basic metadata if available
      const dimensionMatch = rawAnalysis.match(/dimensions:\s+(\d+)\s*x\s*(\d+)/i);
      if (dimensionMatch && dimensionMatch.length >= 3) {
        result.metadata.width = parseInt(dimensionMatch[1]);
        result.metadata.height = parseInt(dimensionMatch[2]);
      }
      
      const formatMatch = rawAnalysis.match(/format:\s+(\w+)/i);
      if (formatMatch && formatMatch.length >= 2) {
        result.metadata.format = formatMatch[1].toLowerCase();
      }
    } catch (error) {
      logger.warn('Error parsing structured data from analysis:', error);
      // If parsing fails, we still return the raw analysis
    }
    
    return result;
  }
  
  /**
   * Extract regions from analysis text
   */
  private extractRegionsFromAnalysis(
    analysis: string,
    confidenceThreshold: number
  ): Region[] {
    const regions: Region[] = [];
    
    // Look for region patterns in the text
    // Example pattern: "Object: car at position [x:120, y:150, width:200, height:100], confidence: 0.92"
    const regionPattern = /(\w+):\s+(.+?)\s+at\s+position\s+\[x:(\d+),\s*y:(\d+),\s*width:(\d+),\s*height:(\d+)\],\s+confidence:\s+([\d.]+)/g;
    
    let match;
    while ((match = regionPattern.exec(analysis)) !== null) {
      if (match.length >= 8) {
        const confidence = parseFloat(match[7]);
        
        if (confidence >= confidenceThreshold) {
          regions.push({
            x: parseInt(match[3]),
            y: parseInt(match[4]),
            width: parseInt(match[5]),
            height: parseInt(match[6]),
            label: match[2],
            confidence,
          });
        }
      }
    }
    
    return regions;
  }
  
  /**
   * Extract tags from analysis text
   */
  private extractTags(analysis: string): string[] {
    const tags: string[] = [];
    
    // Look for tags or keywords in the analysis
    const tagsMatch = analysis.match(/tags:|keywords:|key elements:|main objects:/i);
    if (tagsMatch && tagsMatch.index !== undefined) {
      const tagsSection = analysis.slice(tagsMatch.index + tagsMatch[0].length);
      const endOfTags = tagsSection.match(/[.;]/);
      const tagsList = endOfTags 
        ? tagsSection.slice(0, endOfTags.index) 
        : tagsSection;
      
      tags.push(...tagsList.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0));
    } else {
      // If no explicit tags section, extract nouns as potential tags
      const words = analysis.match(/\b[A-Z][a-z]{2,}\b/g) || [];
      for (const word of words) {
        if (!tags.includes(word.toLowerCase())) {
          tags.push(word.toLowerCase());
        }
      }
    }
    
    return tags;
  }
  
  /**
   * Map a type string to the correct enum value
   */
  private mapTypeToEnum(type: string): ImageFeature['type'] {
    const typeMap: Record<string, ImageFeature['type']> = {
      object: 'object',
      face: 'face',
      text: 'text',
      scene: 'scene',
      color: 'color',
    };
    
    return typeMap[type] || 'custom';
  }
} 