using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

/// <summary>
/// Fuerza: Reps obligatorio y Weight (0 = peso corporal).
/// Tiempo: DurationSeconds obligatorio; DistanceKm y Weight opcionales.
/// La combinación se valida en el controlador según el tipo del ejercicio.
/// </summary>
public class CreateWorkoutSetDto
{
    [Range(0, 1000)]
    public decimal? Weight { get; set; }

    [Range(1, 100)]
    public int? Reps { get; set; }

    [Range(1, 86400)]
    public int? DurationSeconds { get; set; }

    [Range(0, 1000)]
    public decimal? DistanceKm { get; set; }
}
