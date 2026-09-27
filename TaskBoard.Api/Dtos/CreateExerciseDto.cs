using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateExerciseDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string MuscleGroup { get; set; } = string.Empty;
}