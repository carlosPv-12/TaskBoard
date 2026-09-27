using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateRoutineDto
{
    [Required]
    [MinLength(3)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<int> ExerciseIds { get; set; } = new();
}