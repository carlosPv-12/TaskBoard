using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<TaskItem> Tasks { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<TimeEntry> TimeEntries { get; set; }
    public DbSet<Habit> Habits { get; set; }
    public DbSet<HabitLog> HabitLogs { get; set; }
    public DbSet<Exercise> Exercises { get; set; }
    public DbSet<Routine> Routines { get; set; }
    public DbSet<RoutineExercise> RoutineExercises { get; set; }
    public DbSet<WorkoutSession> WorkoutSessions { get; set; }
    public DbSet<SessionExercise> SessionExercises { get; set; }
    public DbSet<WorkoutSet> WorkoutSets { get; set; }
    public DbSet<WorkoutSessionRoutine> WorkoutSessionRoutines { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

   protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<RefreshToken>(entity =>
    {
        entity.Property(r => r.TokenHash).HasMaxLength(64); // SHA-256 en hexadecimal
        entity.HasIndex(r => r.TokenHash).IsUnique();       // la búsqueda es siempre por hash
        entity.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);              // borrar usuario = borrar sus sesiones
    });

    modelBuilder.Entity<PasswordResetToken>(entity =>
    {
        entity.Property(r => r.TokenHash).HasMaxLength(64);
        entity.HasIndex(r => r.TokenHash).IsUnique();
        entity.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    });

    modelBuilder.Entity<Exercise>()
        .HasOne<User>()
        .WithMany()
        .HasForeignKey(e => e.UserId)
        .OnDelete(DeleteBehavior.Restrict); // evita el error "multiple cascade paths" de SQL Server

    // Precisión explícita del peso: hasta 999.999,99 (equivale a @Column(precision = 8, scale = 2) en JPA)
    modelBuilder.Entity<WorkoutSet>()
        .Property(s => s.Weight)
        .HasPrecision(8, 2);

    // Distancia en km con 2 decimales: hasta 99.999,99 km
    modelBuilder.Entity<WorkoutSet>()
        .Property(s => s.DistanceKm)
        .HasPrecision(7, 2);

    modelBuilder.Entity<WorkoutSessionRoutine>(entity =>
    {
        // Clave compuesta: una rutina no puede estar dos veces en el mismo entreno
        entity.HasKey(sr => new { sr.WorkoutSessionId, sr.RoutineId });

        entity.HasOne(sr => sr.WorkoutSession)
            .WithMany(s => s.SessionRoutines)
            .HasForeignKey(sr => sr.WorkoutSessionId)
            .OnDelete(DeleteBehavior.Cascade);   // borrar el entreno borra sus vínculos

        entity.HasOne(sr => sr.Routine)
            .WithMany()
            .HasForeignKey(sr => sr.RoutineId)
            .OnDelete(DeleteBehavior.Restrict);  // una rutina usada en entrenos no se puede borrar
    });
}
        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
        }
}