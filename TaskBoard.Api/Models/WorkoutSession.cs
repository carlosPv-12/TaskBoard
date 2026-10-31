namespace TaskBoard.Api.Models;

public class WorkoutSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateOnly Date { get; set; }
    /// <summary>OBSOLETO: antes un entreno tenía una sola rutina. Ahora se usa SessionRoutines.
    /// Se mantiene solo hasta migrar los datos antiguos; se borrará en una migración posterior.</summary>
    public int? RoutineId { get; set; }
    public Routine? Routine { get; set; }
    public int? DurationMinutes { get; set; }
    public ICollection<SessionExercise> SessionExercises { get; set; } = new List<SessionExercise>();
    public ICollection<WorkoutSessionRoutine> SessionRoutines { get; set; } = new List<WorkoutSessionRoutine>();
}