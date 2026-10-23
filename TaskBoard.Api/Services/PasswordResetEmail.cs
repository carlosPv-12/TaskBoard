using System.Net;

namespace TaskBoard.Api.Services;

public static class PasswordResetEmail
{
    public static (string Subject, string Html) Build(string link, string validFor)
    {
        var safeLink = WebUtility.HtmlEncode(link);

        var html = $$"""
            <!doctype html>
            <html lang="es">
              <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c1b1f;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;padding:32px;">
                        <tr>
                          <td>
                            <h1 style="margin:0 0 8px;font-size:22px;">Crea una contraseña nueva</h1>
                            <p style="margin:0 0 24px;line-height:1.5;color:#49454f;">
                              Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de TaskBoard.
                              El enlace es válido durante {{validFor}}.
                            </p>
                            <p style="margin:0 0 24px;">
                              <a href="{{safeLink}}" style="display:inline-block;padding:12px 28px;background:#1f4e8c;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Cambiar contraseña</a>
                            </p>
                            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6770;">
                              Si el botón no funciona, copia este enlace en tu navegador:
                            </p>
                            <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#1f4e8c;">{{safeLink}}</p>
                            <p style="margin:0;font-size:13px;line-height:1.5;color:#6b6770;">
                              Si no has sido tú, ignora este mensaje: tu contraseña no cambiará.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;

        return ("Restablece tu contraseña de TaskBoard", html);
    }
}
