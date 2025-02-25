/**
 * 任务类型枚举
 */
export enum TaskType {
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  DATA_PREPROCESS = 'DATA_PREPROCESS',
  FEATURE_ENGINEERING = 'FEATURE_ENGINEERING',
  MODEL_TRAIN = 'MODEL_TRAIN',
  MODEL_EVALUATION = 'MODEL_EVALUATION',
  VISUALIZATION = 'VISUALIZATION',
  RECOMMENDATION = 'RECOMMENDATION',
}

/**
 * 任务接口
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * 任务结果接口
 */
export interface TaskResult {
  code: string;
  result: string;
  isSuccess: boolean;
} 