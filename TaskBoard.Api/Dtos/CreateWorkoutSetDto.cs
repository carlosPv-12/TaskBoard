using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public class CreateWorkoutSetDto
{
    [Required]
    [Range(0, 1000)]
    public decimal Weight { get; set; }

    [Required]
    [Range(1, 100)]
    public int Reps { get; set; }


}