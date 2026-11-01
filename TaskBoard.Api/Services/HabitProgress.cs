namespace TaskBoard.Api.Services;

/// <summary>
/// Cálculo puro (sin base de datos) del cumplimiento y la racha de un hábito con objetivo semanal.
/// Al no depender de EF ni de HttpContext se puede probar con tests unitarios directamente,
/// igual que una clase de dominio en Spring sin @Autowired.
///
/// Reglas:
///  • Las semanas van de lunes a domingo (igual que la rejilla del frontend).
///  • La semana en la que se crea el hábito tiene un objetivo proporcional a los días que quedaban
///    (creado un viernes con objetivo 7 → esa semana pide 3).
///  • Hacer más veces de las previstas cuenta como cumplido, sin bonificar por encima del 100 %.
///  • La semana actual solo cuenta si ya está cumplida: mientras está en curso no ha "fallado".
///  • Racha: en días si el objetivo es 7 (diario); en semanas seguidas cumplidas en el resto.
/// </summary>
public static class HabitProgress
{
    public record Result(double CompletionRate, int CurrentStreak, string StreakUnit);

    public static Result Calculate(int timesPerWeek, DateOnly created, DateOnly today, IReadOnlySet<DateOnly> completed)
    {
        var target = Math.Clamp(timesPerWeek, 1, 7);
        var firstWeek = StartOfWeek(created);
        var currentWeek = StartOfWeek(today);

        // Veces hechas por semana (clave: lunes de esa semana)
        var perWeek = completed
            .GroupBy(StartOfWeek)
            .ToDictionary(g => g.Key, g => g.Count());

        int Done(DateOnly week) => perWeek.GetValueOrDefault(week);
        bool Met(DateOnly week) => Done(week) >= WeekTarget(week, firstWeek, created, target);

        // ── Cumplimiento medio por semanas ──
        double sum = 0;
        var weeks = 0;
        for (var week = firstWeek; week <= currentWeek; week = week.AddDays(7))
        {
            if (week == currentWeek && !Met(week))
            {
                continue; // semana en curso y aún sin cumplir: no penaliza
            }

            var weekTarget = WeekTarget(week, firstWeek, created, target);
            sum += Math.Min(Done(week), weekTarget) / (double)weekTarget;
            weeks++;
        }

        var rate = weeks == 0 ? 0 : sum / weeks * 100;

        // ── Racha ──
        if (target == 7)
        {
            // Diario: días seguidos. Si hoy aún no está marcado, la racha sigue viva desde ayer.
            var cursor = completed.Contains(today) ? today : today.AddDays(-1);
            var days = 0;
            while (completed.Contains(cursor))
            {
                days++;
                cursor = cursor.AddDays(-1);
            }

            return new Result(rate, days, "days");
        }

        // Resto: semanas seguidas cumplidas. La actual suma si ya está cumplida; si no, se empieza por la anterior.
        var weekCursor = Met(currentWeek) ? currentWeek : currentWeek.AddDays(-7);
        var streak = 0;
        while (weekCursor >= firstWeek && Met(weekCursor))
        {
            streak++;
            weekCursor = weekCursor.AddDays(-7);
        }

        return new Result(rate, streak, "weeks");
    }

    /// <summary>Lunes de la semana de <paramref name="date"/>. DayOfWeek empieza en domingo (0), de ahí el +6 % 7.</summary>
    public static DateOnly StartOfWeek(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));

    private static int WeekTarget(DateOnly week, DateOnly firstWeek, DateOnly created, int target)
    {
        if (week != firstWeek)
        {
            return target;
        }

        var daysAvailable = 7 - (created.DayNumber - week.DayNumber);
        return Math.Min(target, daysAvailable);
    }
}
