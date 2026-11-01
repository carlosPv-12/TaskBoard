using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Extensions;
using TaskBoard.Api.Services;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RemindersController : ControllerBase
{
    private readonly AppDbContext _context;

    public RemindersController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/Reminders?date=2026-11-01
    // "date" es el día LOCAL del móvil: define cuál es "hoy" y qué semana se cuenta.
    [HttpGet]
    public async Task<ActionResult<RemindersDto>> Get([FromQuery] DateOnly? date)
    {
        var userId = User.GetUserId();
        var today = date ?? DateOnly.FromDateTime(DateTime.Now);
        var weekStart = HabitProgress.StartOfWeek(today);
        var weekEnd = weekStart.AddDays(6);

        // Una sola consulta: EF traduce los Count/Any sobre Logs a subconsultas SQL
        var habits = await _context.Habits
            .Where(h => h.UserId == userId)
            .OrderBy(h => h.SortOrder)
            .ThenBy(h => h.Id)
            .Select(h => new HabitReminderDto
            {
                Id = h.Id,
                Name = h.Name,
                TimesPerWeek = h.TimesPerWeek,
                DoneThisWeek = h.Logs.Count(l => l.Completed && l.Date >= weekStart && l.Date <= weekEnd),
                DoneToday = h.Logs.Any(l => l.Completed && l.Date == today)
            })
            .ToListAsync();

        // Tareas pendientes que NO tienen el cronómetro en marcha
        var tasks = await _context.Tasks
            .Where(t => t.UserId == userId && !t.IsDone && !t.TimeEntries.Any(e => e.StoppedAt == null))
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.CreatedAt,
                LastStop = t.TimeEntries.Max(e => (DateTime?)e.StoppedAt)
            })
            .ToListAsync();

        return Ok(new RemindersDto
        {
            Date = today,
            WeekStart = weekStart,
            Habits = habits,
            Tasks = tasks
                .Select(t => new TaskReminderDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    // Los agregados (MAX) no pasan por el conversor de UTC: se marca a mano
                    LastActivityAt = DateTime.SpecifyKind(t.LastStop ?? t.CreatedAt, DateTimeKind.Utc)
                })
                .OrderBy(t => t.LastActivityAt)
                .ToList()
        });
    }
}
