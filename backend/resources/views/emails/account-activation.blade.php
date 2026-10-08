{{-- Emplacement : resources/views/emails/account-activation.blade.php --}}
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activez votre compte Nir'Info</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:12px; overflow:hidden;">

                    <tr>
                        <td style="background:#1e3a8a; padding:22px 28px; color:#ffffff; font-size:20px; font-weight:bold;">
                            Nir'Info
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:28px;">
                            <p style="font-size:16px; margin:0 0 14px;">
                                Bonjour {{ $user->name }},
                            </p>

                            <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 14px;">
                                Un administrateur vient de créer votre compte sur l'application de gestion Nir'Info.
                            </p>

                            <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 22px;">
                                Pour l'activer, cliquez sur le bouton ci-dessous et choisissez votre mot de passe.
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                                <tr>
                                    <td style="background:#2563eb; border-radius:8px;">
                                        <a href="{{ $activationUrl }}"
                                           style="display:inline-block; padding:12px 26px; color:#ffffff; font-size:14px; font-weight:bold; text-decoration:none;">
                                            Activer mon compte
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="font-size:13px; line-height:1.6; color:#334155; margin:0 0 6px;">
                                Votre identifiant de connexion : <strong>{{ $user->email }}</strong>
                            </p>

                            <p style="font-size:13px; line-height:1.6; color:#334155; margin:0 0 18px;">
                                Ce lien est valable {{ $expiresInHours }} heures et ne peut être utilisé qu'une seule fois.
                            </p>

                            <p style="font-size:12px; line-height:1.6; color:#64748b; margin:0 0 6px;">
                                Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :
                            </p>
                            <p style="font-size:12px; line-height:1.5; color:#2563eb; word-break:break-all; margin:0 0 18px;">
                                {{ $activationUrl }}
                            </p>

                            <p style="font-size:12px; line-height:1.6; color:#64748b; margin:0;">
                                Si vous n'êtes pas concerné par ce message, vous pouvez l'ignorer.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:#f8fafc; padding:16px 28px; font-size:12px; color:#94a3b8; text-align:center;">
                            Nir'Info &copy; {{ date('Y') }} — accès réservé au personnel
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>