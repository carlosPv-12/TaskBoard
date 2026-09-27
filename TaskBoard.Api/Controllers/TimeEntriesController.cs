using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Extensions;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Route("api/tasks/{taskId}/timeentries")]
[Authorize]
public class TimeEntriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public TimeEntriesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TimeEntryDto>>> GetAll(int taskId)
    {
        var userId = User.GetUserId();

        var taskExists = await _context.Tasks
            .AnyAsync(t => t.Id == taskId && t.UserId == userId);

        if (!taskExists)
        {
            return NotFound();
        }

        var entries = await _context.TimeEntries
            .Where(e => e.TaskItemId == taskId)
            .OrderByDescending(e => e.StartedAt)
            .ToListAsync();

        return Ok(entries.Select(MapToDto));
    }

    [HttpPost("start")]
    public async Task<ActionResult<TimeEntryDto>> Start(int taskId)
    {
        var userId = User.GetUserId();

        var task = await _context.Tasks
            .FirstOrDefaultAsync(t => t.Id == taskId && t.UserId == userId);

        if (task is null)
        {
            return NotFound();
        }

        var hasActiveEntry = await _context.TimeEntries
            .AnyAsync(e => e.TaskItemId == taskId && e.StoppedAt == null);

        if (hasActiveEntry)
        {
            return BadRequest(new { error = "Ya hay un cronómetro activo para esta tarea." });
        }

        var entry = new TimeEntry
        {
            TaskItemId = taskId,
            StartedAt = DateTime.UtcNow
        };

        _context.TimeEntries.Add(entry);
        await _context.SaveChangesAsync();

        return Ok(MapToDto(entry));
    }

    [HttpPost("{entryId}/stop")]
    public async Task<ActionResult<TimeEntryDto>> Stop(int taskId, int entryId)
    {
        var userId = User.GetUserId();

        var taskExists = await _context.Tasks
            .AnyAsync(t => t.Id == taskId && t.UserId == userId);

        if (!taskExists)
        {
            return NotFound();
        }

        var entry = await _context.TimeEntries
            .FirstOrDefaultAsync(e => e.Id == entryId && e.TaskItemId == taskId);

        if (entry is null)
        {
            return NotFound();
        }

        if (entry.StoppedAt is not null)
        {
            return BadRequest(new { error = "Este cronómetro ya está parado." });
        }

        entry.StoppedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapToDto(entry));
    }

    private static TimeEntryDto MapToDto(TimeEntry entry)
    {
        int? durationSeconds = entry.StoppedAt is null
            ? null
            : (int)(entry.StoppedAt.Value - entry.StartedAt).TotalSeconds;

        return new TimeEntryDto
        {
            Id = entry.Id,
            StartedAt = entry.StartedAt,
            StoppedAt = entry.StoppedAt,
            DurationSeconds = durationSeconds
        };
    }
}