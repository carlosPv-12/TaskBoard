namespace TaskBoard.Api.Models;

public class HabitLog
{
    public int Id { get; set; }
    public int HabitId { get; set; }
    public Habit? Habit { get; set; }
    public DateOnly Date { get; set; }
    public bool Completed { get; set; }
}