namespace TaskBoard.Api.Models;

public class RoutineExercise
{
    public int Id { get; set; }
    public int RoutineId { get; set; }
    public Routine? Routine { get; set; }
    public int ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }
    public int Order { get; set; }
}