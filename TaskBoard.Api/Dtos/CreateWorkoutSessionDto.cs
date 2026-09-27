using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateWorkoutSessionDto
{
    [Required]
    public DateOnly Date { get; set; }

    public int? RoutineId { get; set; }

    public int? DurationMinutes { get; set; }
}