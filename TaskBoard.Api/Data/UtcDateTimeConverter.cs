using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TaskBoard.Api.Data;

public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter() : base(
        v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, DateTimeKind.Utc),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }
}