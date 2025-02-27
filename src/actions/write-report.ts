/**
 * WriteReport Action
 * 
 * This action generates various types of reports including project status reports,
 * analysis reports, technical reports, and research summaries. It supports different
 * report formats and can include data visualizations, metrics, and recommendations.
 */

import { BaseAction } from './base-action';
import type { ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

export enum ReportType {
  PROJECT_STATUS = 'PROJECT_STATUS',
  TECHNICAL = 'TECHNICAL',
  ANALYSIS = 'ANALYSIS',
  RESEARCH = 'RESEARCH',
  PERFORMANCE = 'PERFORMANCE',
  INCIDENT = 'INCIDENT',
  COMPLIANCE = 'COMPLIANCE',
  SUMMARY = 'SUMMARY'
}

export enum ReportFormat {
  DETAILED = 'DETAILED',
  EXECUTIVE = 'EXECUTIVE',
  TECHNICAL = 'TECHNICAL',
  PRESENTATION = 'PRESENTATION'
}

export interface DataPoint {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'UP' | 'DOWN' | 'STABLE';
  change_percentage?: number;
}

export interface ReportSection {
  title: string;
  content: string;
  key_points?: string[];
  data_points?: DataPoint[];
  subsections?: ReportSection[];
  recommendations?: string[];
  references?: string[];
}

export interface Report {
  title: string;
  type: ReportType;
  format: ReportFormat;
  executive_summary: string;
  date: string;
  author: string;
  recipients?: string[];
  sections: ReportSection[];
  metrics?: {
    name: string;
    value: number | string;
    target?: number | string;
    status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';
  }[];
  conclusions: string[];
  recommendations: string[];
  next_steps?: string[];
  appendices?: {
    title: string;
    content: string;
  }[];
}

export interface WriteReportArgs {
  report_type?: ReportType;
  format?: ReportFormat;
  author?: string;
  recipients?: string[];
  include_metrics?: boolean;
  include_recommendations?: boolean;
  max_length?: number;
}

export class WriteReport extends BaseAction {
  protected args: WriteReportArgs;

  constructor(config: any) {
    super(config);
    this.args = {
      report_type: config.args?.report_type || ReportType.PROJECT_STATUS,
      format: config.args?.format || ReportFormat.DETAILED,
      author: config.args?.author,
      recipients: config.args?.recipients,
      include_metrics: config.args?.include_metrics ?? true,
      include_recommendations: config.args?.include_recommendations ?? true,
      max_length: config.args?.max_length
    };
  }

  public async run(): Promise<ActionOutput> {
    try {
      // Check if there are any messages
      const messages = this.context?.memory?.get();
      if (!messages || messages.length === 0) {
        return {
          status: 'failed',
          content: 'No messages available for report generation'
        };
      }

      // Generate report based on messages
      const prompt = this.preparePrompt(messages);
      let report: Report;
      
      try {
        report = await this.generateReport(prompt);
      } catch (error) {
        logger.error('Error generating report:', error);
        report = this.createFallbackReport(prompt);
      }

      // Format the report
      const formattedReport = this.formatReport(report);

      return {
        status: 'completed',
        content: formattedReport
      };
    } catch (error) {
      logger.error('Error in WriteReport:', error);
      return {
        status: 'failed',
        content: `Failed to generate report: ${error}`
      };
    }
  }

  private preparePrompt(messages: any[]): string {
    // Extract relevant information from messages
    const messageContent = messages.map(m => m.content).join('\n');
    return `Generate a ${this.args.format} report of type ${this.args.report_type} based on the following information:\n\n${messageContent}`;
  }

  private async generateReport(prompt: string): Promise<Report> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    const response = await this.llm.chat(prompt);
    const report = JSON.parse(response);

    return {
      title: report.title || 'Generated Report',
      type: report.type || this.args.report_type,
      format: report.format || this.args.format,
      executive_summary: report.executive_summary || 'No summary provided',
      date: report.date || new Date().toISOString(),
      author: report.author || this.args.author || 'System Generated',
      sections: report.sections || [],
      conclusions: report.conclusions || [],
      recommendations: report.recommendations || [],
      metrics: report.metrics || []
    };
  }

  private createFallbackReport(prompt: string): Report {
    return {
      title: 'Basic Report',
      type: this.args.report_type || ReportType.PROJECT_STATUS,
      format: this.args.format || ReportFormat.DETAILED,
      executive_summary: `Basic report for: ${prompt}`,
      date: new Date().toISOString(),
      author: this.args.author || 'System Generated',
      sections: [{
        title: 'Overview',
        content: 'This is a basic report generated due to an error in the report generation process.',
        key_points: [
          'Report generation encountered an error',
          'Basic information is provided'
        ]
      }],
      conclusions: ['Further analysis may be required'],
      recommendations: ['Review and regenerate the report with more specific parameters'],
      metrics: []
    };
  }

  private formatReport(report: Report): string {
    let output = `# ${report.title}\n\n`;
    output += `Type: ${report.type}\n`;
    output += `Format: ${report.format}\n`;
    output += `Date: ${report.date}\n`;
    output += `Author: ${report.author}\n\n`;

    if (report.executive_summary) {
      output += `## Executive Summary\n${report.executive_summary}\n\n`;
    }

    // Format sections
    report.sections.forEach(section => {
      output += this.formatSection(section, 2);
    });

    // Add metrics if included
    if (this.args.include_metrics && report.metrics && report.metrics.length > 0) {
      output += `## Key Metrics\n\n`;
      report.metrics.forEach(metric => {
        output += `${metric.name}: ${metric.value}${metric.target ? ` (Target: ${metric.target})` : ''} - ${metric.status}\n\n`;
      });
    }

    // Add conclusions
    if (report.conclusions.length > 0) {
      output += `## Conclusions\n`;
      report.conclusions.forEach(conclusion => {
        output += `- ${conclusion}\n`;
      });
      output += '\n';
    }

    // Add recommendations if included
    if (this.args.include_recommendations && report.recommendations.length > 0) {
      output += `## Recommendations\n`;
      report.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
      });
      output += '\n';
    }

    // Add next steps if available
    if (report.next_steps && report.next_steps.length > 0) {
      output += `## Next Steps\n`;
      report.next_steps.forEach(step => {
        output += `- ${step}\n`;
      });
      output += '\n';
    }

    return output;
  }

  private formatSection(section: ReportSection, level: number): string {
    const heading = '#'.repeat(level);
    let output = `${heading} ${section.title}\n\n`;
    
    if (section.content) {
      output += `${section.content}\n\n`;
    }

    if (section.key_points && section.key_points.length > 0) {
      output += `### Key Points\n`;
      section.key_points.forEach(point => {
        output += `- ${point}\n`;
      });
      output += '\n';
    }

    if (section.data_points && section.data_points.length > 0) {
      output += `### Data Points\n`;
      section.data_points.forEach(dp => {
        let dataPoint = `- ${dp.label}: ${dp.value}`;
        if (dp.unit) dataPoint += ` ${dp.unit}`;
        if (dp.trend) dataPoint += ` (${dp.trend}`;
        if (dp.change_percentage) dataPoint += ` ${dp.change_percentage}%`;
        if (dp.trend) dataPoint += ')';
        output += `${dataPoint}\n`;
      });
      output += '\n';
    }

    if (section.subsections) {
      section.subsections.forEach(subsection => {
        output += this.formatSection(subsection, level + 1);
      });
    }

    if (section.recommendations && section.recommendations.length > 0) {
      output += `### Recommendations\n`;
      section.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
      });
      output += '\n';
    }

    return output;
  }
} 