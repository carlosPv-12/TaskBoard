namespace TaskBoard.Api.Services;

/// <summary>
/// Sustituto cuando no hay Resend:ApiKey configurada: no envía nada.
/// En desarrollo el enlace de recuperación se imprime en la consola (lo hace el controlador).
/// </summary>
public class LogEmailSender : IEmailSender
{
    private readonly ILogger<LogEmailSender> _logger;

    public LogEmailSender(ILogger<LogEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string to, string subject, string html, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("Email NO enviado a {To} (\"{Subject}\"): falta Resend:ApiKey.", to, subject);
        return Task.CompletedTask;
    }
}
