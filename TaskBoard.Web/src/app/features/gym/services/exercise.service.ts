import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateExerciseRequest, Exercise, UpdateExerciseRequest } from '../models/exercise.models';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/Exercises`;

  getAll(): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.baseUrl);
  }

  create(request: CreateExerciseRequest): Observable<Exercise> {
    return this.http.post<Exercise>(this.baseUrl, request);
  }

  update(id: number, request: UpdateExerciseRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  /** 409 Conflict si el ejercicio está en alguna rutina o entreno. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}