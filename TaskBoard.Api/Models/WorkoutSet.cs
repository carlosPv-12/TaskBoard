namespace TaskBoard.Api.Models;

/// <summary>
/// Una serie. Qué campos van rellenos depende del tipo de ejercicio:
/// fuerza = Weight + Reps; tiempo = DurationSeconds (+ DistanceKm y Weight opcionales).
/// </summary>
public class WorkoutSet
{
    public int Id { get; set; }
    public int SessionExerciseId { get; set; }
    public SessionExercise? SessionExercise { get; set; }
    public int SetNumber { get; set; }
    public decimal? Weight { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceKm { get; set; }
}
