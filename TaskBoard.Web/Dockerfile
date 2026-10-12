# ---------- Etapa 1: compilar Angular ----------
FROM node:22-alpine AS build
WORKDIR /app

# Primero solo los manifiestos, para cachear la instalación de dependencias
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ---------- Etapa 2: servir con nginx ----------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/taskboard-web/browser /usr/share/nginx/html
EXPOSE 80