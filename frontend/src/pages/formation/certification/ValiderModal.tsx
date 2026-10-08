import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatMontantInput, parseMontantInput } from '../../../utils/validators'
import { IcoClose } from '../../../components/icons'
import { prixToInput, isManuel } from './types'
import type { Certification, Compte, ValidationPayload } from './types'

// Fenêtre de validation d'un certificat.
//  - Paiement (cas normal) : compte d'encaissement + prix > 0.
//  - Gratuité : proposée uniquement pour un certificat MANUEL, avec un
//    motif obligatoire. Aucune transaction n'est créée.
export default function ValiderModal({ certif, comptes, onClose, onConfirm }: {
  certif: Certification; comptes: Compte[]; onClose: () => void
  onConfirm: (payload: ValidationPayload) => Promise<void>
}) {
  const [idCompte, setIdCompte] = useState<string>('')
  // prixToInput() : « 10000.00 » s'affichait « 1 000 000 » — voir types.ts.
  const [prix, setPrix] = useState<string>(prixToInput(certif.prix))
  const [gratuit, setGratuit] = useState(false)
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const manuel = isManuel(certif)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    let payload: ValidationPayload
    if (gratuit) {
      if (!motif.trim()) { toast.error('Le motif de gratuité est obligatoire'); return }
      payload = { gratuit: true, motif_gratuit: motif.trim() }
    } else {
      if (!idCompte) { toast.error('Choisissez un compte'); return }
      const montant = Number(parseMontantInput(prix))
      // Paiement obligatoire : pas de validation à 0 Ar (le serveur revérifie).
      if (!(montant > 0)) { toast.error('Le paiement est obligatoire : saisissez le prix'); return }
      payload = { id_compte: Number(idCompte), prix: montant }
    }
    setLoading(true)
    try { await onConfirm(payload) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:420, background:'white', borderRadius:12, padding:'4px 24px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Valider le certificat {certif.reference}</span>
          <button onClick={onClose} className="btn-icon"><IcoClose /></button>
        </div>
        <form onSubmit={submit}>
          {manuel && (
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, marginBottom:14, cursor:'pointer' }}>
              <input type="checkbox" checked={gratuit} onChange={e => setGratuit(e.target.checked)} />
              Certificat gratuit (sans encaissement)
            </label>
          )}

          {gratuit ? (
            <div className="form-group">
              <label className="form-label">Motif de la gratuité</label>
              <input className="form-control" value={motif} onChange={e => setMotif(e.target.value)} required maxLength={255} placeholder="Ex: Formateur interne, partenariat…" />
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>
                Aucun paiement ne sera enregistré dans les comptes.
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Compte encaissement</label>
                <select className="form-control" value={idCompte} onChange={e => setIdCompte(e.target.value)} required>
                  <option value="">-- Choisir un compte --</option>
                  {comptes.map((c: Compte) => <option key={c.id_compte} value={c.id_compte}>{c.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Prix (Ar)</label>
                <input className="form-control" type="text" inputMode="numeric" value={prix} onChange={e => setPrix(formatMontantInput(e.target.value))} required placeholder="Ex: 10 000" />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Validation…</>
              : gratuit ? 'Valider gratuitement' : 'Confirmer la validation'}
          </button>
        </form>
      </div>
    </div>
  )
}