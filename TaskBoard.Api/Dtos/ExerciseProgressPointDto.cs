namespace TaskBoard.Api.Dtos;

public class ExerciseProgressPointDto
{
    public DateOnly Date { get; set; }
    public decimal MaxWeight { get; set; }
    public decimal TotalVolume { get; set; }
}