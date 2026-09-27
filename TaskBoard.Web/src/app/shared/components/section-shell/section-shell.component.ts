import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

export interface SectionTab {
  path: string;
  label: string;
  icon: string;
}

/**
 * Cabecera con título + pestañas y un <router-outlet> para las rutas hijas.
 * heading y tabs llegan desde `data` de la ruta gracias a withComponentInputBinding().
 */
@Component({
  selector: 'app-section-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatIconModule],
  templateUrl: './section-shell.component.html',
  styleUrl: './section-shell.component.scss'
})
export class SectionShellComponent {
  readonly heading = input.required<string>();
  readonly tabs = input.required<SectionTab[]>();
}