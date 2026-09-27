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