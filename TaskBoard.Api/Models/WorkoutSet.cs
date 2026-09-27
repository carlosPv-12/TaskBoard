namespace TaskBoard.Api.Models;

public class WorkoutSet
{
    public int Id { get; set; }
    public int SessionExerciseId { get; set; }
    public SessionExercise? SessionExercise { get; set; }
    public int SetNumber { get; set; }
    public decimal Weight { get; set; }
    public int Reps { get; set; }
}