namespace TaskBoard.Api.Models;

/// <summary>Cómo se registran las series del ejercicio.</summary>
public enum ExerciseType
{
    /// <summary>Peso + repeticiones (press banca, sentadilla...).</summary>
    Strength = 0,

    /// <summary>Duración, con distancia y peso opcionales (plancha, cinta, bici...).</summary>
    Time = 1
}
