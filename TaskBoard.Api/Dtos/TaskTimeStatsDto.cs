namespace TaskBoard.Api.Dtos;

public class TaskTimeStatsDto
{
    public string Period { get; set; } = string.Empty;
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public int TotalSeconds { get; set; }
    public int PreviousTotalSeconds { get; set; }
    public int ActiveDays { get; set; }
    public List<DayTimeDto> Days { get; set; } = new();
}