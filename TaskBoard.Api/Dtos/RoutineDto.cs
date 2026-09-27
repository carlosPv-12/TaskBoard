namespace TaskBoard.Api.Dtos;

public class RoutineDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<RoutineExerciseDto> Exercises { get; set; } = new();
}