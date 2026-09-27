using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class UpdateTaskDto
{
    [Required]
    [MinLength(3)]
    public string Title { get; set; } = string.Empty;

    public bool IsDone { get; set; }
}