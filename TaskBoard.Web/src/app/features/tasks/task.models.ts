export interface Task {
  id: number;
  title: string;
  isDone: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
}

export interface CreateTaskRequest {
  title: string;
}

export interface UpdateTaskRequest {
  title: string;
  isDone: boolean;
}

export type TaskStatusFilter = 'all' | 'pending' | 'done';

export type StatsPeriod = 'week' | 'month';

export interface DailyTime {
  date: string; // "yyyy-MM-dd", día LOCAL
  seconds: number;
}

export interface TaskTimeStats {
  period: StatsPeriod;
  from: string;
  to: string;
  totalSeconds: number;
  previousTotalSeconds: number;
  activeDays: number;
  days: DailyTime[];
}