using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace TaskBoard.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(JwtRegisteredClaimNames.Sub)
            ?? throw new InvalidOperationException("No se encontró el claim de usuario en el token.");

        return int.Parse(idClaim.Value);
    }
}