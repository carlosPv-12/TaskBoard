# ---------- Etapa 1: compilar Angular ----------
FROM node:22-alpine AS build
WORKDIR /app

# Primero solo los manifiestos, para cachear la instalación de dependencias
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ---------- Etapa 2: servir con nginx sin root ----------
# Variante de nginx que corre como usuario sin privilegios (uid 101), en el puerto 8080.
# 1.30 es la rama estable: recibe parches de la 1.30.x sin cambiar de versión menor.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/taskboard-web/browser /usr/share/nginx/html
EXPOSE 8080
