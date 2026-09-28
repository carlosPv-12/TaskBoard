using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class RegisterDto
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}