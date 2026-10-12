import { useState, useEffect } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import CertificatView from './CertificatView'
import ValiderModal from './ValiderModal'
import { IcoEdit, IcoSave, IcoClose } from '../../../components/icons'
import type { Certification, Compte, ValidationPayload } from './types'

// Onglet « Saisie manuelle » — réservé à l'admin (filtré dans
// CertificationPage, et route protégée côté serveur).
//
// Le certificat est saisi à la main, sans fiche étudiant, module ni
// session, puis il suit le MÊME circuit que les autres :
//   Saisie → enregistrement (référence automatique, « En attente »)
//          → validation (paiement, ou gratuité avec motif) → impression.
// Il apparaît dans la liste des certifications avec l'origine « Manuel ».
//
// `editing` : certificat manuel à corriger (ouvert depuis la liste).

const EMPTY = { matricule:'', nom_complet:'', nom_formation:'', date_naissance:'', lieu_naissance:'', date_debut:'', date_fin:'', lieu_paiement:'Ampandrana' }

export default function CertificationManuelle({ editing, onDone }: {
  editing?: Certification | null
  onDone?: () => void
}) {
  const { hasPermission } = useAuth()
  const canValider = hasPermission('certifications.valider')

  const [form, setForm] = useState(() => editing ? {
    matricule: editing.matricule || '',
    nom_complet: editing.nom_complet?.trim() || '',
    nom_formation: editing.nom_formation || editing.module_nom || '',
    date_naissance: editing.date_naissance?.slice(0, 10) || '',
    lieu_naissance: editing.lieu_naissance || '',
    date_debut: editing.debut_session?.slice(0, 10) || '',
    date_fin: editing.fin_session?.slice(0, 10) || '',
    lieu_paiement: editing.lieu_paiement || 'Ampandrana',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [comptes, setComptes] = useState<Compte[]>([])
  const [aValider, setAValider] = useState<Certification | null>(null)
  const [apercu, setApercu]     = useState<Certification | null>(null)

  useEffect(() => {
    if (canValider) {
      api.get('/certifications/comptes')
        .then((r: { data: Compte[] }) => setComptes(r.data))
        .catch(() => setComptes([]))
    }
  }, [canValider])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom_complet.trim())   { toast.error('Le nom est obligatoire'); return }
    if (!form.nom_formation.trim()) { toast.error('La formation est obligatoire'); return }
    if (!form.date_debut || !form.date_fin) { toast.error('Les dates de session sont obligatoires'); return }
    if (form.date_fin < form.date_debut) { toast.error('La fin de session est avant le début'); return }

    const payload = { ...form, matricule: form.matricule.trim(), nom_complet: form.nom_complet.trim(), nom_formation: form.nom_formation.trim() }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/certifications/${editing.reference}`, payload)
        toast.success('Certificat mis à jour')
        onDone?.()
        return
      }
      const r = await api.post('/certifications/manuel', payload)
      const cert: Certification = r.data.certificat
      setForm(EMPTY)
      if (canValider) {
        // Étape suivante : paiement + validation.
        setAValider(cert)
      } else {
        toast.success(`Certificat ${cert.reference} enregistré, en attente de validation`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmValidation = async (payload: ValidationPayload) => {
    if (!aValider) return
    try {
      await api.post(`/certifications/${aValider.reference}/valider`, payload)
      toast.success('gratuit' in payload ? 'Certificat validé gratuitement' : 'Certificat validé avec succès')
      // Validé (payé ou gratuit) : l'impression devient possible.
      setApercu({ ...aValider, accept: 1, prix: 'gratuit' in payload ? 0 : payload.prix })
      setAValider(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la validation')
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            <IcoEdit /> {editing ? `Modifier le certificat manuel ${editing.reference}` : "Saisie manuelle d'un certificat"}
          </span>
          {editing
            ? <button type="button" className="btn btn-sm" onClick={() => onDone?.()} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoClose /> Annuler</button>
            : <button type="button" className="btn btn-sm" onClick={() => setForm(EMPTY)} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoClose /> Vider</button>
          }
        </div>
        <div className="card-body">
          {!editing && (
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'8px 12px', fontSize:13.5, color:'#1e40af', marginBottom:14 }}>
              Le certificat est enregistré dans la liste avec une référence automatique, puis il doit être validé (paiement, ou gratuité avec motif) avant de pouvoir être imprimé.
            </div>
          )}
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nom et prénoms</label>
                <input className="form-control" value={form.nom_complet} onChange={set('nom_complet')} required maxLength={255} placeholder="Ex: RAKOTO Jean" />
              </div>
              <div className="form-group">
                <label className="form-label">Formation affichée sur le certificat</label>
                <input className="form-control" value={form.nom_formation} onChange={set('nom_formation')} required maxLength={255} placeholder="Ex: Excel Avancé" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de naissance</label>
                <input className="form-control" type="date" value={form.date_naissance} onChange={set('date_naissance')} />
              </div>
              <div className="form-group">
                <label className="form-label">Lieu de naissance</label>
                <input className="form-control" value={form.lieu_naissance} onChange={set('lieu_naissance')} maxLength={255} placeholder="Ex: Antananarivo" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Début session</label>
                <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fin session</label>
                <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lieu de paiement</label>
                <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                  <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Matricule (facultatif)</label>
                {/* Texte libre : simple repère affiché dans la liste, sans
                    lien avec une fiche étudiant. */}
                <input className="form-control" value={form.matricule} onChange={set('matricule')} maxLength={255} placeholder="Ex: NI-3757" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:7 }} disabled={saving}>
              {saving
                ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Enregistrement…</>
                : <><IcoSave /> {editing ? 'Mettre à jour' : 'Enregistrer et continuer'}</>}
            </button>
          </form>
        </div>
      </div>

      {aValider && (
        <ValiderModal
          certif={aValider}
          comptes={comptes}
          onClose={() => {
            toast(`Le certificat ${aValider.reference} reste « En attente » dans la liste`)
            setAValider(null)
          }}
          onConfirm={handleConfirmValidation}
        />
      )}
      {apercu && <CertificatView certif={apercu} onClose={() => setApercu(null)} />}
    </>
  )
}