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
public class RoutinesController : ControllerBase
{
    private readonly AppDbContext _context;

    public RoutinesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoutineDto>>> GetAll()
    {
        var userId = User.GetUserId();

        var routines = await _context.Routines
            .Where(r => r.UserId == userId)
            .Include(r => r.RoutineExercises)
                .ThenInclude(re => re.Exercise)
            .ToListAsync();

        return Ok(routines.Select(MapToDto));
    }

    [HttpPost]
    public async Task<ActionResult<RoutineDto>> Create(CreateRoutineDto dto)
    {
        var userId = User.GetUserId();

        var exercisesExist = await _context.Exercises
            .CountAsync(e => dto.ExerciseIds.Contains(e.Id));

        if (exercisesExist != dto.ExerciseIds.Distinct().Count())
        {
            return BadRequest(new { error = "Uno o más ejercicios no existen." });
        }

        var routine = new Routine
        {
            UserId = userId,
            Name = dto.Name,
            CreatedAt = DateTime.UtcNow
        };

        for (int i = 0; i < dto.ExerciseIds.Count; i++)
        {
            routine.RoutineExercises.Add(new RoutineExercise
            {
                ExerciseId = dto.ExerciseIds[i],
                Order = i
            });
        }

        _context.Routines.Add(routine);
        await _context.SaveChangesAsync();

        await _context.Entry(routine)
            .Collection(r => r.RoutineExercises)
            .Query()
            .Include(re => re.Exercise)
            .LoadAsync();

        return CreatedAtAction(nameof(GetAll), MapToDto(routine));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();

        var routine = await _context.Routines
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

        if (routine is null)
        {
            return NotFound();
        }

        var isUsedInSessions = await _context.WorkoutSessions
            .AnyAsync(s => s.RoutineId == id);

        if (isUsedInSessions)
        {
            return Conflict(new { error = "No se puede eliminar: la rutina ya se usó en entrenos registrados." });
        }

        _context.Routines.Remove(routine);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static RoutineDto MapToDto(Routine routine)
    {
        return new RoutineDto
        {
            Id = routine.Id,
            Name = routine.Name,
            CreatedAt = routine.CreatedAt,
            Exercises = routine.RoutineExercises
                .OrderBy(re => re.Order)
                .Select(re => new RoutineExerciseDto
                {
                    ExerciseId = re.ExerciseId,
                    ExerciseName = re.Exercise?.Name ?? string.Empty,
                    Order = re.Order
                })
                .ToList()
        };
    }
}