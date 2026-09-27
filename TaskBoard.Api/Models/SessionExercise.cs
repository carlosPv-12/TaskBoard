namespace TaskBoard.Api.Models;

public class SessionExercise
{
    public int Id { get; set; }
    public int WorkoutSessionId { get; set; }
    public WorkoutSession? WorkoutSession { get; set; }
    public int ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }
    public int Order { get; set; }
    public ICollection<WorkoutSet> Sets { get; set; } = new List<WorkoutSet>();
}