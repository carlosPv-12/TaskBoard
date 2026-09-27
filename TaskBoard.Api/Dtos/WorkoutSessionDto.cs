namespace TaskBoard.Api.Dtos;

public class WorkoutSessionDto
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int? RoutineId { get; set; }
    public string? RoutineName { get; set; }
    public int? DurationMinutes { get; set; }
    public List<SessionExerciseDto> Exercises { get; set; } = new();
}