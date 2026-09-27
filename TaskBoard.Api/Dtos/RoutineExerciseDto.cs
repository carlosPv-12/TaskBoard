namespace TaskBoard.Api.Dtos;

public class RoutineExerciseDto
{
    public int ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public int Order { get; set; }
}