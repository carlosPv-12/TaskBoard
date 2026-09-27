namespace TaskBoard.Api.Dtos;

public class TimeEntryDto
{
    public int Id { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? StoppedAt { get; set; }
    public int? DurationSeconds { get; set; }
}