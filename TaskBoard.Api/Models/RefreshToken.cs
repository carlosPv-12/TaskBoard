namespace TaskBoard.Api.Models;

/// <summary>
/// Sesión de larga duración. Se guarda el HASH del token (SHA-256), nunca el token en claro:
/// si alguien leyera la BD no podría usarlo.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    /// <summary>Se rellena al usarlo (rotación) o al cerrar sesión.</summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>Hash del token que lo sustituyó al rotar (trazabilidad de la cadena).</summary>
    public string? ReplacedByTokenHash { get; set; }
}
