# ---------- Etapa 1: compilar (SDK, pesada) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Se copia solo el .csproj primero para cachear el restore de paquetes NuGet
# (igual que cachear dependencias de Maven antes de copiar el código)
COPY TaskBoard.Api.csproj ./
RUN dotnet restore

COPY . .
# UseAppHost=false: no genera el ejecutable nativo; se arranca con "dotnet X.dll"
RUN dotnet publish -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Etapa 2: runtime (ligera) ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# La imagen ya escucha en 8080 (ASPNETCORE_HTTP_PORTS=8080), equivale a server.port
EXPOSE 8080

COPY --from=build /app/publish .

# La imagen aspnet trae un usuario sin privilegios: no se ejecuta como root
USER $APP_UID

ENTRYPOINT ["dotnet", "TaskBoard.Api.dll"]