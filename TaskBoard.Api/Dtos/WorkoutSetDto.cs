namespace TaskBoard.Api.Dtos;

public class WorkoutSetDto
{
    public int Id { get; set; }
    public int SetNumber { get; set; }
    public decimal Weight { get; set; }
    public int Reps { get; set; }
}