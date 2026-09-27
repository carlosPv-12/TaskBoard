import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateHabitRequest, Habit, HabitLog, HabitStats, ToggleHabitLogRequest } from './habit.models';

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/Habits`;

  getAll(): Observable<Habit[]> {
    return this.http.get<Habit[]>(this.baseUrl);
  }

  create(request: CreateHabitRequest): Observable<Habit> {
    return this.http.post<Habit>(this.baseUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Logs de todos los hábitos del usuario entre dos fechas (incluidas). */
  getLogs(from: string, to: string): Observable<HabitLog[]> {
    return this.http.get<HabitLog[]>(`${this.baseUrl}/logs`, { params: { from, to } });
  }

  toggleLog(habitId: number, request: ToggleHabitLogRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${habitId}/logs`, request);
  }

  getStats(habitId: number): Observable<HabitStats> {
    return this.http.get<HabitStats>(`${this.baseUrl}/${habitId}/stats`);
  }
}