import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AddSessionExerciseRequest,
  CreateWorkoutSessionRequest,
  CreateWorkoutSetRequest,
  SessionExercise,
  UpdateWorkoutSessionRequest,
  WorkoutSession,
  WorkoutSet
} from '../models/workout-session.models';
import { ExerciseProgressPoint } from '../models/progress.models';

@Injectable({ providedIn: 'root' })
export class WorkoutSessionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/WorkoutSessions`;

  // ── Sesiones ────────────────────────────────────────────
  /** Lista ligera para el calendario (sin ejercicios). */
  getAll(): Observable<WorkoutSession[]> {
    return this.http.get<WorkoutSession[]>(this.baseUrl);
  }

  /** Detalle completo con ejercicios y series. */
  getById(id: number): Observable<WorkoutSession> {
    return this.http.get<WorkoutSession>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateWorkoutSessionRequest): Observable<WorkoutSession> {
    return this.http.post<WorkoutSession>(this.baseUrl, request);
  }

  update(id: number, request: UpdateWorkoutSessionRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // ── Ejercicios de una sesión ───────────────────────────
  addExercise(sessionId: number, request: AddSessionExerciseRequest): Observable<SessionExercise> {
    return this.http.post<SessionExercise>(`${this.baseUrl}/${sessionId}/exercises`, request);
  }

  removeExercise(sessionId: number, sessionExerciseId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${sessionId}/exercises/${sessionExerciseId}`);
  }

  // ── Series ──────────────────────────────────────────────
  addSet(sessionId: number, sessionExerciseId: number, request: CreateWorkoutSetRequest): Observable<WorkoutSet> {
    return this.http.post<WorkoutSet>(
      `${this.baseUrl}/${sessionId}/exercises/${sessionExerciseId}/sets`,
      request
    );
  }

  deleteSet(sessionId: number, sessionExerciseId: number, setId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${sessionId}/exercises/${sessionExerciseId}/sets/${setId}`
    );
  }

  // ── Progreso ────────────────────────────────────────────
  getProgress(exerciseId: number): Observable<ExerciseProgressPoint[]> {
    return this.http.get<ExerciseProgressPoint[]>(`${this.baseUrl}/progress/${exerciseId}`);
  }
}