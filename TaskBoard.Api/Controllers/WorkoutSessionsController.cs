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
public class WorkoutSessionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public WorkoutSessionsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/workoutsessions -> calendario: lista ligera, sin ejercicios
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WorkoutSessionDto>>> GetAll()
    {
        var userId = User.GetUserId();

        var sessions = await _context.WorkoutSessions
            .Where(s => s.UserId == userId)
            .Include(s => s.Routine)
            .OrderByDescending(s => s.Date)
            .ToListAsync();

        return Ok(sessions.Select(s => MapToDto(s, includeExercises: false)));
    }

    // GET /api/workoutsessions/5 -> detalle completo, con ejercicios y series
    [HttpGet("{id}")]
    public async Task<ActionResult<WorkoutSessionDto>> GetById(int id)
    {
        var userId = User.GetUserId();

        var session = await _context.WorkoutSessions
            .Where(s => s.Id == id && s.UserId == userId)
            .Include(s => s.Routine)
            .Include(s => s.SessionExercises)
                .ThenInclude(se => se.Exercise)
            .Include(s => s.SessionExercises)
                .ThenInclude(se => se.Sets)
            .FirstOrDefaultAsync();

        if (session is null)
        {
            return NotFound();
        }

        return Ok(MapToDto(session, includeExercises: true));
    }

        // POST /api/workoutsessions -> crea la sesión; si lleva RoutineId, precarga los ejercicios de la plantilla
        [HttpPost]
        public async Task<ActionResult<WorkoutSessionDto>> Create(CreateWorkoutSessionDto dto)
        {
            var userId = User.GetUserId();

            var session = new WorkoutSession
            {
                UserId = userId,
                Date = dto.Date,
                DurationMinutes = dto.DurationMinutes
            };

            if (dto.RoutineId is not null)
            {
                var routine = await _context.Routines
                    .Where(r => r.Id == dto.RoutineId && r.UserId == userId)
                    .Include(r => r.RoutineExercises)
                    .FirstOrDefaultAsync();

                if (routine is null)
                {
                    return BadRequest(new { error = "La rutina indicada no existe." });
                }

                session.RoutineId = routine.Id;

                foreach (var re in routine.RoutineExercises.OrderBy(re => re.Order))
                {
                    session.SessionExercises.Add(new SessionExercise
                    {
                        ExerciseId = re.ExerciseId,
                        Order = re.Order
                    });
                }
            }

            _context.WorkoutSessions.Add(session);
            await _context.SaveChangesAsync();

            await _context.Entry(session)
                .Collection(s => s.SessionExercises)
                .Query()
                .Include(se => se.Exercise)
                .LoadAsync();

            return CreatedAtAction(nameof(GetById), new { id = session.Id }, MapToDto(session, includeExercises: true));
        }

    // POST /api/workoutsessions/5/exercises -> añade un ejercicio suelto (entreno libre o extra fuera de la rutina)
    [HttpPost("{sessionId}/exercises")]
    public async Task<ActionResult<SessionExerciseDto>> AddExercise(int sessionId, AddSessionExerciseDto dto)
    {
        var userId = User.GetUserId();

        var session = await _context.WorkoutSessions
            .Include(s => s.SessionExercises)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session is null)
        {
            return NotFound();
        }

        var exercise = await _context.Exercises.FindAsync(dto.ExerciseId);

        if (exercise is null)
        {
            return BadRequest(new { error = "El ejercicio indicado no existe." });
        }

        var nextOrder = session.SessionExercises.Count == 0
            ? 0
            : session.SessionExercises.Max(se => se.Order) + 1;

        var sessionExercise = new SessionExercise
        {
            WorkoutSessionId = sessionId,
            ExerciseId = dto.ExerciseId,
            Order = nextOrder
        };

        _context.SessionExercises.Add(sessionExercise);
        await _context.SaveChangesAsync();

        return Ok(new SessionExerciseDto
        {
            Id = sessionExercise.Id,
            ExerciseId = exercise.Id,
            ExerciseName = exercise.Name,
            Order = sessionExercise.Order,
            Sets = new List<WorkoutSetDto>()
        });
    }

    // POST /api/workoutsessions/5/exercises/12/sets -> registra una serie (peso + reps)
    [HttpPost("{sessionId}/exercises/{sessionExerciseId}/sets")]
    public async Task<ActionResult<WorkoutSetDto>> AddSet(int sessionId, int sessionExerciseId, CreateWorkoutSetDto dto)
    {
        var userId = User.GetUserId();

        var sessionExercise = await _context.SessionExercises
            .Include(se => se.WorkoutSession)
            .Include(se => se.Sets)
            .FirstOrDefaultAsync(se =>
                se.Id == sessionExerciseId &&
                se.WorkoutSessionId == sessionId &&
                se.WorkoutSession!.UserId == userId);

        if (sessionExercise is null)
        {
            return NotFound();
        }

        var nextSetNumber = sessionExercise.Sets.Count == 0
            ? 1
            : sessionExercise.Sets.Max(s => s.SetNumber) + 1;

        var set = new WorkoutSet
        {
            SessionExerciseId = sessionExerciseId,
            SetNumber = nextSetNumber,
            Weight = dto.Weight,
            Reps = dto.Reps
        };

        _context.WorkoutSets.Add(set);
        await _context.SaveChangesAsync();

        return Ok(new WorkoutSetDto
        {
            Id = set.Id,
            SetNumber = set.SetNumber,
            Weight = set.Weight,
            Reps = set.Reps
        });
    }

    private static WorkoutSessionDto MapToDto(WorkoutSession session, bool includeExercises)
    {
        return new WorkoutSessionDto
        {
            Id = session.Id,
            Date = session.Date,
            RoutineId = session.RoutineId,
            RoutineName = session.Routine?.Name,
            DurationMinutes = session.DurationMinutes,
            Exercises = includeExercises
                ? session.SessionExercises
                    .OrderBy(se => se.Order)
                    .Select(se => new SessionExerciseDto
                    {
                        Id = se.Id,
                        ExerciseId = se.ExerciseId,
                        ExerciseName = se.Exercise?.Name ?? string.Empty,
                        Order = se.Order,
                        Sets = se.Sets
                            .OrderBy(s => s.SetNumber)
                            .Select(s => new WorkoutSetDto
                            {
                                Id = s.Id,
                                SetNumber = s.SetNumber,
                                Weight = s.Weight,
                                Reps = s.Reps
                            })
                            .ToList()
                    })
                    .ToList()
                : new List<SessionExerciseDto>()
        };
    }

        // GET /api/workoutsessions/progress/3 -> histórico de un ejercicio para la gráfica
        [HttpGet("progress/{exerciseId}")]
        public async Task<ActionResult<IEnumerable<ExerciseProgressPointDto>>> GetProgress(int exerciseId)
        {
            var userId = User.GetUserId();

            var data = await _context.WorkoutSets
                .Where(set =>
                    set.SessionExercise!.ExerciseId == exerciseId &&
                    set.SessionExercise.WorkoutSession!.UserId == userId)
                .Select(set => new
                {
                    set.SessionExercise!.WorkoutSession!.Date,
                    set.Weight,
                    set.Reps
                })
                .ToListAsync();

            var progress = data
                .GroupBy(x => x.Date)
                .Select(g => new ExerciseProgressPointDto
                {
                    Date = g.Key,
                    MaxWeight = g.Max(x => x.Weight),
                    TotalVolume = g.Sum(x => x.Weight * x.Reps)
                })
                .OrderBy(p => p.Date)
                .ToList();

            return Ok(progress);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateWorkoutSessionDto dto)
        {
            var userId = User.GetUserId();

            var session = await _context.WorkoutSessions
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

            if (session is null)
            {
                return NotFound();
            }

            session.DurationMinutes = dto.DurationMinutes;
            await _context.SaveChangesAsync();

            return NoContent();
        }

            [HttpDelete("{id}")]
            public async Task<IActionResult> Delete(int id)
            {
                var userId = User.GetUserId();

                var session = await _context.WorkoutSessions
                    .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

                if (session is null)
                {
                    return NotFound();
                }

                _context.WorkoutSessions.Remove(session);
                await _context.SaveChangesAsync();

                return NoContent();
            }

            [HttpDelete("{sessionId}/exercises/{sessionExerciseId}")]
            public async Task<IActionResult> DeleteExercise(int sessionId, int sessionExerciseId)
            {
                var userId = User.GetUserId();

                var sessionExercise = await _context.SessionExercises
                    .Include(se => se.WorkoutSession)
                    .FirstOrDefaultAsync(se =>
                        se.Id == sessionExerciseId &&
                        se.WorkoutSessionId == sessionId &&
                        se.WorkoutSession!.UserId == userId);

                if (sessionExercise is null)
                {
                    return NotFound();
                }

                _context.SessionExercises.Remove(sessionExercise);
                await _context.SaveChangesAsync();

                return NoContent();
            }

            [HttpDelete("{sessionId}/exercises/{sessionExerciseId}/sets/{setId}")]
            public async Task<IActionResult> DeleteSet(int sessionId, int sessionExerciseId, int setId)
            {
                var userId = User.GetUserId();

                var set = await _context.WorkoutSets
                    .Include(s => s.SessionExercise)
                        .ThenInclude(se => se!.WorkoutSession)
                    .FirstOrDefaultAsync(s =>
                        s.Id == setId &&
                        s.SessionExerciseId == sessionExerciseId &&
                        s.SessionExercise!.WorkoutSessionId == sessionId &&
                        s.SessionExercise.WorkoutSession!.UserId == userId);

                if (set is null)
                {
                    return NotFound();
                }

                _context.WorkoutSets.Remove(set);
                await _context.SaveChangesAsync();

                // Renumerar las series restantes para que queden consecutivas (1, 2, 3...)
                var remainingSets = await _context.WorkoutSets
                    .Where(s => s.SessionExerciseId == sessionExerciseId)
                    .OrderBy(s => s.SetNumber)
                    .ToListAsync();

                for (int i = 0; i < remainingSets.Count; i++)
                {
                    remainingSets[i].SetNumber = i + 1;
                }

                await _context.SaveChangesAsync();

                return NoContent();
            }
}