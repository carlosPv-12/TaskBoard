// App Android (Capacitor): la web va dentro del APK y se sirve desde https://localhost,
// así que la API no puede ser relativa (/api) como en la web: va con su dominio completo.
// En el backend, ese origen debe estar permitido: Cors__AllowedOrigins__1=https://localhost
export const environment = {
  production: true,
  apiUrl: 'https://taskboard.capeva26.com/api'
};
