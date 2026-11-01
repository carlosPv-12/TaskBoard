namespace TaskBoard.Api.Dtos;

public class HabitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TimesPerWeek { get; set; }
    public DateTime CreatedAt { get; set; }
}