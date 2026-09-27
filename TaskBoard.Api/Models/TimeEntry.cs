namespace TaskBoard.Api.Models;

public class TimeEntry
{
    public int Id { get; set; }
    public int TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? StoppedAt { get; set; }
}