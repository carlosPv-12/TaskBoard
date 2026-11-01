namespace TaskBoard.Api.Dtos;

/// <summary>
/// Lo mínimo que necesita el móvil para programar sus notificaciones locales.
/// El cálculo de "qué avisar y cuándo" se hace en el cliente porque depende de la hora
/// del dispositivo y de los ajustes del usuario, que solo conoce el móvil.
/// </summary>
public class RemindersDto
{
    public DateOnly Date { get; set; }
    public DateOnly WeekStart { get; set; }
    public List<HabitReminderDto> Habits { get; set; } = new();
    public List<TaskReminderDto> Tasks { get; set; } = new();
}

public class HabitReminderDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TimesPerWeek { get; set; }
    /// <summary>Días completados en la semana de <see cref="RemindersDto.Date"/> (lunes a domingo).</summary>
    public int DoneThisWeek { get; set; }
    public bool DoneToday { get; set; }
}

public class TaskReminderDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    /// <summary>Último momento en que se trabajó en la tarea (o su creación si nunca se empezó). UTC.</summary>
    public DateTime LastActivityAt { get; set; }
}
