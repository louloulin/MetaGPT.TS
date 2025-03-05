/**
 * @module DataVisualizer
 * @category Tools
 * 
 * Data visualization tool for generating charts and graphs from various data sources
 */

import { BaseTool } from './base-tool';
import type { ToolConfig, ToolResult } from '../types/tool';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// Supported chart types
export type ChartType = 
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'radar'
  | 'heatmap'
  | 'table';

// Supported output formats
export type OutputFormat = 
  | 'svg'
  | 'png'
  | 'html'
  | 'json';

// Chart configuration
export interface ChartConfig {
  type: ChartType;
  title?: string;
  xAxis?: {
    title?: string;
    categories?: string[];
  };
  yAxis?: {
    title?: string;
    min?: number;
    max?: number;
  };
  series: Array<{
    name: string;
    data: number[] | Array<[number, number]> | Array<{x: number, y: number}>;
    color?: string;
  }>;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark' | 'custom';
  customColors?: string[];
  legend?: boolean;
  grid?: boolean;
}

/**
 * Data Visualizer Tool
 * Generates charts and visualizations from data
 */
export class DataVisualizerTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'data_visualizer',
      description: 'Generate charts and visualizations from data',
      version: '1.0.0',
      category: 'data_analysis',
      ...config,
    });
  }

  /**
   * Execute the visualization generation
   * @param args Execution parameters
   * @returns Execution result
   */
  async execute(args?: Record<string, any>): Promise<ToolResult> {
    try {
      // Validate input parameters
      if (!args?.data && !args?.dataPath) {
        return this.createResult(false, 'Either data or dataPath must be provided');
      }

      if (!args?.chartType) {
        return this.createResult(false, 'Chart type is required');
      }

      // Get the chart type
      const chartType = args.chartType as ChartType;
      if (!this.isValidChartType(chartType)) {
        return this.createResult(false, `Invalid chart type: ${chartType}`);
      }

      // Get output format and path
      const outputFormat = (args.outputFormat as OutputFormat) || 'html';
      if (!this.isValidOutputFormat(outputFormat)) {
        return this.createResult(false, `Invalid output format: ${outputFormat}`);
      }

      const outputPath = args.outputPath as string || this.generateOutputPath(chartType, outputFormat);

      // Get the data
      let data: any;
      if (args.data) {
        data = args.data;
      } else if (args.dataPath) {
        try {
          const dataContent = await fs.readFile(args.dataPath as string, 'utf-8');
          const fileExt = path.extname(args.dataPath as string).toLowerCase();
          
          if (fileExt === '.json') {
            data = JSON.parse(dataContent);
          } else if (fileExt === '.csv') {
            data = this.parseCSV(dataContent);
          } else {
            return this.createResult(false, `Unsupported data file format: ${fileExt}`);
          }
        } catch (error) {
          return this.createResult(
            false, 
            `Failed to read data file: ${(error as Error).message}`,
            undefined,
            error
          );
        }
      }

      // Build chart configuration
      const chartConfig: ChartConfig = {
        type: chartType,
        title: args.title as string,
        xAxis: args.xAxis,
        yAxis: args.yAxis,
        series: this.buildSeries(data, args),
        width: args.width as number || 800,
        height: args.height as number || 500,
        theme: args.theme as ('light' | 'dark' | 'custom') || 'light',
        customColors: args.customColors as string[],
        legend: args.legend as boolean ?? true,
        grid: args.grid as boolean ?? true,
      };

      // Generate the visualization
      const result = await this.generateVisualization(chartConfig, outputFormat, outputPath);
      
      if (result.success) {
        return this.createResult(
          true, 
          `Visualization generated successfully`,
          { outputPath, ...result.data }
        );
      } else {
        return result;
      }
    } catch (error) {
      await this.handleError(error as Error);
      return this.createResult(
        false,
        `Visualization generation failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Check if the chart type is valid
   */
  private isValidChartType(type: string): type is ChartType {
    return ['bar', 'line', 'pie', 'scatter', 'area', 'radar', 'heatmap', 'table'].includes(type);
  }

  /**
   * Check if the output format is valid
   */
  private isValidOutputFormat(format: string): format is OutputFormat {
    return ['svg', 'png', 'html', 'json'].includes(format);
  }

  /**
   * Generate default output path
   */
  private generateOutputPath(chartType: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(process.cwd(), `chart-${chartType}-${timestamp}.${format}`);
  }

  /**
   * Parse CSV data into JSON
   */
  private parseCSV(csvContent: string): any[] {
    const lines = csvContent.split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(header => header.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(value => value.trim());
      const obj: Record<string, any> = {};
      
      for (let j = 0; j < headers.length; j++) {
        // Try to convert to number if possible
        const numValue = Number(values[j]);
        obj[headers[j]] = !isNaN(numValue) ? numValue : values[j] || '';
      }
      
      result.push(obj);
    }
    
    return result;
  }

  /**
   * Build series data from input
   */
  private buildSeries(data: any, args: Record<string, any>): ChartConfig['series'] {
    // If series is already defined in the arguments, use that
    if (args.series) {
      return args.series;
    }

    // Otherwise, try to generate series from the data
    const series: ChartConfig['series'] = [];
    
    if (Array.isArray(data)) {
      // Handle array data
      if (data.length > 0 && typeof data[0] === 'object') {
        // Extract keys for series names (excluding the x-axis field)
        const xField = args.xField || 'x';
        const seriesFields = Object.keys(data[0]).filter(key => key !== xField);
        
        for (const field of seriesFields) {
          series.push({
            name: field,
            data: data.map(item => item[field])
          });
        }
      } else {
        // Simple array - use as single series
        series.push({
          name: args.seriesName || 'Data',
          data: data
        });
      }
    } else if (typeof data === 'object') {
      // Handle object data - keys as categories, values as data points
      const categories = Object.keys(data);
      const values = categories.map(key => data[key]);
      
      series.push({
        name: args.seriesName || 'Data',
        data: values
      });
    }
    
    return series;
  }

  /**
   * Generate the visualization based on chart configuration
   */
  private async generateVisualization(
    chartConfig: ChartConfig, 
    outputFormat: OutputFormat,
    outputPath: string
  ): Promise<ToolResult> {
    try {
      // Create directories if they don't exist
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Generate the appropriate visualization
      let content: string = '';
      
      if (outputFormat === 'html') {
        content = this.generateHtmlChart(chartConfig);
      } else if (outputFormat === 'svg') {
        content = this.generateSvgChart(chartConfig);
      } else if (outputFormat === 'json') {
        content = JSON.stringify(chartConfig, null, 2);
      } else if (outputFormat === 'png') {
        // For the sake of this implementation, generate HTML and indicate
        // that a real implementation would convert to PNG
        content = this.generateHtmlChart(chartConfig);
        logger.warn('PNG generation not fully implemented - outputting HTML content');
      }
      
      // Write the output file
      await fs.writeFile(outputPath, content, 'utf-8');
      
      return this.createResult(true, 'Visualization generated successfully', { 
        outputPath,
        previewHtml: outputFormat === 'html' ? content : undefined 
      });
    } catch (error) {
      return this.createResult(
        false,
        `Failed to generate visualization: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Generate HTML chart
   */
  private generateHtmlChart(config: ChartConfig): string {
    // Generate a simple HTML chart using a JavaScript charting library
    // This is a simplified implementation
    const chartData = JSON.stringify(config);
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.title || 'Chart'}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background-color: ${config.theme === 'dark' ? '#333' : '#fff'};
      color: ${config.theme === 'dark' ? '#fff' : '#333'};
    }
    .chart-container {
      width: ${config.width}px;
      height: ${config.height}px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>${config.title || 'Chart'}</h1>
  <div class="chart-container">
    <canvas id="chart"></canvas>
  </div>
  
  <script>
    // Chart configuration
    const chartData = ${chartData};
    
    // Prepare data for Chart.js
    const data = {
      labels: chartData.xAxis?.categories || [...Array(chartData.series[0].data.length).keys()].map(i => i.toString()),
      datasets: chartData.series.map((series, index) => {
        const colors = chartData.customColors || [
          '#4dc9f6', '#f67019', '#f53794', '#537bc4', '#acc236', '#166a8f', '#00a950', '#58595b', '#8549ba'
        ];
        return {
          label: series.name,
          data: series.data,
          backgroundColor: series.color || colors[index % colors.length],
          borderColor: series.color || colors[index % colors.length],
          fill: chartData.type === 'area',
        };
      })
    };
    
    // Chart.js configuration
    const config = {
      type: chartData.type === 'area' ? 'line' : chartData.type,
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: {
              display: !!chartData.xAxis?.title,
              text: chartData.xAxis?.title || ''
            },
            grid: {
              display: chartData.grid
            }
          },
          y: {
            display: true,
            title: {
              display: !!chartData.yAxis?.title,
              text: chartData.yAxis?.title || ''
            },
            min: chartData.yAxis?.min,
            max: chartData.yAxis?.max,
            grid: {
              display: chartData.grid
            }
          }
        },
        plugins: {
          legend: {
            display: chartData.legend,
            position: 'top',
          }
        }
      }
    };
    
    // Create chart
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, config);
  </script>
