using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class ResetPasswordDto
{
    [Required]
    [MaxLength(200)]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    [MaxLength(100)]
    public string NewPassword { get; set; } = string.Empty;
}
