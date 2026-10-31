using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskBoard.Api.Migrations
{
    /// <inheritdoc />
    public partial class GymImprovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Weight",
                table: "WorkoutSets",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(8,2)",
                oldPrecision: 8,
                oldScale: 2);

            migrationBuilder.AlterColumn<int>(
                name: "Reps",
                table: "WorkoutSets",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<decimal>(
                name: "DistanceKm",
                table: "WorkoutSets",
                type: "decimal(7,2)",
                precision: 7,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "WorkoutSets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "Exercises",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "WorkoutSessionRoutines",
                columns: table => new
                {
                    WorkoutSessionId = table.Column<int>(type: "int", nullable: false),
                    RoutineId = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSessionRoutines", x => new { x.WorkoutSessionId, x.RoutineId });
                    table.ForeignKey(
                        name: "FK_WorkoutSessionRoutines_Routines_RoutineId",
                        column: x => x.RoutineId,
                        principalTable: "Routines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSessionRoutines_WorkoutSessions_WorkoutSessionId",
                        column: x => x.WorkoutSessionId,
                        principalTable: "WorkoutSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSessionRoutines_RoutineId",
                table: "WorkoutSessionRoutines",
                column: "RoutineId");

            // Datos antiguos: cada entreno tenía como mucho una rutina, en WorkoutSessions.RoutineId.
            // Se copia a la tabla nueva para que los entrenos ya registrados conserven su rutina.
            migrationBuilder.Sql(@"
                INSERT INTO [WorkoutSessionRoutines] ([WorkoutSessionId], [RoutineId], [Order])
                SELECT [Id], [RoutineId], 0
                FROM [WorkoutSessions]
                WHERE [RoutineId] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Para poder volver a NOT NULL, las series de tiempo (sin peso ni reps) necesitan un valor
            migrationBuilder.Sql("UPDATE [WorkoutSets] SET [Weight] = ISNULL([Weight], 0), [Reps] = ISNULL([Reps], 0);");

            migrationBuilder.DropTable(
                name: "WorkoutSessionRoutines");

            migrationBuilder.DropColumn(
                name: "DistanceKm",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Exercises");

            migrationBuilder.AlterColumn<decimal>(
                name: "Weight",
                table: "WorkoutSets",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "decimal(8,2)",
                oldPrecision: 8,
                oldScale: 2,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Reps",
                table: "WorkoutSets",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
