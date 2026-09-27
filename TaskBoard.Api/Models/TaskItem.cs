namespace TaskBoard.Api.Models;

public class TaskItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}