namespace TaskBoard.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // El cliente cerró la conexión: no es un error del servidor
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Excepción no controlada en {Method} {Path} (traceId {TraceId})",
                context.Request.Method, context.Request.Path, context.TraceIdentifier);

            // Si ya se enviaron cabeceras no se puede reescribir la respuesta
            if (context.Response.HasStarted)
                throw;

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;

            // El detalle solo en desarrollo; en producción, el traceId para buscarlo en los logs
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Ha ocurrido un error inesperado.",
                traceId = context.TraceIdentifier,
                detail = _environment.IsDevelopment() ? ex.Message : null
            });
        }
    }
}