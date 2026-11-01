using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateHabitDto
{
    [Required]
    [MinLength(3)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 7, ErrorMessage = "El objetivo debe estar entre 1 y 7 veces por semana.")]
    public int TimesPerWeek { get; set; } = 7;
}