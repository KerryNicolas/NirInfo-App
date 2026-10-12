// Photo de profil ronde ; sans photo, les initiales sur le dégradé habituel.
// Utilisé par le menu principal, le profil et la fenêtre des paramètres.
export default function Avatar({ name, photoUrl, size = 32 }: { name?: string; photoUrl?: string | null; size?: number }) {
  const initials = (name || 'U').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg, #3b82f6, #1e3a8a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: Math.round(size * 0.34), fontWeight: 700,
    }}>
      {photoUrl
        ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}
