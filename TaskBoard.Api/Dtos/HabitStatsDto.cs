namespace TaskBoard.Api.Dtos;

public class HabitStatsDto
{
    public string HabitName { get; set; } = string.Empty;
    public int TimesPerWeek { get; set; }
    public int TotalLogs { get; set; }
    public int CompletedLogs { get; set; }
    public double CompletionRate { get; set; }
    public int CurrentStreak { get; set; }

    /// <summary>"days" si el hábito es diario (7/semana); "weeks" en el resto.</summary>
    public string StreakUnit { get; set; } = "days";
}
