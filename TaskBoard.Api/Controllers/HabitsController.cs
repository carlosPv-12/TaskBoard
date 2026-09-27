using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Extensions;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HabitsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HabitsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HabitDto>>> GetAll()
    {
        var userId = User.GetUserId();

        var habits = await _context.Habits
            .Where(h => h.UserId == userId)
            .ToListAsync();

        return Ok(habits.Select(MapToDto));
    }

    // GET /api/Habits/logs?from=2026-09-20&to=2026-09-26
    // Devuelve los logs de TODOS los hábitos del usuario en un rango, en una sola petición.
    [HttpGet("logs")]
    public async Task<ActionResult<IEnumerable<HabitLogDto>>> GetLogs(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to)
    {
        var userId = User.GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var rangeTo = to ?? today;
        var rangeFrom = from ?? rangeTo.AddDays(-6);

        var logs = await _context.HabitLogs
            .Where(l => l.Habit!.UserId == userId && l.Date >= rangeFrom && l.Date <= rangeTo)
            .Select(l => new HabitLogDto
            {
                HabitId = l.HabitId,
                Date = l.Date,
                Completed = l.Completed
            })
            .ToListAsync();

        return Ok(logs);
    }

    [HttpPost]
    public async Task<ActionResult<HabitDto>> Create(CreateHabitDto dto)
    {
        var userId = User.GetUserId();

        var habit = new Habit
        {
            UserId = userId,
            Name = dto.Name,
            Frequency = dto.Frequency,
            CreatedAt = DateTime.UtcNow
        };

        _context.Habits.Add(habit);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), MapToDto(habit));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();

        var habit = await _context.Habits
            .FirstOrDefaultAsync(h => h.Id == id && h.UserId == userId);

        if (habit is null)
        {
            return NotFound();
        }

        _context.Habits.Remove(habit);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id:int}/logs")]
    public async Task<IActionResult> ToggleLog(int id, ToggleHabitLogDto dto)
    {
        var userId = User.GetUserId();

        var habit = await _context.Habits
            .FirstOrDefaultAsync(h => h.Id == id && h.UserId == userId);

        if (habit is null)
        {
            return NotFound();
        }

        var log = await _context.HabitLogs
            .FirstOrDefaultAsync(l => l.HabitId == id && l.Date == dto.Date);

        if (log is null)
        {
            log = new HabitLog
            {
                HabitId = id,
                Date = dto.Date,
                Completed = dto.Completed
            };
            _context.HabitLogs.Add(log);
        }
        else
        {
            log.Completed = dto.Completed;
        }

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id:int}/stats")]
    public async Task<ActionResult<object>> GetStats(int id)
    {
        var userId = User.GetUserId();

        var habit = await _context.Habits
            .FirstOrDefaultAsync(h => h.Id == id && h.UserId == userId);

        if (habit is null)
        {
            return NotFound();
        }

        var createdDate = DateOnly.FromDateTime(habit.CreatedAt);

        var logs = await _context.HabitLogs
            .Where(l => l.HabitId == id)
            .ToListAsync();

        // Defensa: ignoramos logs anteriores a la creación del hábito (no deberían
        // existir en uso normal, pero si aparecen -p.ej. datos de prueba- no deben
        // distorsionar el cálculo).
        logs = logs.Where(l => l.Date >= createdDate).ToList();

        // NOTA: usamos DateTime.Now (hora del servidor, Madrid) en vez de UtcNow.
        // Limitación conocida: entre 00:00 y 02:00 en verano (UTC+2) esto asume que
        // el "día" ya cambió según la hora local, lo cual es correcto para el usuario
        // pero técnicamente distinto del día UTC. Suficiente para el alcance de este proyecto.
        var today = DateOnly.FromDateTime(DateTime.Now);

        var completedLogs = logs.Count(l => l.Completed);
        var totalLogs = logs.Count;

        double completionRate;

        if (habit.Frequency == HabitFrequency.Daily)
        {
            var elapsedDays = today.DayNumber - createdDate.DayNumber + 1;
            var completedDays = logs.Count(l => l.Completed);

            completionRate = elapsedDays <= 0
                ? 0
                : (double)completedDays / elapsedDays * 100;
        }
        else // Weekly
        {
            var elapsedWeeks = (today.DayNumber - createdDate.DayNumber) / 7 + 1;

            var completedWeeks = logs
                .Where(l => l.Completed)
                .Select(l => (l.Date.DayNumber - createdDate.DayNumber) / 7)
                .Distinct()
                .Count();

            completionRate = elapsedWeeks <= 0
                ? 0
                : (double)completedWeeks / elapsedWeeks * 100;
        }

        // Racha: si hoy todavía no está marcado, la racha sigue viva contando desde ayer
        // (el día de hoy aún no ha "fallado", simplemente no se ha registrado todavía).
        var completedDates = logs
            .Where(l => l.Completed)
            .Select(l => l.Date)
            .ToHashSet();

        var cursor = completedDates.Contains(today) ? today : today.AddDays(-1);
        var currentStreak = 0;

        while (completedDates.Contains(cursor))
        {
            currentStreak++;
            cursor = cursor.AddDays(-1);
        }

        return Ok(new
        {
            habitName = habit.Name,
            totalLogs,
            completedLogs,
            completionRate = Math.Round(completionRate, 1),
            currentStreak
        });
    }

    private static HabitDto MapToDto(Habit habit)
    {
        return new HabitDto
        {
            Id = habit.Id,
            Name = habit.Name,
            Frequency = habit.Frequency,
            CreatedAt = habit.CreatedAt
        };
    }
}