using System.ComponentModel.DataAnnotations;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Dtos;

public class CreateExerciseDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string MuscleGroup { get; set; } = string.Empty;

    /// <summary>"Strength" o "Time". Si no se envía, fuerza.</summary>
    public ExerciseType Type { get; set; } = ExerciseType.Strength;
}
