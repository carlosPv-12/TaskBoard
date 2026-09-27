using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateTaskDto
{
    [Required]
    [MinLength(3)]
    public string Title { get; set; } = string.Empty;
}