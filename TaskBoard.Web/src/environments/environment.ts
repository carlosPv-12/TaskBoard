export const environment = {
  production: true,
  // Relativa: nginx reenvía /api a la API (mismo origen en local y en producción).
  // La futura app móvil (Capacitor) usará un environment.mobile.ts con la URL absoluta.
  apiUrl: '/api'
};