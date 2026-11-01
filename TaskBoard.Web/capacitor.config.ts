import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor envuelve la web compilada (webDir) en una app Android nativa.
 * appId es el identificador único de la app en Android: no se puede cambiar
 * una vez instalada (sería otra app distinta), por eso usa tu dominio al revés.
 */
const config: CapacitorConfig = {
  appId: 'com.capeva26.taskboard',
  appName: 'TaskBoard',
  webDir: 'dist/taskboard-web/browser',
  plugins: {
    // La app oculta el splash cuando Angular ha pintado (NativeService); el límite evita
    // que se quede colgado si algo falla al arrancar.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000
    }
  }
};

export default config;
