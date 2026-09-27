import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateRoutineRequest, Routine } from '../models/routine.models';

@Injectable({ providedIn: 'root' })
export class RoutineService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/Routines`;

  getAll(): Observable<Routine[]> {
    return this.http.get<Routine[]>(this.baseUrl);
  }

  create(request: CreateRoutineRequest): Observable<Routine> {
    return this.http.post<Routine>(this.baseUrl, request);
  }

  /** 409 Conflict si la rutina ya se usó en alguna sesión. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}