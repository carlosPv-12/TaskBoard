using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskBoard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHabitSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Habits",
                type: "int",
                nullable: false,
                defaultValue: 0);
                migrationBuilder.Sql(@"
                    UPDATE h
                    SET h.SortOrder = x.rn
                    FROM Habits h
                    JOIN (
                        SELECT Id,
                               ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY CreatedAt, Id) - 1 AS rn
                        FROM Habits
                    ) x ON x.Id = h.Id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Habits");
        }
    }
}
