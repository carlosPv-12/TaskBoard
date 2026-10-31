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
            .Include(s => s.SessionRoutines)
                .ThenInclude(sr => sr.Routine)
            .OrderByDescending(s => s.Date)
            .ToListAsync();

        return Ok(sessions.Select(s => MapToDto(s, includeExercises: false)));
    }

    // GET /api/workoutsessions/5 -> detalle completo, con rutinas, ejercicios y series
    [HttpGet("{id}")]
    public async Task<ActionResult<WorkoutSessionDto>> GetById(int id)
    {
        var session = await LoadFullSessionAsync(id, User.GetUserId());

        return session is null ? NotFound() : Ok(MapToDto(session, includeExercises: true));
    }

    // POST /api/workoutsessions -> crea el entreno; si lleva RoutineId, carga los ejercicios de esa rutina
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
            var routine = await FindOwnedRoutineAsync(dto.RoutineId.Value, userId);

            if (routine is null)
            {
                return BadRequest(new { error = "La rutina indicada no existe." });
            }

            AppendRoutine(session, routine);
        }

        _context.WorkoutSessions.Add(session);
        await _context.SaveChangesAsync();

        var created = await LoadFullSessionAsync(session.Id, userId);

        return CreatedAtAction(nameof(GetById), new { id = session.Id }, MapToDto(created!, includeExercises: true));
    }

    // POST /api/workoutsessions/5/routines -> añade otra rutina al entreno: sus ejercicios se suman al final
    [HttpPost("{sessionId}/routines")]
    public async Task<ActionResult<WorkoutSessionDto>> AddRoutine(int sessionId, AddSessionRoutineDto dto)
    {
        var userId = User.GetUserId();

        var session = await _context.WorkoutSessions
            .Include(s => s.SessionExercises)
            .Include(s => s.SessionRoutines)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session is null)
        {
            return NotFound();
        }

        if (session.SessionRoutines.Any(sr => sr.RoutineId == dto.RoutineId))
        {
            return Conflict(new { error = "Esa rutina ya está en este entreno." });
        }

        var routine = await FindOwnedRoutineAsync(dto.RoutineId, userId);

        if (routine is null)
        {
            return BadRequest(new { error = "La rutina indicada no existe." });
        }

        AppendRoutine(session, routine);
        await _context.SaveChangesAsync();

        var updated = await LoadFullSessionAsync(sessionId, userId);

        return Ok(MapToDto(updated!, includeExercises: true));
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

        // Solo ejercicios propios (antes bastaba con que existiera, aunque fuera de otro usuario)
        var exercise = await _context.Exercises
            .FirstOrDefaultAsync(e => e.Id == dto.ExerciseId && e.UserId == userId);

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
            ExerciseType = exercise.Type,
            Order = sessionExercise.Order,
            Sets = new List<WorkoutSetDto>()
        });
    }

    // POST /api/workoutsessions/5/exercises/12/sets -> registra una serie (los campos dependen del tipo de ejercicio)
    [HttpPost("{sessionId}/exercises/{sessionExerciseId}/sets")]
    public async Task<ActionResult<WorkoutSetDto>> AddSet(int sessionId, int sessionExerciseId, CreateWorkoutSetDto dto)
    {
        var userId = User.GetUserId();

        var sessionExercise = await _context.SessionExercises
            .Include(se => se.WorkoutSession)
            .Include(se => se.Exercise)
            .Include(se => se.Sets)
            .FirstOrDefaultAsync(se =>
                se.Id == sessionExerciseId &&
                se.WorkoutSessionId == sessionId &&
                se.WorkoutSession!.UserId == userId);

        if (sessionExercise is null)
        {
            return NotFound();
        }

        var type = sessionExercise.Exercise!.Type;
        var validationError = ValidateSet(type, dto);

        if (validationError is not null)
        {
            return BadRequest(new { error = validationError });
        }

        var nextSetNumber = sessionExercise.Sets.Count == 0
            ? 1
            : sessionExercise.Sets.Max(s => s.SetNumber) + 1;

        var set = new WorkoutSet
        {
            SessionExerciseId = sessionExerciseId,
            SetNumber = nextSetNumber,
            // En fuerza, sin peso = peso corporal (0); en tiempo, el peso es opcional de verdad (null)
            Weight = type == ExerciseType.Strength ? dto.Weight ?? 0 : dto.Weight,
            Reps = dto.Reps,
            DurationSeconds = dto.DurationSeconds,
            DistanceKm = dto.DistanceKm
        };

        _context.WorkoutSets.Add(set);
        await _context.SaveChangesAsync();

        return Ok(MapSet(set));
    }

    // GET /api/workoutsessions/progress/3 -> histórico de un ejercicio para la gráfica (un punto por día)
    [HttpGet("progress/{exerciseId}")]
    public async Task<ActionResult<IEnumerable<ExerciseProgressPointDto>>> GetProgress(int exerciseId)
    {
        var userId = User.GetUserId();

        var exercise = await _context.Exercises
            .FirstOrDefaultAsync(e => e.Id == exerciseId && e.UserId == userId);

        if (exercise is null)
        {
            return NotFound();
        }

        var data = await _context.WorkoutSets
            .Where(set =>
                set.SessionExercise!.ExerciseId == exerciseId &&
                set.SessionExercise.WorkoutSession!.UserId == userId)
            .Select(set => new
            {
                set.SessionExercise!.WorkoutSession!.Date,
                set.Weight,
                set.Reps,
                set.DurationSeconds,
                set.DistanceKm
            })
            .ToListAsync();

        var isTime = exercise.Type == ExerciseType.Time;

        var progress = data
            .GroupBy(x => x.Date)
            .Select(g => new ExerciseProgressPointDto
            {
                Date = g.Key,
                MaxWeight = g.Max(x => x.Weight ?? 0),
                TotalVolume = g.Sum(x => (x.Weight ?? 0) * (x.Reps ?? 0)),
                MaxDurationSeconds = isTime ? g.Max(x => x.DurationSeconds ?? 0) : null,
                TotalDurationSeconds = isTime ? g.Sum(x => x.DurationSeconds ?? 0) : null,
                TotalDistanceKm = isTime ? g.Sum(x => x.DistanceKm ?? 0) : null
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

    // ── Ayudantes ───────────────────────────────────────────

    private Task<WorkoutSession?> LoadFullSessionAsync(int id, int userId) =>
        _context.WorkoutSessions
            .Where(s => s.Id == id && s.UserId == userId)
            .Include(s => s.SessionRoutines)
                .ThenInclude(sr => sr.Routine)
            .Include(s => s.SessionExercises)
                .ThenInclude(se => se.Exercise)
            .Include(s => s.SessionExercises)
                .ThenInclude(se => se.Sets)
            .AsSplitQuery() // varias consultas pequeñas en vez de un JOIN que multiplica filas
            .FirstOrDefaultAsync();

    private Task<Routine?> FindOwnedRoutineAsync(int routineId, int userId) =>
        _context.Routines
            .Include(r => r.RoutineExercises)
            .FirstOrDefaultAsync(r => r.Id == routineId && r.UserId == userId);

    /// <summary>Copia los ejercicios de la rutina al final del entreno y registra la rutina en él.</summary>
    private static void AppendRoutine(WorkoutSession session, Routine routine)
    {
        var nextOrder = session.SessionExercises.Count == 0
            ? 0
            : session.SessionExercises.Max(se => se.Order) + 1;

        foreach (var routineExercise in routine.RoutineExercises.OrderBy(re => re.Order))
        {
            session.SessionExercises.Add(new SessionExercise
            {
                ExerciseId = routineExercise.ExerciseId,
                Order = nextOrder++
            });
        }

        var nextRoutineOrder = session.SessionRoutines.Count == 0
            ? 0
            : session.SessionRoutines.Max(sr => sr.Order) + 1;

        session.SessionRoutines.Add(new WorkoutSessionRoutine
        {
            RoutineId = routine.Id,
            Order = nextRoutineOrder
        });
    }

    /// <summary>Qué campos exige cada tipo de ejercicio. Devuelve el mensaje de error o null si es válida.</summary>
    private static string? ValidateSet(ExerciseType type, CreateWorkoutSetDto dto) => type switch
    {
        ExerciseType.Strength when dto.Reps is null =>
            "Indica las repeticiones de la serie.",
        ExerciseType.Strength when dto.DurationSeconds is not null || dto.DistanceKm is not null =>
            "Un ejercicio de fuerza no lleva tiempo ni distancia.",
        ExerciseType.Time when dto.DurationSeconds is null =>
            "Indica la duración de la serie.",
        ExerciseType.Time when dto.Reps is not null =>
            "Un ejercicio de tiempo no lleva repeticiones.",
        _ => null
    };

    private static WorkoutSetDto MapSet(WorkoutSet set) => new()
    {
        Id = set.Id,
        SetNumber = set.SetNumber,
        Weight = set.Weight,
        Reps = set.Reps,
        DurationSeconds = set.DurationSeconds,
        DistanceKm = set.DistanceKm
    };

    private static WorkoutSessionDto MapToDto(WorkoutSession session, bool includeExercises)
    {
        var routines = session.SessionRoutines
            .Where(sr => sr.Routine is not null)
            .OrderBy(sr => sr.Order)
            .Select(sr => new SessionRoutineDto { Id = sr.RoutineId, Name = sr.Routine!.Name })
            .ToList();

        return new WorkoutSessionDto
        {
            Id = session.Id,
            Date = session.Date,
            Routines = routines,
            RoutineId = routines.FirstOrDefault()?.Id,
            RoutineName = routines.Count == 0 ? null : string.Join(" + ", routines.Select(r => r.Name)),
            DurationMinutes = session.DurationMinutes,
            Exercises = includeExercises
                ? session.SessionExercises
                    .OrderBy(se => se.Order)
                    .Select(se => new SessionExerciseDto
                    {
                        Id = se.Id,
                        ExerciseId = se.ExerciseId,
                        ExerciseName = se.Exercise?.Name ?? string.Empty,
                        ExerciseType = se.Exercise?.Type ?? ExerciseType.Strength,
                        Order = se.Order,
                        Sets = se.Sets.OrderBy(s => s.SetNumber).Select(MapSet).ToList()
                    })
                    .ToList()
                : new List<SessionExerciseDto>()
        };
    }
}
