using TaskBoard.Api.Models;

namespace TaskBoard.Api.Dtos;

public class HabitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public HabitFrequency Frequency { get; set; }
    public DateTime CreatedAt { get; set; }
}