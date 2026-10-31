namespace TaskBoard.Api.Dtos;

public class WorkoutSessionDto
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }

    /// <summary>Rutinas cargadas en el entreno, en el orden en que se añadieron.</summary>
    public List<SessionRoutineDto> Routines { get; set; } = new();

    /// <summary>Primera rutina (compatibilidad con clientes antiguos).</summary>
    public int? RoutineId { get; set; }

    /// <summary>Nombres unidos: "Pecho + Abdominales". Null si es un entreno libre.</summary>
    public string? RoutineName { get; set; }

    public int? DurationMinutes { get; set; }
    public List<SessionExerciseDto> Exercises { get; set; } = new();
}
