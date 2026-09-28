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
public class ExercisesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ExercisesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExerciseDto>>> GetAll()
    {
        var userId = User.GetUserId();

        var exercises = await _context.Exercises
            .Where(e => e.UserId == userId)
            .OrderBy(e => e.Name)
            .ToListAsync();

        return Ok(exercises.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExerciseDto>> GetById(int id)
    {
        var exercise = await FindOwnedAsync(id);
        return exercise is null ? NotFound() : Ok(MapToDto(exercise));
    }

    [HttpPost]
    public async Task<ActionResult<ExerciseDto>> Create(CreateExerciseDto dto)
    {
        var exercise = new Exercise
        {
            Name = dto.Name,
            MuscleGroup = dto.MuscleGroup,
            UserId = User.GetUserId()
        };

        _context.Exercises.Add(exercise);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = exercise.Id }, MapToDto(exercise));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateExerciseDto dto)
    {
        var exercise = await FindOwnedAsync(id);

        if (exercise is null)
        {
            return NotFound();
        }

        exercise.Name = dto.Name;
        exercise.MuscleGroup = dto.MuscleGroup;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var exercise = await FindOwnedAsync(id);

        if (exercise is null)
        {
            return NotFound();
        }

        var isUsedInRoutines = await _context.RoutineExercises.AnyAsync(re => re.ExerciseId == id);
        var isUsedInSessions = await _context.SessionExercises.AnyAsync(se => se.ExerciseId == id);

        if (isUsedInRoutines || isUsedInSessions)
        {
            return Conflict(new { error = "No se puede eliminar: el ejercicio ya se usa en una rutina o en un entreno registrado." });
        }

        _context.Exercises.Remove(exercise);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // Equivalente a findByIdAndUserId(id, userId) de Spring Data:
    // si no existe o no es tuyo, el resultado es el mismo (null → 404).
    private Task<Exercise?> FindOwnedAsync(int id)
    {
        var userId = User.GetUserId();
        return _context.Exercises.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);
    }

    private static ExerciseDto MapToDto(Exercise exercise) => new()
    {
        Id = exercise.Id,
        Name = exercise.Name,
        MuscleGroup = exercise.MuscleGroup
    };
}