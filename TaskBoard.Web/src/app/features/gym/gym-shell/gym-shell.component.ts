import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

interface GymTab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-gym-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatIconModule],
  templateUrl: './gym-shell.component.html',
  styleUrl: './gym-shell.component.scss'
})
export class GymShellComponent {
  protected readonly tabs: GymTab[] = [
    { path: 'calendar', label: 'Calendario', icon: 'calendar_month' },
    { path: 'routines', label: 'Rutinas', icon: 'fitness_center' },
    { path: 'progress', label: 'Progreso', icon: 'show_chart' }
  ];
}