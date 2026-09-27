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
public class TasksController : ControllerBase
{
    private readonly AppDbContext _context;

    public TasksController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskDto>>> GetAll()
    {
        var userId = User.GetUserId();

        var tasks = await _context.Tasks
            .Where(t => t.UserId == userId)
            .ToListAsync();

        return Ok(tasks.Select(MapToDto));
    }

    // GET /api/Tasks/stats?period=week&date=2026-09-27&timeZone=Europe/Madrid
    [HttpGet("stats")]
    public async Task<ActionResult<TaskTimeStatsDto>> GetStats(
        [FromQuery] string period = "week",
        [FromQuery] DateOnly? date = null,
        [FromQuery] string timeZone = "UTC")
    {
        if (period != "week" && period != "month")
        {
            return BadRequest(new { error = "El parámetro 'period' debe ser 'week' o 'month'." });
        }

        var userId = User.GetUserId();
        var tz = ResolveTimeZone(timeZone);

        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        var referenceDate = date ?? todayLocal;

        DateOnly from, to, previousFrom;

        if (period == "week")
        {
            // Lunes=0 ... Domingo=6, en vez del Domingo=0 por defecto de .NET
            var diffToMonday = ((int)referenceDate.DayOfWeek + 6) % 7;
            from = referenceDate.AddDays(-diffToMonday);
            to = from.AddDays(6);
            previousFrom = from.AddDays(-7);
        }
        else
        {
            from = new DateOnly(referenceDate.Year, referenceDate.Month, 1);
            to = from.AddMonths(1).AddDays(-1);
            previousFrom = from.AddMonths(-1);
        }

        // Los tres instantes que gobiernan todo el cálculo, ya en UTC
        var periodStartUtc = LocalMidnightToUtc(from, tz);
        var periodEndUtc = LocalMidnightToUtc(to.AddDays(1), tz); // límite exclusivo
        var previousStartUtc = LocalMidnightToUtc(previousFrom, tz);
        // El fin del periodo anterior coincide exactamente con el inicio del actual

        var entries = await _context.TimeEntries
            .Where(te => te.TaskItem!.UserId == userId &&
                         te.StartedAt < periodEndUtc &&
                         (te.StoppedAt == null || te.StoppedAt > previousStartUtc))
            .Select(te => new { te.StartedAt, te.StoppedAt })
            .ToListAsync();

        var nowUtc = DateTime.UtcNow;

        var daySeconds = new Dictionary<DateOnly, double>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            daySeconds[d] = 0;
        }

        double previousTotalSeconds = 0;

        foreach (var entry in entries)
        {
            var effectiveEnd = entry.StoppedAt ?? nowUtc;

            // Recorte al periodo actual, repartido por día local
            var overlapStart = entry.StartedAt > periodStartUtc ? entry.StartedAt : periodStartUtc;
            var overlapEnd = effectiveEnd < periodEndUtc ? effectiveEnd : periodEndUtc;
            if (overlapEnd > overlapStart)
            {
                DistributeAcrossLocalDays(overlapStart, overlapEnd, tz, daySeconds);
            }

            // Recorte al periodo anterior, solo el total (no hace falta por día)
            var prevStart = entry.StartedAt > previousStartUtc ? entry.StartedAt : previousStartUtc;
            var prevEnd = effectiveEnd < periodStartUtc ? effectiveEnd : periodStartUtc;
            if (prevEnd > prevStart)
            {
                previousTotalSeconds += (prevEnd - prevStart).TotalSeconds;
            }
        }

        var days = daySeconds
            .OrderBy(kv => kv.Key)
            .Select(kv => new DayTimeDto { Date = kv.Key, Seconds = (int)Math.Round(kv.Value) })
            .ToList();

        return Ok(new TaskTimeStatsDto
        {
            Period = period,
            From = from,
            To = to,
            TotalSeconds = days.Sum(d => d.Seconds),
            PreviousTotalSeconds = (int)Math.Round(previousTotalSeconds),
            ActiveDays = days.Count(d => d.Seconds > 0),
            Days = days
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaskDto>> GetById(int id)
    {
        var userId = User.GetUserId();

        var task = await _context.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        if (task is null)
        {
            return NotFound();
        }

        return Ok(MapToDto(task));
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create(CreateTaskDto dto)
    {
        var userId = User.GetUserId();

        var task = new TaskItem
        {
            UserId = userId,
            Title = dto.Title,
            IsDone = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id }, MapToDto(task));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateTaskDto dto)
    {
        var userId = User.GetUserId();

        var task = await _context.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        if (task is null)
        {
            return NotFound();
        }

        task.Title = dto.Title;
        task.IsDone = dto.IsDone;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();

        var task = await _context.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        if (task is null)
        {
            return NotFound();
        }

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static TaskDto MapToDto(TaskItem task)
    {
        return new TaskDto
        {
            Id = task.Id,
            Title = task.Title,
            IsDone = task.IsDone,
            CreatedAt = task.CreatedAt
        };
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }

    private static DateTime LocalMidnightToUtc(DateOnly date, TimeZoneInfo tz)
    {
        var localMidnight = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
    }

    // Reparte un intervalo [inicio, fin) en UTC entre los días locales que cruza
    private static void DistributeAcrossLocalDays(
        DateTime overlapStartUtc, DateTime overlapEndUtc, TimeZoneInfo tz, Dictionary<DateOnly, double> daySeconds)
    {
        var cursor = TimeZoneInfo.ConvertTimeFromUtc(overlapStartUtc, tz);
        var end = TimeZoneInfo.ConvertTimeFromUtc(overlapEndUtc, tz);

        while (cursor < end)
        {
            var currentDate = DateOnly.FromDateTime(cursor);
            var nextMidnight = cursor.Date.AddDays(1);
            var segmentEnd = nextMidnight < end ? nextMidnight : end;

            if (daySeconds.ContainsKey(currentDate))
            {
                daySeconds[currentDate] += (segmentEnd - cursor).TotalSeconds;
            }

            cursor = segmentEnd;
        }
    }
}