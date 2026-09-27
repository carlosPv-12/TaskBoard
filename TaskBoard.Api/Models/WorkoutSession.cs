namespace TaskBoard.Api.Models;

public class WorkoutSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateOnly Date { get; set; }
    public int? RoutineId { get; set; }
    public Routine? Routine { get; set; }
    public int? DurationMinutes { get; set; }
    public ICollection<SessionExercise> SessionExercises { get; set; } = new List<SessionExercise>();
}