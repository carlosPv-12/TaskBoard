import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTaskRequest, Task, TimeEntry, UpdateTaskRequest, TaskTimeStats, StatsPeriod } from './task.models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly tasksUrl = `${environment.apiUrl}/Tasks`;

  private timeEntriesUrl(taskId: number): string {
    return `${environment.apiUrl}/tasks/${taskId}/timeentries`;
  }

  getAll(): Observable<Task[]> {
    return this.http.get<Task[]>(this.tasksUrl);
  }

  create(request: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(this.tasksUrl, request);
  }

  update(id: number, request: UpdateTaskRequest): Observable<void> {
    return this.http.put<void>(`${this.tasksUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.tasksUrl}/${id}`);
  }

  getTimeEntries(taskId: number): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(this.timeEntriesUrl(taskId));
  }

  startTimer(taskId: number): Observable<unknown> {
    return this.http.post(`${this.timeEntriesUrl(taskId)}/start`, {});
  }

  stopTimer(taskId: number, entryId: number): Observable<unknown> {
    return this.http.post(`${this.timeEntriesUrl(taskId)}/${entryId}/stop`, {});
  }
    /** Tiempo invertido por día del periodo, repartido en días de la zona horaria indicada. */
  getStats(period: StatsPeriod, date: string, timeZone: string): Observable<TaskTimeStats> {
    return this.http.get<TaskTimeStats>(`${this.tasksUrl}/stats`, { params: { period, date, timeZone } });
  }
}