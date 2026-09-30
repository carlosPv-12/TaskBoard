# ---------- Etapa 1: compilar (SDK, pesada) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Se copia solo el .csproj primero para cachear el restore de paquetes NuGet
# (igual que cachear dependencias de Maven antes de copiar el código)
COPY *.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# ---------- Etapa 2: runtime (ligera) ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Puerto interno; Traefik enrutará hasta aquí (equivale a server.port)
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

# La imagen aspnet trae un usuario sin privilegios: no se ejecuta como root
USER $APP_UID

ENTRYPOINT ["dotnet", "TaskBoard.Api.dll"]