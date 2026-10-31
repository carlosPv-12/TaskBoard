namespace TaskBoard.Api.Dtos;

/// <summary>Un punto de la gráfica de progreso (un día). Los campos de tiempo solo van en ejercicios de tiempo.</summary>
public class ExerciseProgressPointDto
{
    public DateOnly Date { get; set; }
    public decimal MaxWeight { get; set; }
    public decimal TotalVolume { get; set; }
    public int? MaxDurationSeconds { get; set; }
    public int? TotalDurationSeconds { get; set; }
    public decimal? TotalDistanceKm { get; set; }
}
