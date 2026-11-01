namespace TaskBoard.Api.Models;

public class Habit
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Objetivo de veces por semana (1–7). 7 = diario; cualquier día de la semana vale.</summary>
    public int TimesPerWeek { get; set; } = 7;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<HabitLog> Logs { get; set; } = new List<HabitLog>();
}