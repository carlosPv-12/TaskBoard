namespace TaskBoard.Api.Models;

/// <summary>
/// Rutinas que se han cargado en un entreno (un entreno puede combinar varias).
/// Tabla intermedia N:M, como un @ManyToMany con @JoinTable en JPA, pero con columna extra (Order).
/// </summary>
public class WorkoutSessionRoutine
{
    public int WorkoutSessionId { get; set; }
    public WorkoutSession? WorkoutSession { get; set; }
    public int RoutineId { get; set; }
    public Routine? Routine { get; set; }

    /// <summary>Orden en que se añadieron (para mostrar "Pecho + Abdominales").</summary>
    public int Order { get; set; }
}
