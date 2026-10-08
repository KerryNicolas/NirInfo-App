import { useState, useEffect } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { useModuleSuggestions } from '../../../hooks/useModuleSuggestions'
import { useMatriculeSuggestions } from '../../../hooks/useMatriculeSuggestions'
import { useSessionSuggestions } from '../../../hooks/useSessionSuggestions'
import { formatMontantInput, parseMontantInput, isValidMatriculeNI, invalidFieldStyle } from '../../../utils/validators'
import CertificatView from './CertificatView'
import ValiderModal from './ValiderModal'
import { IcoCertif, IcoPrint, IcoTrash, IcoSearch, IcoAward, IcoClose, IcoEdit, IcoSave } from '../../../components/icons'
import { isValide, isManuel, isGratuit, prixToInput, fmtMontant, fmtDateCourt } from './types'
import type { Certification, Compte, ValidationPayload } from './types'

// Onglet « Certification » (mode automatique) : formulaire de génération
// à partir d'un étudiant, d'un module et d'une session existants, puis
// liste des certifications (valider, modifier, imprimer, supprimer).

const EMPTY = { matricule:'', code_module:'', date_debut:'', date_fin:'', nom_formation_certificat:'', lieu_paiement:'Ampandrana', code_session:'', prix:'' }

// onEditManuel : fourni par CertificationPage uniquement pour l'admin. Il
// ouvre l'onglet « Saisie manuelle » avec le certificat à corriger.
export default function CertificationAuto({ onEditManuel }: { onEditManuel?: (c: Certification) => void }) {
  const { hasPermission } = useAuth()
  const canValider = hasPermission('certifications.valider')

  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [editing, setEditing] = useState<Certification | null>(null)

  const [etudiantInfo, setEtudiantInfo] = useState<{ nom: string; prenom: string } | null>(null)
  const [checkingMatricule, setCheckingMatricule] = useState(false)
  const matriculeSuggestions = useMatriculeSuggestions(form.matricule)

  const [moduleQuery, setModuleQuery] = useState('')
  const moduleSuggestions = useModuleSuggestions(moduleQuery)

  const [sessionQuery, setSessionQuery] = useState('')
  const sessionSuggestions = useSessionSuggestions(sessionQuery, false)

  const certifTable = useTable<Certification>('/certifications', { perPage: 15 })

  const [printCertif, setPrintCertif]     = useState<Certification | null>(null)
  const [validerCertif, setValiderCertif] = useState<Certification | null>(null)
  const [confirmDeleteRef, setConfirmDeleteRef] = useState<string | null>(null)
  const [comptes, setComptes] = useState<Compte[]>([])

  useEffect(() => {
    if (canValider) {
      api.get('/certifications/comptes')
        .then((r: { data: Compte[] }) => setComptes(r.data))
        .catch(() => setComptes([]))
    }
  }, [canValider])

  const checkMatricule = async (matricule: string) => {
    if (matricule.length < 5) { setEtudiantInfo(null); return }
    setCheckingMatricule(true)
    try {
      const r = await api.get(`/etudiants/${matricule}`)
      setEtudiantInfo({ nom: r.data.nom_etudiant, prenom: r.data.prenom_etudiant })
    } catch {
      setEtudiantInfo(null)
    } finally {
      setCheckingMatricule(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const resetForm = () => {
    setForm(EMPTY); setModuleQuery(''); setSessionQuery(''); setEtudiantInfo(null); setEditing(null)
  }

  const handleEdit = (c: Certification) => {
    setEditing(c)
    setForm({
      matricule: c.matricule || '',
      code_module: c.code_module || '',
      date_debut: c.debut_session?.slice(0, 10) || '',
      date_fin: c.fin_session?.slice(0, 10) || '',
      nom_formation_certificat: c.nom_formation || '',
      lieu_paiement: c.lieu_paiement || 'Ampandrana',
      code_session: c.code_session || '',
      // FIX : prixToInput() — « 10000.00 » s'affichait « 1 000 000 ».
      prix: prixToInput(c.prix),
    })
    setModuleQuery(c.module_nom || c.code_module || '')
    setSessionQuery(c.code_session || '')
    checkMatricule(c.matricule || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGenerer = async (e: React.FormEvent) => {
    e.preventDefault()
    // Champs obligatoires (validation côté client ; le serveur revérifie).
    // Module et Session doivent être CHOISIS dans la liste : un texte tapé
    // qui ne correspond à rien laisse code_module / code_session vides.
    if (!form.matricule.trim()) { toast.error('Le matricule est obligatoire'); return }
    if (!form.code_module)      { toast.error('Le module est obligatoire : choisissez-le dans la liste'); return }
    if (!form.code_session)     { toast.error('La session est obligatoire : choisissez-la dans la liste'); return }

    setSaving(true)
    try {
      const payload = { ...form, prix: parseMontantInput(form.prix) }
      if (editing) {
        await api.put(`/certifications/${editing.reference}`, payload)
        toast.success('Certificat mis à jour')
      } else {
        await api.post('/certifications', payload)
        toast.success('Certificat généré')
      }
      resetForm()
      certifTable.reload()
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteRef) return
    try { await api.delete(`/certifications/${confirmDeleteRef}`); toast.success('Supprimé'); certifTable.reload() }
    catch (err: any) { toast.error(err.response?.data?.message || 'Erreur suppression') }
    finally { setConfirmDeleteRef(null) }
  }

  const handleConfirmValidation = async (payload: ValidationPayload) => {
    if (!validerCertif) return
    try {
      await api.post(`/certifications/${validerCertif.reference}/valider`, payload)
      toast.success('Certificat validé avec succès')
      setValiderCertif(null)
      certifTable.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la validation')
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}>
            {editing ? <IcoEdit /> : <IcoAward />} {editing ? 'Modifier le certificat' : 'Générer un certificat'}
          </span>
          {editing && <button type="button" className="btn btn-sm" onClick={resetForm} style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}><IcoClose /> Annuler</button>}
        </div>
        <div className="card-body">
          {editing && isValide(editing.accept) && (
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'8px 12px', fontSize:12.5, color:'#92400e', marginBottom:14 }}>
              Ce certificat est déjà validé. Si vous changez le prix, la transaction et le solde du compte déjà enregistrés seront automatiquement ajustés.
            </div>
          )}
          <form onSubmit={handleGenerer}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Matricule</label>
                <input
                  className="form-control"
                  list="certif-matricule-suggestions"
                  value={form.matricule}
                  onChange={e => {
                    const val = e.target.value.toUpperCase()
                    setForm(p => ({ ...p, matricule: val }))
                    checkMatricule(val)
                  }}
                  style={form.matricule && !isValidMatriculeNI(form.matricule) ? invalidFieldStyle : undefined}
                  required
                  placeholder="Ex: NI-3757"
                />
                <datalist id="certif-matricule-suggestions">
                  {matriculeSuggestions.map(s => (
                    <option key={s.matricule} value={s.matricule}>{s.nom} {s.prenom}</option>
                  ))}
                </datalist>
                {checkingMatricule && (
                  <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Vérification...</div>
                )}
                {!checkingMatricule && etudiantInfo && (
                  <div style={{ fontSize:13, color:'#16a34a', marginTop:4, fontWeight:600 }}>
                    ✓ {etudiantInfo.nom} {etudiantInfo.prenom}
                  </div>
                )}
                {!checkingMatricule && !etudiantInfo && form.matricule.length >= 5 && (
                  <div style={{ fontSize:13, color:'#dc2626', marginTop:4 }}>
                    ✗ Étudiant non trouvé — créez d'abord la fiche étudiant
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Module</label>
                <input
                  className="form-control"
                  list="certif-module-suggestions"
                  value={moduleQuery}
                  onChange={e => {
                    const v = e.target.value
                    setModuleQuery(v)
                    const match = moduleSuggestions.find(m => m.nom === v)
                    setForm(p => ({ ...p, code_module: match ? match.code_module : '' }))
                  }}
                  required placeholder="Tapez pour rechercher un module…" />
                <datalist id="certif-module-suggestions">
                  {moduleSuggestions.map(m => (
                    <option key={m.code_module} value={m.nom}>{m.code_module}</option>
                  ))}
                </datalist>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session</label>
                <input
                  className="form-control"
                  list="certif-session-suggestions"
                  value={sessionQuery}
                  onChange={e => {
                    const v = e.target.value
                    setSessionQuery(v)
                    const match = sessionSuggestions.find(s => s.code_session === v)
                    setForm(p => ({ ...p, code_session: match ? v : '' }))
                  }}
                  required placeholder="Tapez pour rechercher une session…" />
                <datalist id="certif-session-suggestions">
                  {sessionSuggestions.map(s => (
                    <option key={s.code_session} value={s.code_session}>{s.module_nom}</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Lieu de paiement</label>
                <select className="form-control" value={form.lieu_paiement} onChange={set('lieu_paiement')}>
                  <option>Ampandrana</option><option>Ampefiloha</option><option>Andravoahangy</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nom affiché sur le certificat</label>
                <input className="form-control" value={form.nom_formation_certificat} onChange={set('nom_formation_certificat')} placeholder="Ex: Excel Avancé" />
              </div>
              <div className="form-group">
                <label className="form-label">Prix certificat (Ar)</label>
                <input className="form-control" type="text" inputMode="numeric" value={form.prix}
                  onChange={e => setForm(p => ({ ...p, prix: formatMontantInput(e.target.value) }))}
                  placeholder="Ex: 10 000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Début session</label>
                <input className="form-control" type="date" value={form.date_debut} onChange={set('date_debut')} />
              </div>
              <div className="form-group">
                <label className="form-label">Fin session</label>
                <input className="form-control" type="date" value={form.date_fin} onChange={set('date_fin')} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:7 }} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> {editing ? 'Mise à jour…' : 'Génération…'}</> : editing ? <><IcoSave /> Mettre à jour</> : <><IcoCertif /> Générer le certificat</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste des certifications</div>
            <div className="section-count">{certifTable.meta.total} certificat(s)</div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input placeholder="Rechercher (matricule, nom, réf)..." value={certifTable.search} onChange={e => certifTable.setSearch(e.target.value)} />
            {certifTable.search && <button onClick={() => certifTable.setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, fontSize:16 }}>×</button>}
          </div>
        </div>
        <div className="table-wrapper">
          {certifTable.loading ? <div className="loading-center"><div className="spinner" /> Chargement…</div> : (
            <table>
              <thead><tr><th>#</th><th>Référence</th><th>Étudiant</th><th>Formation</th><th>Début</th><th>Fin</th><th>Prix</th><th>Origine</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>
                {certifTable.data.length === 0
                  ? <tr><td colSpan={10}><div className="empty-state">Aucune certification trouvée</div></td></tr>
                  : certifTable.data.map((c: Certification, idx: number) => (
                    <tr key={c.reference}>
                      <td style={{ color:'#94a3b8', fontSize:12 }}>{(certifTable.meta.current_page-1)*certifTable.meta.per_page+idx+1}</td>
                      <td style={{ fontWeight:600, color:'#2563eb', fontSize:12 }}>{c.reference}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{c.nom_complet?.trim() || `${c.nom || ''} ${c.prenom || ''}`.trim() || '—'}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{c.matricule || (isManuel(c) ? 'Saisie manuelle' : '')}</div>
                      </td>
                      <td><span className="badge badge-warning">{c.module_nom}</span></td>
                      <td style={{ fontSize:12 }}>{fmtDateCourt(c.debut_session)}</td>
                      <td style={{ fontSize:12 }}>{fmtDateCourt(c.fin_session)}</td>
                      <td style={{ fontWeight:600, color:'#16a34a', fontSize:12 }}>
                        {isGratuit(c)
                          ? <span className="badge badge-warning" title={c.motif_gratuit || undefined}>Gratuit</span>
                          : Number(c.prix) > 0 ? fmtMontant(c.prix)+' Ar' : '—'}
                      </td>
                      <td>
                        {isManuel(c)
                          ? <span className="badge badge-warning">Manuel</span>
                          : <span className="badge badge-success">Normal</span>
                        }
                      </td>
                      <td>
                        {isValide(c.accept)
                          ? <span className="badge badge-success">Validé</span>
                          : <span className="badge badge-warning">En attente</span>
                        }
                      </td>
                      <td><div className="table-actions">
                        {canValider && !isValide(c.accept) && (
                          <button className="btn-icon" style={{ color:'#16a34a' }} onClick={() => setValiderCertif(c)} title="Valider"><IcoAward /></button>
                        )}
                        {/* Un certificat manuel se corrige dans l'onglet « Saisie
                            manuelle » (admin seulement) ; un normal, ici. */}
                        {isManuel(c)
                          ? onEditManuel && <button className="btn-icon edit" onClick={() => onEditManuel(c)} title="Modifier"><IcoEdit /></button>
                          : <button className="btn-icon edit" onClick={() => handleEdit(c)} title="Modifier"><IcoEdit /></button>
                        }
                        {/* Impression seulement après paiement et validation. */}
                        {isValide(c.accept) && (
                          <button className="btn-icon" style={{ color:'#16a34a' }} onClick={() => setPrintCertif(c)} title="Imprimer"><IcoPrint /></button>
                        )}
                        {/* Un certificat validé ne se supprime plus (le serveur
                            le refuse aussi). */}
                        {!isValide(c.accept) && (
                          <button className="btn-icon delete" onClick={() => setConfirmDeleteRef(c.reference)} title="Supprimer"><IcoTrash /></button>
                        )}
                      </div></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
        {!certifTable.loading && certifTable.meta.total > 0 && (
          <Pagination meta={certifTable.meta} onPage={certifTable.setPage} onPerPage={certifTable.setPerPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteRef}
        title="Supprimer ce certificat ?"
        message={confirmDeleteRef ? `Le certificat « ${confirmDeleteRef} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteRef(null)}
      />
      {printCertif && <CertificatView certif={printCertif} onClose={() => setPrintCertif(null)} />}
      {validerCertif && (
        <ValiderModal
          certif={validerCertif}
          comptes={comptes}
          onClose={() => setValiderCertif(null)}
          onConfirm={handleConfirmValidation}
        />
      )}
    </>
  )
}