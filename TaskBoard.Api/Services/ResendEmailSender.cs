using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace TaskBoard.Api.Services;

/// <summary>Envía el correo con la API REST de Resend (https://resend.com/docs/api-reference/emails/send-email).</summary>
public class ResendEmailSender : IEmailSender
{
    private readonly HttpClient _http;
    private readonly string _from;

    public ResendEmailSender(HttpClient http, IConfiguration configuration)
    {
        _http = http;
        _from = configuration["Resend:From"] ?? "TaskBoard <onboarding@resend.dev>";
    }

    public async Task SendAsync(string to, string subject, string html, CancellationToken cancellationToken = default)
    {
        var request = new ResendRequest(_from, [to], subject, html);

        using var response = await _http.PostAsJsonAsync("emails", request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Resend respondió {(int)response.StatusCode}: {body}");
        }
    }

    private sealed record ResendRequest(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string[] To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("html")] string Html);
}
