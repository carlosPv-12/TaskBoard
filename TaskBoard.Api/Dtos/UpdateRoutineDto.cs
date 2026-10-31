using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

/// <summary>Sustituye el nombre y la lista completa (y ordenada) de ejercicios de la rutina.</summary>
public class UpdateRoutineDto
{
    [Required]
    [MinLength(3)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<int> ExerciseIds { get; set; } = new();
}
