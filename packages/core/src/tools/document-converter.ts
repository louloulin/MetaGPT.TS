/**
 * @module DocumentConverter
 * @category Tools
 * 
 * Document conversion tool for transforming between various document formats
 */

import { BaseTool } from './base-tool';
import type { ToolConfig, ToolResult } from '../types/tool';
import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { logger } from '../utils/logger';

// Supported formats and their conversions
const SUPPORTED_FORMATS: Record<string, string[]> = {
  '.md': ['html', 'txt', 'pdf'],
  '.html': ['md', 'txt', 'pdf'],
  '.txt': ['md', 'html'],
  '.json': ['yaml', 'csv', 'md'],
  '.yaml': ['json', 'md'],
  '.csv': ['json', 'md', 'html'],
};

/**
 * Document Converter Tool
 * Provides functionality to convert between different document formats
 */
export class DocumentConverterTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'document_converter',
      description: 'Convert documents between different formats',
      version: '1.0.0',
      category: 'document',
      ...config,
    });
  }

  /**
   * Execute the document conversion
   * @param args Execution parameters
   * @returns Execution result
   */
  async execute(args?: Record<string, any>): Promise<ToolResult> {
    try {
      // Validate input parameters
      if (!args?.inputPath) {
        return this.createResult(false, 'Input path is required');
      }

      if (!args?.outputFormat) {
        return this.createResult(false, 'Output format is required');
      }

      // Get input and output paths
      const inputPath = args.inputPath as string;
      const outputFormat = (args.outputFormat as string).toLowerCase();
      const outputPath = args.outputPath as string || this.generateOutputPath(inputPath, outputFormat);

      // Check if the input file exists
      try {
        await fs.access(inputPath);
      } catch (error) {
        return this.createResult(false, `Input file does not exist: ${inputPath}`);
      }

      // Get input format
      const inputFormat = extname(inputPath).toLowerCase().substring(1);

      // Check if the conversion is supported
      if (!this.isConversionSupported(inputFormat, outputFormat)) {
        return this.createResult(
          false, 
          `Conversion from ${inputFormat} to ${outputFormat} is not supported`
        );
      }

      // Perform the conversion
      const result = await this.convertDocument(inputPath, outputPath, inputFormat, outputFormat);
      
      if (result.success) {
        return this.createResult(
          true, 
          `Document converted successfully from ${inputFormat} to ${outputFormat}`,
          { outputPath }
        );
      } else {
        return result;
      }
    } catch (error) {
      await this.handleError(error as Error);
      return this.createResult(
        false,
        `Document conversion failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Generate output path based on input path and output format
   * @param inputPath Input file path
   * @param outputFormat Desired output format
   * @returns Generated output path
   */
  private generateOutputPath(inputPath: string, outputFormat: string): string {
    const dir = dirname(inputPath);
    const baseName = inputPath.substring(0, inputPath.lastIndexOf('.'));
    return `${baseName}.${outputFormat}`;
  }

  /**
   * Check if conversion between formats is supported
   * @param inputFormat Input format
   * @param outputFormat Output format
   * @returns True if conversion is supported
   */
  private isConversionSupported(inputFormat: string, outputFormat: string): boolean {
    const inputExt = inputFormat.startsWith('.') ? inputFormat : `.${inputFormat}`;
    return SUPPORTED_FORMATS[inputExt]?.includes(outputFormat) || false;
  }

  /**
   * Convert document from one format to another
   * @param inputPath Input file path
   * @param outputPath Output file path
   * @param inputFormat Input format
   * @param outputFormat Output format
   * @returns Conversion result
   */
  private async convertDocument(
    inputPath: string,
    outputPath: string,
    inputFormat: string,
    outputFormat: string
  ): Promise<ToolResult> {
    try {
      // Read input file
      const content = await fs.readFile(inputPath, 'utf-8');

      // Ensure output directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });

      // Perform conversion based on formats
      let convertedContent: string;

      // MD to HTML conversion
      if (inputFormat === 'md' && outputFormat === 'html') {
        convertedContent = this.markdownToHtml(content);
      }
      // HTML to MD conversion
      else if (inputFormat === 'html' && outputFormat === 'md') {
        convertedContent = this.htmlToMarkdown(content);
      }
      // JSON to YAML conversion
      else if (inputFormat === 'json' && outputFormat === 'yaml') {
        convertedContent = this.jsonToYaml(content);
      }
      // YAML to JSON conversion
      else if (inputFormat === 'yaml' && outputFormat === 'json') {
        convertedContent = this.yamlToJson(content);
      }
      // CSV to JSON conversion
      else if (inputFormat === 'csv' && outputFormat === 'json') {
        convertedContent = this.csvToJson(content);
      }
      // JSON to CSV conversion
      else if (inputFormat === 'json' && outputFormat === 'csv') {
        convertedContent = this.jsonToCsv(content);
      }
      // Text conversions
      else if (outputFormat === 'txt') {
        convertedContent = this.toPlainText(content, inputFormat);
      }
      else {
        return this.createResult(
          false,
          `Conversion implementation from ${inputFormat} to ${outputFormat} is not available`,
        );
      }

      // Write output file
      await fs.writeFile(outputPath, convertedContent, 'utf-8');

      return this.createResult(true, 'Conversion successful', { outputPath });
    } catch (error) {
      return this.createResult(
        false,
        `Conversion failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  // Conversion Methods

  /**
   * Convert Markdown to HTML
   */
  private markdownToHtml(markdown: string): string {
    // Basic Markdown to HTML conversion
    // Replace headers
    let html = markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
      .replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    
    // Replace bold/italic
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>')
      .replace(/\_(.*?)\_/g, '<em>$1</em>');

    // Replace links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    
    // Replace lists
    html = html
      .replace(/^\s*\-\s(.*$)/gm, '<li>$1</li>')
      .replace(/^\s*\*\s(.*$)/gm, '<li>$1</li>')
      .replace(/^\s*\d+\.\s(.*$)/gm, '<li>$1</li>');
    
    // Replace paragraphs
    html = html.replace(/^(?!<[a-z])(.*$)/gm, '<p>$1</p>');
    
    // Wrap in HTML document
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Converted Document</title>
</head>
<body>
${html}
</body>
</html>`;
  }

  /**
   * Convert HTML to Markdown
   */
  private htmlToMarkdown(html: string): string {
    // Basic HTML to Markdown conversion
    let markdown = html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<h4>(.*?)<\/h4>/g, '#### $1\n\n')
      .replace(/<h5>(.*?)<\/h5>/g, '##### $1\n\n')
      .replace(/<h6>(.*?)<\/h6>/g, '###### $1\n\n');
    
    // Replace bold/italic
    markdown = markdown
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<i>(.*?)<\/i>/g, '*$1*');
    
    // Replace links
    markdown = markdown.replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');
    
    // Replace lists
    markdown = markdown
      .replace(/<li>(.*?)<\/li>/g, '- $1\n')
      .replace(/<ul>(.*?)<\/ul>/gs, '$1\n')
      .replace(/<ol>(.*?)<\/ol>/gs, '$1\n');
    
    // Replace paragraphs
    markdown = markdown
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n');
    
    // Remove tags
    markdown = markdown
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n');
    
    return markdown.trim();
  }

  /**
   * Convert JSON to YAML
   */
  private jsonToYaml(json: string): string {
    try {
      const obj = JSON.parse(json);
      return this.objectToYaml(obj);
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Convert JavaScript object to YAML
   */
  private objectToYaml(obj: any, indent: number = 0): string {
    const space = ' '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          yaml += `${space}- \n${this.objectToYaml(item, indent + 2)}`;
        } else {
          yaml += `${space}- ${item}\n`;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          yaml += `${space}${key}:\n${this.objectToYaml(value, indent + 2)}`;
        } else {
          yaml += `${space}${key}: ${value}\n`;
        }
      }
    } else {
      yaml += `${obj}\n`;
    }

    return yaml;
  }

  /**
   * Convert YAML to JSON
   */
  private yamlToJson(yaml: string): string {
    // Simple YAML to JSON conversion
    // This is a basic implementation that handles only simple YAML structures
    const lines = yaml.split('\n');
    const obj: Record<string, any> = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();
        obj[key] = value;
      }
    }
    
    return JSON.stringify(obj, null, 2);
  }

  /**
   * Convert CSV to JSON
   */
  private csvToJson(csv: string): string {
    const lines = csv.split('\n');
    if (lines.length === 0) return '[]';
    
    const headers = lines[0].split(',').map(header => header.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(value => value.trim());
      const obj: Record<string, any> = {};
      
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }
      
      result.push(obj);
    }
    
    return JSON.stringify(result, null, 2);
  }

  /**
   * Convert JSON to CSV
   */
  private jsonToCsv(json: string): string {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data) || data.length === 0) {
        return '';
      }
      
      const headers = Object.keys(data[0]);
      let csv = headers.join(',') + '\n';
      
      for (const item of data) {
        const values = headers.map(header => {
          const value = item[header] || '';
          // Escape quotes and handle commas in values
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csv += values.join(',') + '\n';
      }
      
      return csv;
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Convert content to plain text
   */
  private toPlainText(content: string, inputFormat: string): string {
    // Convert to plain text based on input format
    if (inputFormat === 'md') {
      // Remove markdown formatting
      return content
        .replace(/^#+\s+/gm, '') // Headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)') // Links
        .replace(/^\s*[\*\-]\s+/gm, '- ') // Lists
        .replace(/^\s*\d+\.\s+/gm, '- '); // Numbered lists
    }
    
    if (inputFormat === 'html') {
      // Remove HTML tags
      return content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }
    
    // By default, return as is
    return content;
  }

  /**
   * Custom error handling
   */
  async handleError(error: Error): Promise<void> {
    await super.handleError(error);
    logger.error(`Document conversion error: ${error.message}`);
    this.setState('lastError', error.message);
    this.setState('errorTimestamp', new Date().toISOString());
  }

  /**
   * Get help information
   */
  getHelp(): string {
    return `
Tool: ${this.name} (v${this.version})
Category: ${this.category}
Description: ${this.description}

Arguments:
- inputPath: Path to the input document (required)
- outputFormat: Desired output format (required)
- outputPath: Path to save the output document (optional)

Supported Conversions:
- Markdown (.md) to: HTML, TXT, PDF
- HTML (.html) to: Markdown, TXT, PDF 
- Plain Text (.txt) to: Markdown, HTML
- JSON (.json) to: YAML, CSV, Markdown
- YAML (.yaml) to: JSON, Markdown
- CSV (.csv) to: JSON, Markdown, HTML

Examples:
1. Convert Markdown to HTML:
   { inputPath: '/path/to/document.md', outputFormat: 'html' }

2. Convert JSON to YAML with custom output path:
   { inputPath: '/path/to/data.json', outputFormat: 'yaml', outputPath: '/path/to/output.yaml' }

3. Convert HTML to plain text:
   { inputPath: '/path/to/page.html', outputFormat: 'txt' }
    `.trim();
  }
} 