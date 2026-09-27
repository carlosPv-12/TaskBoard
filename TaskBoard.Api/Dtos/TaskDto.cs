namespace TaskBoard.Api.Dtos;

public class TaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }
    public DateTime CreatedAt { get; set; }
}
