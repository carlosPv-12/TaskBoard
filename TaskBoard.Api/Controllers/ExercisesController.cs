using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
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
        var exercises = await _context.Exercises.ToListAsync();
        return Ok(exercises.Select(MapToDto));
    }

    [HttpPost]
    public async Task<ActionResult<ExerciseDto>> Create(CreateExerciseDto dto)
    {
        var exercise = new Exercise
        {
            Name = dto.Name,
            MuscleGroup = dto.MuscleGroup
        };

        _context.Exercises.Add(exercise);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), MapToDto(exercise));
    }

    private static ExerciseDto MapToDto(Exercise exercise)
    {
        return new ExerciseDto
        {
            Id = exercise.Id,
            Name = exercise.Name,
            MuscleGroup = exercise.MuscleGroup
        };
    }
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateExerciseDto dto)
        {
            var exercise = await _context.Exercises.FindAsync(id);

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
            var exercise = await _context.Exercises.FindAsync(id);

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
}