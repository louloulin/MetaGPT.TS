/**
 * Actions Index
 * This file exports all available actions from the actions directory
 */

export { BaseAction } from './base-action';

// Code and product related actions
export { WriteCodeAction as WriteCode } from './write-code';
// Temporarily commented out due to missing module
export { AnalyzePrompt } from './analyze-prompt';
export { WritePRD } from './write-prd';
export { WriteTutorial } from './write-tutorial';

// Analysis actions
export { AnalyzeTask as AnalyzeTask } from './analyze-task';
export { DesignArchitecture } from './design-architecture';
export { DesignAPI } from './design-api';
export { EvaluateArchitectureAction as  EvaluateArchitecture } from './evaluate-architecture';
export { MapComponents } from './map-components';
export { WriteTestAction as WriteTest } from './write-test';
export { WriteReview as WriteReview } from './write-review';
export { RunCode as RunCode } from './run-code';
export { DebugErrorAction as DebugError } from './debug-error';
export { SummarizeCode as SummarizeCode } from './summarize-code';
export { ComplexReasoning } from './complex-reasoning';

// Information and research actions
export { Research } from './research';
export { SearchAndSummarize } from './search-and-summarize';

// Document actions
export { DocumentGeneration } from './document-generation';
export { WriteReport } from './write-report';
export { WriteRequirements } from './write-requirements';
export { GenerateQuestions } from './generate-questions';
export { PrepareDocuments } from './prepare-documents';

// Project management actions
export { ProjectManagement } from './project-management';
export { FixBug } from './fix-bug';
export { ExecuteTask } from './execute-task';

// Education related actions
export { CreateLesson } from './create-lesson';
export { ExplainConcept } from './explain-concept';
export { AssessUnderstanding } from './assess-understanding';
export { ProvideFeedback } from './provide-feedback'; 