using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskBoard.Api.Migrations
{
    /// <inheritdoc />
    public partial class ExerciseOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Exercises",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Asigna los ejercicios existentes al primer usuario para que la FK no falle
            migrationBuilder.Sql("UPDATE Exercises SET UserId = (SELECT TOP 1 Id FROM Users ORDER BY Id)");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Exercises_Users_UserId",
                table: "Exercises",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Exercises_Users_UserId",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Exercises");
        }
    }
}