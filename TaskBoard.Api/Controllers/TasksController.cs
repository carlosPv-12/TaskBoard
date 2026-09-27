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

    [HttpGet("{id}")]
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

    [HttpPut("{id}")]
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

    [HttpDelete("{id}")]
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
}