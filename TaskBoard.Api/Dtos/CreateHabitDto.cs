using System.ComponentModel.DataAnnotations;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Dtos;

public class CreateHabitDto
{
    [Required]
    [MinLength(3)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public HabitFrequency Frequency { get; set; }
}