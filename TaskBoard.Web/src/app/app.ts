import { Component, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { AuthService } from './core/auth/auth.service';
import { NativeService } from './core/native/native.service';

type Section = 'tasks' | 'habits' | 'gym';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  section: Section;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(window:scroll)': 'onScroll()' }
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly native = inject(NativeService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly navItems: NavItem[] = [
    { path: '/tasks', label: 'Tareas', icon: 'checklist', section: 'tasks' },
    { path: '/habits', label: 'Hábitos', icon: 'self_improvement', section: 'habits' },
    { path: '/gym', label: 'Gimnasio', icon: 'fitness_center', section: 'gym' }
  ];

  /** La barra superior pasa a "cristal" (translúcida con desenfoque) en cuanto hay scroll. */
  protected readonly scrolled = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private readonly section = computed(
    () => this.navItems.find(item => this.url().startsWith(item.path))?.section ?? null
  );

  constructor() {
    // Iconos redondeados (Material Symbols Rounded), más cercanos a SF Symbols
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');

    // Botón atrás, teclado, barra de estado y splash (solo dentro del APK)
    this.native.init();

    // El acento de color depende de la sección: se marca en <html> para que llegue
    // también a menús, diálogos y avisos, que se pintan fuera del <main>.
    effect(() => {
      const section = this.section();
      const root = this.document.documentElement;
      if (section) {
        root.dataset['section'] = section;
      } else {
        delete root.dataset['section'];
      }
    });
  }

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 4);
  }
}
