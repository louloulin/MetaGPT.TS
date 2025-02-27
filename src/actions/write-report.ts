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
    super({
      name: 'WriteReport',
      ...config,
    });
    this.args = config.args || {};
  }

  private async generateReport(prompt: string): Promise<Report> {
    logger.debug('[WriteReport] Generating report for:', prompt);

    const systemPrompt = `You are a report writing expert. Create a comprehensive report based on the given topic.
The report should include:
1. Executive summary
2. Detailed sections with key points
3. Data and metrics where relevant
4. Conclusions and recommendations
5. Next steps if applicable

Provide your report in a structured JSON format matching the Report interface.`;

    try {
      const response = await this.llm.chat(systemPrompt + "\n\nReport topic: " + prompt);
      const report = JSON.parse(response);

      return {
        title: report.title || 'Untitled Report',
        type: report.type || this.args.report_type || ReportType.SUMMARY,
        format: report.format || this.args.format || ReportFormat.DETAILED,
        executive_summary: report.executive_summary || '',
        date: report.date || new Date().toISOString(),
        author: report.author || this.args.author || 'System Generated',
        recipients: report.recipients || this.args.recipients,
        sections: report.sections || [],
        metrics: report.metrics,
        conclusions: report.conclusions || [],
        recommendations: report.recommendations || [],
        next_steps: report.next_steps,
        appendices: report.appendices
      };
    } catch (error) {
      logger.error('[WriteReport] Error generating report:', error);
      return this.createFallbackReport(prompt);
    }
  }

  private createFallbackReport(prompt: string): Report {
    return {
      title: 'Basic Report',
      type: this.args.report_type || ReportType.SUMMARY,
      format: this.args.format || ReportFormat.DETAILED,
      executive_summary: `Basic report for: ${prompt}`,
      date: new Date().toISOString(),
      author: this.args.author || 'System Generated',
      sections: [
        {
          title: 'Overview',
          content: 'This is a basic report generated due to an error in the report generation process.',
          key_points: ['Report generation encountered an error', 'Basic information is provided']
        }
      ],
      conclusions: ['Further analysis may be required'],
      recommendations: ['Review and regenerate the report with more specific parameters']
    };
  }

  private formatReport(report: Report): string {
    let content = `# ${report.title}

**Type:** ${report.type}
**Format:** ${report.format}
**Date:** ${report.date}
**Author:** ${report.author}
${report.recipients ? `**Recipients:** ${report.recipients.join(', ')}` : ''}

## Executive Summary
${report.executive_summary}

`;

    // Add sections
    report.sections.forEach(section => {
      content += this.formatSection(section, 2);
    });

    // Add metrics if present
    if (report.metrics && report.metrics.length > 0) {
      content += '\n## Key Metrics\n\n';
      report.metrics.forEach(metric => {
        content += `### ${metric.name}
- Value: ${metric.value}${metric.target ? ` (Target: ${metric.target})` : ''}
- Status: ${metric.status}\n\n`;
      });
    }

    // Add conclusions
    if (report.conclusions.length > 0) {
      content += '\n## Conclusions\n';
      report.conclusions.forEach(conclusion => {
        content += `- ${conclusion}\n`;
      });
    }

    // Add recommendations
    if (report.recommendations.length > 0) {
      content += '\n## Recommendations\n';
      report.recommendations.forEach(recommendation => {
        content += `- ${recommendation}\n`;
      });
    }

    // Add next steps if present
    if (report.next_steps && report.next_steps.length > 0) {
      content += '\n## Next Steps\n';
      report.next_steps.forEach(step => {
        content += `- ${step}\n`;
      });
    }

    // Add appendices if present
    if (report.appendices && report.appendices.length > 0) {
      content += '\n## Appendices\n\n';
      report.appendices.forEach(appendix => {
        content += `### ${appendix.title}\n${appendix.content}\n\n`;
      });
    }

    return content;
  }

  private formatSection(section: ReportSection, level: number): string {
    const heading = '#'.repeat(level);
    let content = `\n${heading} ${section.title}\n\n${section.content}\n`;

    if (section.key_points && section.key_points.length > 0) {
      content += '\n**Key Points:**\n';
      section.key_points.forEach(point => {
        content += `- ${point}\n`;
      });
    }

    if (section.data_points && section.data_points.length > 0) {
      content += '\n**Data Points:**\n';
      section.data_points.forEach(point => {
        content += `- ${point.label}: ${point.value}${point.unit ? ` ${point.unit}` : ''}`;
        if (point.trend) {
          content += ` (Trend: ${point.trend}`;
          if (point.change_percentage !== undefined) {
            content += `, Change: ${point.change_percentage}%`;
          }
          content += ')';
        }
        content += '\n';
      });
    }

    if (section.recommendations && section.recommendations.length > 0) {
      content += '\n**Recommendations:**\n';
      section.recommendations.forEach(rec => {
        content += `- ${rec}\n`;
      });
    }

    if (section.references && section.references.length > 0) {
      content += '\n**References:**\n';
      section.references.forEach(ref => {
        content += `- ${ref}\n`;
      });
    }

    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        content += this.formatSection(subsection, level + 1);
      });
    }

    return content;
  }

  public async run(): Promise<ActionOutput> {
    const messages = this.context.memory.getMessages();
    if (messages.length === 0) {
      return {
        status: 'failed',
        content: 'No messages available for report generation'
      };
    }

    const lastMessage = messages[messages.length - 1];
    const report = await this.generateReport(lastMessage.content);
    const formattedReport = this.formatReport(report);

    return {
      status: 'completed',
      content: formattedReport
    };
  }
} 