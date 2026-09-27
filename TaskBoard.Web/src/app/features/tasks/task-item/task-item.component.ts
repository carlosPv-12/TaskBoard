import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { Task, TimeEntry } from '../task.models';
import { activeEntryOf, elapsedSeconds, totalSecondsOf } from '../task-time';

@Component({
  selector: 'app-task-item',
  imports: [DatePipe, DurationPipe, MatCheckboxModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './task-item.component.html',
  styleUrl: './task-item.component.scss'
})
export class TaskItemComponent {
  // Entradas (datos que llegan del padre)
  readonly task = input.required<Task>();
  readonly entries = input.required<readonly TimeEntry[]>();
  readonly now = input.required<number>();
  readonly busy = input(false);

  // Salidas (eventos hacia el padre)
  readonly toggleDone = output<void>();
  readonly rename = output<string>();
  readonly remove = output<void>();
  readonly startTimer = output<void>();
  readonly stopTimer = output<number>();

  // Estado derivado
  readonly activeEntry = computed(() => activeEntryOf(this.entries()));
  readonly isRunning = computed(() => this.activeEntry() !== null);
  readonly sessionSeconds = computed(() => {
    const active = this.activeEntry();
    return active ? elapsedSeconds(active, this.now()) : 0;
  });
  readonly totalSeconds = computed(() => totalSecondsOf(this.entries(), this.now()));

  // Edición del título
  readonly editing = signal(false);
  readonly editError = signal(false);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  constructor() {
    // Cuando aparece el input de edición, lo enfoca y selecciona el texto
    effect(() => {
      const input = this.titleInput()?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  startEdit(): void {
    this.editError.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editError.set(false);
  }

  saveEdit(value: string): void {
    const title = value.trim();
    if (title.length < 3) {
      this.editError.set(true);
      return;
    }
    if (title !== this.task().title) {
      this.rename.emit(title);
    }
    this.cancelEdit();
  }
}