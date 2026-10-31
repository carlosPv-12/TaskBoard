namespace TaskBoard.Api.Models;

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string MuscleGroup { get; set; } = string.Empty;
    public ExerciseType Type { get; set; } = ExerciseType.Strength;

    public int UserId { get; set; }
}
