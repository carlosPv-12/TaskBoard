using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Models;
using TaskBoard.Api.Services;
using Microsoft.AspNetCore.RateLimiting;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TokenService _tokenService;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public AuthController(AppDbContext context, TokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
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

        var token = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            Email = user.Email
        });
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

        var token = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            Email = user.Email
        });
    }
}