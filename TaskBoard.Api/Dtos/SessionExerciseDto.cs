namespace TaskBoard.Api.Dtos;

public class SessionExerciseDto
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public int Order { get; set; }
    public List<WorkoutSetDto> Sets { get; set; } = new();
}