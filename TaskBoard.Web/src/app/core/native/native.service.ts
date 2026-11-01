import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { MatDialog } from '@angular/material/dialog';

/**
 * Integración con Android cuando la app corre dentro del APK (Capacitor).
 * En el navegador no hace nada: Capacitor.isNativePlatform() es false.
 *
 * Los eventos de los plugins llegan desde código nativo, fuera de la zona de Angular,
 * por eso se reentra con zone.run() para que la vista se actualice.
 */
@Injectable({ providedIn: 'root' })
export class NativeService {
  private readonly zone = inject(NgZone);
  private readonly dialog = inject(MatDialog);

  /** true mientras el teclado está en pantalla (para ocultar la barra de pestañas). */
  readonly keyboardOpen = signal(false);

  readonly isNative = Capacitor.isNativePlatform();

  init(): void {
    if (!this.isNative) {
      return;
    }

    // Iconos de la barra de estado oscuros o claros según el modo del sistema
    void StatusBar.setStyle({ style: Style.Default });

    // Botón atrás de Android: primero cierra diálogos, luego navega hacia atrás
    // y, en la primera pantalla, minimiza la app (como hacen las apps nativas) en vez de cerrarla.
    void App.addListener('backButton', ({ canGoBack }) =>
      this.zone.run(() => {
        if (this.dialog.openDialogs.length > 0) {
          this.dialog.closeAll();
        } else if (canGoBack) {
          history.back();
        } else {
          void App.minimizeApp();
        }
      })
    );

    void Keyboard.addListener('keyboardWillShow', () => this.zone.run(() => this.keyboardOpen.set(true)));
    void Keyboard.addListener('keyboardWillHide', () => this.zone.run(() => this.keyboardOpen.set(false)));

    // La pantalla de carga se quita cuando Angular ya ha pintado la primera vista
    requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 200 }));
  }
}
