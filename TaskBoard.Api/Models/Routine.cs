namespace TaskBoard.Api.Models;

public class Routine
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RoutineExercise> RoutineExercises { get; set; } = new List<RoutineExercise>();
}