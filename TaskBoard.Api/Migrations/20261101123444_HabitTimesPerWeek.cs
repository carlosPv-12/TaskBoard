using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskBoard.Api.Migrations
{
    /// <inheritdoc />
    public partial class HabitTimesPerWeek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Frequency",
                table: "Habits",
                newName: "TimesPerWeek");

            // La columna guardaba el enum: 0 = Daily, 1 = Weekly. Se traduce a veces por semana:
            // Diario → 7, Semanal → 1. Mismo nombre de columna, distinto significado del número.
            migrationBuilder.Sql(
                "UPDATE [Habits] SET [TimesPerWeek] = CASE WHEN [TimesPerWeek] = 1 THEN 1 ELSE 7 END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Vuelta atrás aproximada: 7 → Daily (0); cualquier otro objetivo → Weekly (1)
            migrationBuilder.Sql(
                "UPDATE [Habits] SET [TimesPerWeek] = CASE WHEN [TimesPerWeek] = 7 THEN 0 ELSE 1 END;");

            migrationBuilder.RenameColumn(
                name: "TimesPerWeek",
                table: "Habits",
                newName: "Frequency");
        }
    }
}
