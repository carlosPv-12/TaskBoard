using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class UpdateWorkoutSessionDto
{
    [Range(1, 600)]
    public int? DurationMinutes { get; set; }
}