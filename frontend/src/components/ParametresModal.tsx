import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import CreateUserForm from './CreateUserForm'
import Avatar from './Avatar'
import { IconEye, IconEyeOff, IconMail, IconPhone } from './icons'

// Fenêtre « Modification du profil », ouverte par « Paramètres » au-dessus de
// la page courante (même présentation que l'ancien Nir'Info : sections
// dépliables, Annuler / Enregistrer). Elle utilise l'API existante
// PUT /profile, comme la page /profile, et POST /profile/photo pour la photo.

const BLEU   = '#1f9cc0'   // intitulés des sections
const CYAN   = '#22c3d2'   // bouton Enregistrer
const FORM_ID = 'parametres-profil'

type Section = 'identifiant' | 'motdepasse' | 'photo' | 'compte'

// Mêmes limites que le serveur (AuthController::uploadPhoto).
const PHOTO_TYPES   = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_OCT = 2 * 1024 * 1024

// Crayon dans un carré, comme sur l'ancienne fenêtre.
const IcoModifier = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

function PwdInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="form-control" style={{ paddingRight: 40 }}
          type={show ? 'text' : 'password'} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4,
        }}>
          {show ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </div>
  )
}

export default function ParametresModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile, uploadPhoto, removePhoto, isAdmin } = useAuth()

  const [ouvertes, setOuvertes] = useState<Section[]>([])
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving] = useState(false)
  // Photo choisie mais pas encore enregistrée, et son aperçu local.
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu]   = useState<string | null>(null)
  const choixPhoto = useRef<HTMLInputElement>(null)

  // À chaque ouverture : sections repliées, champs repris du compte connecté.
  useEffect(() => {
    if (!open) return
    setOuvertes([])
    setName(user?.name || ''); setEmail(user?.email || ''); setPhone(user?.phone || '')
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    setFichier(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Aperçu de la photo choisie ; l'adresse temporaire est libérée dès qu'elle ne sert plus.
  useEffect(() => {
    if (!fichier) { setApercu(null); return }
    const url = URL.createObjectURL(fichier)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open) return null

  const estOuverte = (s: Section) => ouvertes.includes(s)
  const basculer   = (s: Section) => setOuvertes(o => o.includes(s) ? o.filter(x => x !== s) : [...o, s])

  const choisirPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''   // permet de rechoisir le même fichier
    if (!f) return
    if (!PHOTO_TYPES.includes(f.type)) { toast.error('Formats acceptés : JPG, PNG ou WEBP.'); return }
    if (f.size > PHOTO_MAX_OCT)        { toast.error('La photo ne doit pas dépasser 2 Mo.'); return }
    setFichier(f)
  }

  const retirerPhoto = async () => {
    if (saving) return
    setSaving(true)
    try { await removePhoto(); setFichier(null); toast.success('Photo de profil retirée') }
    catch (err: any) { toast.error(err.response?.data?.message || 'Erreur lors du retrait de la photo') }
    finally { setSaving(false) }
  }

  const mdpSaisi = currentPwd !== '' || newPwd !== '' || confirmPwd !== ''

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    const enregistrerId  = estOuverte('identifiant')
    const enregistrerMdp = estOuverte('motdepasse') && mdpSaisi

    const enregistrerPhoto = estOuverte('photo') && fichier !== null

    if (!enregistrerId && !enregistrerMdp && !enregistrerPhoto) {
      toast.error(estOuverte('motdepasse') ? 'Renseignez votre mot de passe actuel et le nouveau.'
        : estOuverte('photo') ? 'Choisissez une photo.' : 'Dépliez une section pour la modifier.')
      return
    }
    if (enregistrerMdp) {
      if (!currentPwd)           { toast.error('Saisissez votre mot de passe actuel'); return }
      if (newPwd.length < 8)     { toast.error('Minimum 8 caractères requis'); return }
      if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return }
    }

    setSaving(true)
    try {
      if (enregistrerId)  await updateProfile({ name, email, phone })
      if (enregistrerMdp) await updateProfile({ current_password: currentPwd, password: newPwd, password_confirmation: confirmPwd })
      if (enregistrerPhoto && fichier) await uploadPhoto(fichier)
      const faits = [enregistrerId && 'informations', enregistrerMdp && 'mot de passe', enregistrerPhoto && 'photo'].filter(Boolean)
      toast.success(faits.length > 1 ? `Profil mis à jour (${faits.join(', ')})`
        : enregistrerMdp ? 'Mot de passe modifié avec succès'
        : enregistrerPhoto ? 'Photo de profil mise à jour' : 'Informations mises à jour')
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const ligne = (s: Section, titre: string, dernier = false) => (
    <button type="button" onClick={() => basculer(s)} aria-expanded={estOuverte(s)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: 'none', border: 'none', borderBottom: dernier && !estOuverte(s) ? 'none' : '1px solid #e5eaf0',
        padding: '16px 2px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        color: BLEU, fontSize: 15, fontWeight: 700,
      }}>
      {titre}
      <span style={{ display: 'flex', flexShrink: 0, opacity: estOuverte(s) ? 1 : 0.85 }}><IcoModifier /></span>
    </button>
  )

  const corps: React.CSSProperties = { padding: '14px 2px 16px', borderBottom: '1px solid #e5eaf0' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 24px', overflowY: 'auto' }}
      onClick={() => { if (!saving) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="parametres-titre"
        style={{ width: 500, maxWidth: '100%', background: 'white', borderRadius: 8, boxShadow: '0 24px 60px rgba(0,0,0,0.28)', animation: 'parametresPop 0.16s ease-out' }}
        onClick={ev => ev.stopPropagation()}
      >
        {/* En-tête : titre centré, croix à droite */}
        <div style={{ position: 'relative', padding: '22px 48px 10px', textAlign: 'center' }}>
          <h2 id="parametres-titre" style={{ fontSize: 24, fontWeight: 400, color: '#6b7785', margin: 0 }}>Modification du profil</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fermer"
            style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7785', fontSize: 26, lineHeight: 1, padding: 4, fontFamily: 'inherit' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '4px 24px 8px' }}>
          <form id={FORM_ID} onSubmit={handleSave}>
            {ligne('identifiant', 'Modifier votre identifiant')}
            {estOuverte('identifiant') && (
              <div style={corps}>
                <div className="form-group">
                  <label className="form-label">Nom complet</label>
                  <input className="form-control" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Adresse email (identifiant de connexion)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}><IconMail /></span>
                    <input className="form-control" style={{ paddingLeft: 34 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.mg" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}><IconPhone /></span>
                    <input className="form-control" style={{ paddingLeft: 34 }} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+261 34 000 0000" />
                  </div>
                </div>
              </div>
            )}

            {ligne('motdepasse', 'Modifier votre mot de passe de connexion')}
            {estOuverte('motdepasse') && (
              <div style={corps}>
                <PwdInput label="Mot de passe actuel" value={currentPwd} onChange={setCurrentPwd} placeholder="Votre mot de passe actuel" />
                <PwdInput label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} placeholder="Minimum 8 caractères" />
                <PwdInput label="Confirmer le nouveau mot de passe" value={confirmPwd} onChange={setConfirmPwd} placeholder="Répéter le mot de passe" />
                {confirmPwd && newPwd !== confirmPwd && (
                  <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
                )}
              </div>
            )}

            {ligne('photo', 'Modifier votre photo de profil', !isAdmin())}
            {estOuverte('photo') && (
              <div style={{ ...corps, borderBottom: isAdmin() ? corps.borderBottom : 'none', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Avatar name={user?.name} photoUrl={apercu || user?.photo_url} size={76} />
                <div style={{ flex: 1, minWidth: 190 }}>
                  <input ref={choixPhoto} type="file" accept="image/jpeg,image/png,image/webp" onChange={choisirPhoto} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => choixPhoto.current?.click()} disabled={saving}>
                      {user?.photo_url || fichier ? 'Choisir une autre photo' : 'Choisir une photo'}
                    </button>
                    {fichier && (
                      <button type="button" className="btn btn-sm" onClick={() => setFichier(null)} disabled={saving}
                        style={{ background: 'white', color: '#64748b', border: '1px solid #cbd5e1' }}>Annuler le choix</button>
                    )}
                    {!fichier && user?.photo_url && (
                      <button type="button" className="btn btn-sm" onClick={retirerPhoto} disabled={saving}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Retirer la photo</button>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                    {fichier ? <>« {fichier.name} » sera enregistrée en cliquant sur <b>Enregistrer</b>.</> : 'JPG, PNG ou WEBP, 2 Mo maximum.'}
                  </p>
                </div>
              </div>
            )}
          </form>

          {/* Réservé aux administrateurs — hors du formulaire du profil :
              ce formulaire a son propre bouton et son propre appel API. */}
          {isAdmin() && (
            <>
              {ligne('compte', 'Créer un compte utilisateur', true)}
              {estOuverte('compte') && (
                <div style={{ ...corps, borderBottom: 'none' }}>
                  <CreateUserForm />
                </div>
              )}
            </>
          )}
        </div>

        {/* Pied : Annuler (étroit) + Enregistrer (large), comme sur l'ancienne fenêtre */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 24px 22px' }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{ flex: '0 0 30%', background: 'white', color: '#374151', border: '1px solid #6b7280', borderRadius: 4, padding: '10px 0', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button type="submit" form={FORM_ID} disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: CYAN, color: 'white', border: 'none', borderRadius: 4, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.75 : 1, fontFamily: 'inherit' }}>
            {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</> : 'Enregistrer'}
          </button>
        </div>
      </div>
      <style>{`@keyframes parametresPop { from { transform: translateY(-10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  )
}
