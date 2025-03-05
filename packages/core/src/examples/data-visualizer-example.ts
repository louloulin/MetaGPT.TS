/**
 * @module DataVisualizerExample
 * @category Examples
 * 
 * Example demonstrating how to use the DataVisualizerTool for different types of visualizations
 */

import { DataVisualizerTool } from '../tools/data-visualizer';
import { ToolRegistry } from '../tools/tool-registry';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

/**
 * Run the data visualization example
 */
export async function runDataVisualizerExample(): Promise<void> {
  logger.info('Starting Data Visualizer example...');
  
  // Create a results directory for our visualizations
  const resultsDir = path.join(process.cwd(), 'results', 'visualizations');
  await fs.mkdir(resultsDir, { recursive: true });
  
  // Create and register the data visualizer tool
  const visualizer = new DataVisualizerTool();
  const registry = ToolRegistry.getInstance();
  registry.register(visualizer);
  
  try {
    // Example 1: Simple Bar Chart
    logger.info('Generating simple bar chart...');
    const barChartResult = await registry.executeTool('data_visualizer', {
      data: [23, 45, 67, 89, 34],
      chartType: 'bar',
      title: 'Simple Bar Chart',
      xAxis: { 
        title: 'Categories',
        categories: ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'] 
      },
      yAxis: { title: 'Values' },
      outputPath: path.join(resultsDir, 'simple-bar-chart.html')
    });
    
    if (barChartResult.success) {
      logger.info(`Bar chart generated successfully: ${barChartResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate bar chart: ${barChartResult.message}`);
    }
    
    // Example 2: Multi-series Line Chart from Object Data
    logger.info('Generating multi-series line chart...');
    const lineChartData = [
      { month: 'Jan', sales: 120, customers: 45, profit: 34 },
      { month: 'Feb', sales: 150, customers: 52, profit: 42 },
      { month: 'Mar', sales: 200, customers: 65, profit: 55 },
      { month: 'Apr', sales: 180, customers: 62, profit: 48 },
      { month: 'May', sales: 240, customers: 80, profit: 70 },
      { month: 'Jun', sales: 280, customers: 95, profit: 85 }
    ];
    
    const lineChartResult = await registry.executeTool('data_visualizer', {
      data: lineChartData,
      chartType: 'line',
      title: 'Monthly Performance Metrics',
      xAxis: { 
        title: 'Month',
        categories: lineChartData.map(d => d.month)
      },
      yAxis: { title: 'Value' },
      xField: 'month',
      outputPath: path.join(resultsDir, 'multi-series-line-chart.html')
    });
    
    if (lineChartResult.success) {
      logger.info(`Line chart generated successfully: ${lineChartResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate line chart: ${lineChartResult.message}`);
    }
    
    // Example 3: Pie Chart
    logger.info('Generating pie chart...');
    const pieChartData = {
      'Products': 35,
      'Services': 45,
      'Consulting': 20
    };
    
    const pieChartResult = await registry.executeTool('data_visualizer', {
      data: pieChartData,
      chartType: 'pie',
      title: 'Revenue Distribution',
      theme: 'dark',
      outputPath: path.join(resultsDir, 'pie-chart.html')
    });
    
    if (pieChartResult.success) {
      logger.info(`Pie chart generated successfully: ${pieChartResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate pie chart: ${pieChartResult.message}`);
    }
    
    // Example 4: Using SVG format
    logger.info('Generating SVG bar chart...');
    const svgChartResult = await registry.executeTool('data_visualizer', {
      data: [240, 180, 320, 250, 400],
      chartType: 'bar',
      title: 'SVG Bar Chart Example',
      xAxis: { 
        title: 'Region',
        categories: ['North', 'South', 'East', 'West', 'Central'] 
      },
      outputFormat: 'svg',
      outputPath: path.join(resultsDir, 'bar-chart.svg')
    });
    
    if (svgChartResult.success) {
      logger.info(`SVG chart generated successfully: ${svgChartResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate SVG chart: ${svgChartResult.message}`);
    }
    
    // Example 5: JSON configuration output
    logger.info('Generating JSON configuration...');
    const jsonConfigResult = await registry.executeTool('data_visualizer', {
      data: [
        { quarter: 'Q1', revenue: 1200000, expenses: 950000 },
        { quarter: 'Q2', revenue: 1500000, expenses: 1100000 },
        { quarter: 'Q3', revenue: 1800000, expenses: 1250000 },
        { quarter: 'Q4', revenue: 2200000, expenses: 1500000 }
      ],
      chartType: 'area',
      title: 'Quarterly Financial Performance',
      xAxis: { 
        title: 'Quarter',
      },
      yAxis: { 
        title: 'Amount ($)',
      },
      xField: 'quarter',
      outputFormat: 'json',
      outputPath: path.join(resultsDir, 'financial-chart-config.json')
    });
    
    if (jsonConfigResult.success) {
      logger.info(`JSON configuration generated successfully: ${jsonConfigResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate JSON configuration: ${jsonConfigResult.message}`);
    }
    
    // Example 6: Temperature heatmap
    logger.info('Generating heatmap...');
    
    // Generate some sample temperature data
    const tempData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const times = ['Morning', 'Noon', 'Evening', 'Night'];
    
    for (const time of times) {
      const row: Record<string, any> = { time };
      for (const day of days) {
        // Random temperature between 50 and 90
        row[day] = Math.floor(Math.random() * 40) + 50;
      }
      tempData.push(row);
    }
    
    const heatmapResult = await registry.executeTool('data_visualizer', {
      data: tempData,
      chartType: 'heatmap',
      title: 'Weekly Temperature Heatmap',
      xField: 'time',
      outputPath: path.join(resultsDir, 'temperature-heatmap.html')
    });
    
    if (heatmapResult.success) {
      logger.info(`Heatmap generated successfully: ${heatmapResult.data?.outputPath}`);
    } else {
      logger.error(`Failed to generate heatmap: ${heatmapResult.message}`);
    }
    
    logger.info('Data Visualizer examples completed successfully.');
    logger.info(`All visualizations can be found in: ${resultsDir}`);
    
  } catch (error) {
    logger.error(`Error in data visualizer example: ${(error as Error).message}`);
  } finally {
    // Clean up - unregister the tool
    registry.unregister('data_visualizer');
  }
}

// Run the example if this script is executed directly
if (require.main === module) {
  runDataVisualizerExample().catch(err => {
    logger.error('Failed to run example:', err);
    process.exit(1);
  });
} 