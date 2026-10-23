namespace TaskBoard.Api.Models;

/// <summary>
/// Enlace de recuperación de contraseña. Igual que el refresh token: solo se guarda el HASH,
/// vale una única vez (UsedAt) y caduca pronto.
/// </summary>
public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    /// <summary>Se rellena al usarlo, o al pedir otro enlace (solo el último vale).</summary>
    public DateTime? UsedAt { get; set; }
}
