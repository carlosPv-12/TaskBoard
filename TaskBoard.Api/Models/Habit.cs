namespace TaskBoard.Api.Models;

public enum HabitFrequency
{
    Daily,
    Weekly
}

public class Habit
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public HabitFrequency Frequency { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<HabitLog> Logs { get; set; } = new List<HabitLog>();
}