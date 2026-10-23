using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class ForgotPasswordDto
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
}
