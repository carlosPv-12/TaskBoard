namespace TaskBoard.Api.Dtos;

public class HabitLogDto
{
    public int HabitId { get; set; }
    public DateOnly Date { get; set; }
    public bool Completed { get; set; }
}