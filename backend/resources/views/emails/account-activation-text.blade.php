{{-- Version texte de l'email d'activation (même contenu que account-activation.blade.php).
     Texte brut : les valeurs sont écrites telles quelles avec {!! !!}. Avec {{ }}, les « & » du
     lien deviendraient « &amp; » et le lien ne fonctionnerait plus. --}}
Bonjour {!! $user->name !!},

Un administrateur vient de créer votre compte sur l'application de gestion Nir'Info.

Pour l'activer, ouvrez ce lien dans votre navigateur et choisissez votre mot de passe :

{!! $activationUrl !!}

Votre identifiant de connexion : {!! $user->email !!}

Ce lien est valable {{ $expiresInHours }} heures et ne peut être utilisé qu'une seule fois.

Si vous n'êtes pas concerné par ce message, vous pouvez l'ignorer.

--
Nir'Info - accès réservé au personnel
