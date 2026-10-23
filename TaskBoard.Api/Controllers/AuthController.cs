using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Models;
using TaskBoard.Api.Services;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// Margen tras rotar un refresh token en el que volver a usarlo NO se trata como robo:
    /// cubre dos pestañas (o dos peticiones) que refrescan a la vez.
    /// </summary>
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    /// <summary>Validez del enlace de "he olvidado mi contraseña".</summary>
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromHours(1);

    private readonly AppDbContext _context;
    private readonly TokenService _tokenService;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public AuthController(
        AppDbContext context,
        TokenService tokenService,
        IEmailSender emailSender,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _emailSender = emailSender;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto)
    {
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (existingUser is not null)
        {
            return Conflict(new { error = "Ya existe un usuario con ese email." });
        }

        var user = new User
        {
            Email = dto.Email
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, dto.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user is null)
        {
            return Unauthorized(new { error = "Credenciales inválidas." });
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password);

        if (result == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new { error = "Credenciales inválidas." });
        }

        return Ok(await IssueTokensAsync(user));
    }

    // POST /api/Auth/refresh
    // Cambia un refresh token válido por un access token nuevo Y un refresh token nuevo (rotación).
    [HttpPost("refresh")]
    [EnableRateLimiting("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh(RefreshRequestDto dto)
    {
        var hash = TokenService.HashToken(dto.RefreshToken);

        var stored = await _context.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == hash);

        if (stored?.User is null)
        {
            return InvalidSession();
        }

        var now = DateTime.UtcNow;

        // Token ya usado: si no es una carrera legítima (margen de gracia), alguien lo copió.
        // Por seguridad se cierran TODAS las sesiones de ese usuario.
        if (stored.RevokedAt is { } revokedAt)
        {
            if (now - revokedAt > ReuseGrace)
            {
                await _context.RefreshTokens
                    .Where(r => r.UserId == stored.UserId && r.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.RevokedAt, now));
            }

            return InvalidSession();
        }

        if (stored.ExpiresAt <= now)
        {
            return InvalidSession();
        }

        return Ok(await IssueTokensAsync(stored.User, replacing: stored));
    }

    // POST /api/Auth/logout
    // Revoca el refresh token. Es idempotente: si ya no existe o está revocado, también devuelve 204.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequestDto dto)
    {
        var hash = TokenService.HashToken(dto.RefreshToken);

        var stored = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == hash && r.RevokedAt == null);

        if (stored is not null)
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    // POST /api/Auth/forgot-password
    // Responde SIEMPRE 204, exista o no el email: así nadie puede averiguar quién tiene cuenta.
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordDto dto, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email, cancellationToken);

        if (user is null)
        {
            return NoContent();
        }

        var frontendUrl = ResolveFrontendUrl();
        if (frontendUrl is null)
        {
            _logger.LogError("No se puede generar el enlace de recuperación: configura App:FrontendUrl.");
            return NoContent();
        }

        var now = DateTime.UtcNow;

        // Solo vale el último enlace pedido: los anteriores sin usar se invalidan.
        var pending = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var previous in pending)
        {
            previous.UsedAt = now;
        }

        var (token, hash) = TokenService.GenerateOpaqueToken();

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now.Add(ResetTokenLifetime)
        });

        await _context.SaveChangesAsync(cancellationToken);

        var link = $"{frontendUrl}/reset-password?token={Uri.EscapeDataString(token)}";

        if (_environment.IsDevelopment())
        {
            _logger.LogWarning("[DEV] Enlace de recuperación para {Email}: {Link}", user.Email, link);
        }

        try
        {
            var (subject, html) = PasswordResetEmail.Build(link, "1 hora");
            await _emailSender.SendAsync(user.Email, subject, html, cancellationToken);
        }
        catch (Exception ex)
        {
            // Si el email falla no se lo contamos al cliente (sería revelar que la cuenta existe): se registra y ya.
            _logger.LogError(ex, "No se pudo enviar el email de recuperación a {Email}", user.Email);
        }

        return NoContent();
    }

    // POST /api/Auth/reset-password
    // Cambia la contraseña con el token del enlace. Tras cambiarla se cierran TODAS las sesiones abiertas.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
    {
        var hash = TokenService.HashToken(dto.Token);
        var now = DateTime.UtcNow;

        var stored = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (stored?.User is null || stored.UsedAt is not null || stored.ExpiresAt <= now)
        {
            return BadRequest(new { error = "El enlace no es válido o ha caducado. Solicita uno nuevo." });
        }

        stored.User.PasswordHash = _passwordHasher.HashPassword(stored.User, dto.NewPassword);
        stored.UsedAt = now;

        // Si alguien más tenía acceso a la cuenta (por eso se cambia la contraseña), deja de tenerlo.
        var sessions = await _context.RefreshTokens
            .Where(r => r.UserId == stored.UserId && r.RevokedAt == null)
            .ToListAsync();

        foreach (var session in sessions)
        {
            session.RevokedAt = now;
        }

        // Un único SaveChanges: contraseña, enlace usado y sesiones revocadas, todo o nada.
        await _context.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Crea access token + refresh token. Si viene "replacing", lo revoca y lo enlaza al nuevo
    /// en el MISMO SaveChanges: o se hace todo o no se hace nada.
    /// </summary>
    private async Task<AuthResponseDto> IssueTokensAsync(User user, RefreshToken? replacing = null)
    {
        var (refreshToken, refreshHash) = _tokenService.GenerateRefreshToken();
        var now = DateTime.UtcNow;

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refreshHash,
            CreatedAt = now,
            ExpiresAt = now.Add(_tokenService.RefreshLifetime)
        });

        if (replacing is not null)
        {
            replacing.RevokedAt = now;
            replacing.ReplacedByTokenHash = refreshHash;
        }

        await _context.SaveChangesAsync();

        return new AuthResponseDto
        {
            Token = _tokenService.GenerateToken(user),
            RefreshToken = refreshToken,
            Email = user.Email
        };
    }

    /// <summary>URL base del frontend para los enlaces de los emails (App:FrontendUrl o, si no está, el primer origen CORS).</summary>
    private string? ResolveFrontendUrl()
    {
        var url = _configuration["App:FrontendUrl"];

        if (string.IsNullOrWhiteSpace(url))
        {
            url = _configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()?.FirstOrDefault();
        }

        return string.IsNullOrWhiteSpace(url) ? null : url.TrimEnd('/');
    }

    private ActionResult InvalidSession() =>
        Unauthorized(new { error = "Sesión no válida. Inicia sesión de nuevo." });
}
