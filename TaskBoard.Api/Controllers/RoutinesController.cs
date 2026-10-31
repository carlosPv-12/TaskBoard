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

        if (!await ExercisesBelongToUserAsync(dto.ExerciseIds, userId))
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

        await LoadExercisesAsync(routine);

        return CreatedAtAction(nameof(GetAll), MapToDto(routine));
    }

    // PUT /api/Routines/5 -> cambia el nombre y la lista de ejercicios (orden incluido).
    // Los entrenos ya registrados NO cambian: cada entreno guarda su propia copia de los ejercicios.
    [HttpPut("{id}")]
    public async Task<ActionResult<RoutineDto>> Update(int id, UpdateRoutineDto dto)
    {
        var userId = User.GetUserId();

        var routine = await _context.Routines
            .Include(r => r.RoutineExercises)
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

        if (routine is null)
        {
            return NotFound();
        }

        if (!await ExercisesBelongToUserAsync(dto.ExerciseIds, userId))
        {
            return BadRequest(new { error = "Uno o más ejercicios no existen." });
        }

        routine.Name = dto.Name;

        // Se sustituye la lista entera: más simple y fiable que calcular altas, bajas y cambios de orden
        _context.RoutineExercises.RemoveRange(routine.RoutineExercises.ToList());

        for (int i = 0; i < dto.ExerciseIds.Count; i++)
        {
            _context.RoutineExercises.Add(new RoutineExercise
            {
                RoutineId = routine.Id,
                ExerciseId = dto.ExerciseIds[i],
                Order = i
            });
        }

        await _context.SaveChangesAsync();

        await LoadExercisesAsync(routine);

        return Ok(MapToDto(routine));
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

        var isUsedInSessions =
            await _context.WorkoutSessionRoutines.AnyAsync(sr => sr.RoutineId == id) ||
            await _context.WorkoutSessions.AnyAsync(s => s.RoutineId == id);

        if (isUsedInSessions)
        {
            return Conflict(new { error = "No se puede eliminar: la rutina ya se usó en entrenos registrados." });
        }

        _context.Routines.Remove(routine);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>Todos los ids existen y son del usuario (evita colar ejercicios de otra cuenta).</summary>
    private async Task<bool> ExercisesBelongToUserAsync(List<int> exerciseIds, int userId)
    {
        var distinctIds = exerciseIds.Distinct().ToList();

        var owned = await _context.Exercises
            .CountAsync(e => distinctIds.Contains(e.Id) && e.UserId == userId);

        return owned == distinctIds.Count;
    }

    private Task LoadExercisesAsync(Routine routine) =>
        _context.Entry(routine)
            .Collection(r => r.RoutineExercises)
            .Query()
            .Include(re => re.Exercise)
            .LoadAsync();

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
                    ExerciseType = re.Exercise?.Type ?? ExerciseType.Strength,
                    Order = re.Order
                })
                .ToList()
        };
    }
}
