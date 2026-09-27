namespace TaskBoard.Api.Dtos;

public class ToggleHabitLogDto
{
    public DateOnly Date { get; set; }
    public bool Completed { get; set; }
}