</body>
</html>`;
  }

  /**
   * Generate SVG chart
   */
  private generateSvgChart(config: ChartConfig): string {
    // This is a simplified implementation that creates a basic SVG chart
    // A real implementation would use an SVG charting library or create more complex SVG
    
    const width = config.width || 800;
    const height = config.height || 500;
    const padding = 50;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    // Determine max value for scaling
    let maxValue = 0;
    for (const series of config.series) {
      const seriesMax = Array.isArray(series.data) 
        ? Math.max(...(series.data as number[])) 
        : 0;
      maxValue = Math.max(maxValue, seriesMax);
    }
    
    // For simplicity, only implement bar chart in SVG
    if (config.type !== 'bar') {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width/2}" y="30" text-anchor="middle" font-family="Arial" font-size="20">
    ${config.title || 'Chart'} (Only bar charts are supported in SVG output)
  </text>
</svg>`;
    }
    
    // Start SVG
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${config.theme === 'dark' ? '#333' : '#fff'}" />
  <text x="${width/2}" y="30" text-anchor="middle" font-family="Arial" font-size="20" fill="${config.theme === 'dark' ? '#fff' : '#000'}">
    ${config.title || 'Chart'}
  </text>`;
    
    // Y-axis
    svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="${config.theme === 'dark' ? '#fff' : '#000'}" />`;
    
    // X-axis
    svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="${config.theme === 'dark' ? '#fff' : '#000'}" />`;
    
    // Get categories for x-axis
    const categories = config.xAxis?.categories || 
      [...Array(config.series[0].data.length).keys()].map(i => i.toString());
    
    // Draw bars for the first series
    const series = config.series[0];
    const barWidth = chartWidth / (categories.length * 2);
    const data = series.data as number[];
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const x = padding + (i * (chartWidth / categories.length)) + (chartWidth / categories.length / 4);
      const barHeight = (value / maxValue) * chartHeight;
      const y = height - padding - barHeight;
      
      const color = series.color || '#4dc9f6';
      
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" />`;
      
      // Add value label
      svg += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" font-family="Arial" font-size="12" fill="${config.theme === 'dark' ? '#fff' : '#000'}">
    ${value}
  </text>`;
      
      // Add x-axis label
      svg += `<text x="${x + barWidth/2}" y="${height - padding + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="${config.theme === 'dark' ? '#fff' : '#000'}">
    ${categories[i]}
  </text>`;
    }
    
    // Close SVG
    svg += '</svg>';
    
    return svg;
  }

  /**
   * Custom error handling
   */
  async handleError(error: Error): Promise<void> {
    await super.handleError(error);
    logger.error(`Data visualization error: ${error.message}`);
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
- data: Data object or array (required if dataPath not provided)
- dataPath: Path to a data file (JSON or CSV) (required if data not provided)
- chartType: Type of chart to generate (required)
  Options: bar, line, pie, scatter, area, radar, heatmap, table
- outputFormat: Format of the output file (optional, default: html)
  Options: html, svg, png, json
- outputPath: Path to save the output file (optional)
- title: Chart title (optional)
- xAxis: X-axis configuration (optional)
  Properties: title, categories
- yAxis: Y-axis configuration (optional)
  Properties: title, min, max
- series: Series data (optional, will be derived from data if not provided)
- width: Chart width in pixels (optional, default: 800)
- height: Chart height in pixels (optional, default: 500)
- theme: Chart theme (optional, default: light)
  Options: light, dark, custom
- customColors: Array of colors for custom theme (optional)
- legend: Show legend (optional, default: true)
- grid: Show grid lines (optional, default: true)

Examples:
1. Generate a bar chart from inline data:
   {
     data: [10, 20, 30, 40, 50],
     chartType: 'bar',
     title: 'Sample Bar Chart',
     xAxis: { categories: ['A', 'B', 'C', 'D', 'E'] }
   }

2. Generate a line chart from a CSV file:
   {
     dataPath: '/path/to/data.csv',
     chartType: 'line',
     outputFormat: 'html',
     title: 'Data Trends',
     xField: 'date'
   }

3. Generate a pie chart with custom colors:
   {
     data: { 'Category A': 30, 'Category B': 50, 'Category C': 20 },
     chartType: 'pie',
     theme: 'custom',
     customColors: ['#ff6384', '#36a2eb', '#ffce56']
   }
    `.trim();
  }
} 