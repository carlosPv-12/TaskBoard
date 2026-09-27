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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WorkoutSet>()
            .Property(s => s.Weight)
            .HasPrecision(18, 2);
    }

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
        }
}