import { useRef, useState } from 'react'
import api from '../../../api/axios'
import toast from 'react-hot-toast'
import { toUpper, toTitleCase } from '../../../utils/textFormat'
import { formatTelephoneMG, isValidTelephoneMG, formatCinMG, isValidCinMG, isValidEmailComFr, isAdult18, invalidFieldStyle } from '../../../utils/validators'
import { useTable } from '../../../hooks/useTable'
import Pagination from '../../../components/Pagination'
import TableSkeleton from '../../../components/TableSkeleton'
import Avatar from '../../../assets/avatar.jpg'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { IcoPlus, IcoEdit, IcoCameraModern, IcoTrash, IcoSearch, IcoSave, IcoX } from '../../../components/icons'

interface Etudiant {
  matricule: string; nom: string; prenom: string; sexe: string
  date_naissance: string; lieu_naissance: string; numero_cin: string
  date_cin: string; lieu_cin: string; telephone: string; email: string
  photo: string; photo_url: string; editeur: string
}

const EMPTY = {
  nom: '', prenom: '', sexe: 'HOMME', date_naissance: '',
  lieu_naissance: '', numero_cin: '', date_cin: '',
  lieu_cin: '', telephone: '', email: '',
}

function DetailModal({ e, onClose }: { e: Etudiant; onClose: () => void }) {
  // ── Éditeur ajouté ici, retiré de la colonne dédiée du tableau (même pattern qu'Inscription/Recouvrement) ──
  const rows: [string, string][] = [
    ['Matricule', e.matricule], ['Nom', e.nom], ['Prénoms', e.prenom],
    ['Sexe', e.sexe], ['Date de naissance', e.date_naissance || '—'],
    ['Lieu de naissance', e.lieu_naissance || '—'], ['CIN', e.numero_cin || '—'],
    ['Date CIN', e.date_cin || '—'], ['Lieu CIN', e.lieu_cin || '—'],
    ['Téléphone', e.telephone || '—'], ['Email', e.email || '—'],
    ['Éditeur', e.editeur?.trim() || '—'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div style={{ width:520, background:'white', borderRadius:12, padding:24 }} onClick={ev => ev.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>Fiche étudiant</span>
          <button onClick={onClose} className="btn-icon"><IcoX /></button>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          <img
            src={e.photo_url || Avatar}
            alt=""
            onError={(ev) => { (ev.target as HTMLImageElement).src = Avatar }}
            style={{ width:110, height:130, objectFit:'cover', borderRadius:8, border:'1px solid #e2e8f0', flexShrink:0 }}
          />
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 14px', fontSize:14, alignContent:'start' }}>
            {rows.map(([label, val]) => (
              <div key={label} style={{ display:'contents' }}>
                <span style={{ color:'#64748b' }}>{label} :</span>
                <span style={{ fontWeight:500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// FIX : nouvelle prop optionnelle — appelée avec le matricule de l'étudiant
// quand on clique sur le bouton "+" d'une ligne, pour basculer vers l'onglet
// Inscription avec ce matricule déjà pré-rempli (voir EtudiantMain.tsx).
interface EtudiantTabProps {
  onInscrire?: (matricule: string) => void
}

export default function EtudiantTab({ onInscrire }: EtudiantTabProps) {
  const { isAdmin } = useAuth()
  const table = useTable<Etudiant>('/etudiants', { perPage: 15 })

  const [editing,      setEditing]      = useState<Etudiant | null>(null)
  const [viewing,      setViewing]      = useState<Etudiant | null>(null)
  const [form,         setForm]         = useState(EMPTY)
  const [preview,      setPreview]      = useState<string | null>(null)
  const [pendingFile,  setPendingFile]  = useState<File | null>(null)
  const [newMatricule, setNewMatricule] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [confirmDeleteMat, setConfirmDeleteMat] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setForm(EMPTY); setEditing(null)
    setPreview(null); setNewMatricule(null); setPendingFile(null)
  }

  const handleEdit = (e: Etudiant) => {
    setEditing(e)
    setForm({
      nom: e.nom, prenom: e.prenom, sexe: e.sexe,
      date_naissance: e.date_naissance || '',
      lieu_naissance: e.lieu_naissance || '',
      numero_cin:     e.numero_cin     || '',
      date_cin:       e.date_cin       || '',
      lieu_cin:       e.lieu_cin       || '',
      telephone:      e.telephone      || '',
      email:          e.email          || '',
    })
    setPreview(e.photo_url || null)
    setPendingFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const uploadPhotoFor = async (matricule: string, file: File) => {
    const fd = new FormData(); fd.append('photo', file)
    try {
      const r = await api.post(`/etudiants/${matricule}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(r.data.photo_url)
      toast.success('Photo enregistrée')
      table.reload()
    } catch { toast.error("Erreur lors de l'envoi de la photo") }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPreview(URL.createObjectURL(file))

    const targetId = editing?.matricule || newMatricule
    if (targetId) {
      await uploadPhotoFor(targetId, file)
      setPendingFile(null)
    } else {
      setPendingFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // FIX : règles de validation métier — voir utils/validators.ts.
    if (form.telephone && !isValidTelephoneMG(form.telephone)) {
      toast.error('Téléphone invalide — 10 chiffres, préfixe 032 à 038 (ex: 034 12 345 67)')
      return
    }
    // FIX : Date de naissance et CIN sont désormais obligatoires — un
    // étudiant doit avoir au moins 18 ans et posséder un CIN pour
    // s'inscrire (exigence métier).
    if (!form.date_naissance) {
      toast.error('La date de naissance est obligatoire')
      return
    }
    if (!isAdult18(form.date_naissance)) {
      toast.error("L'étudiant doit avoir au moins 18 ans")
      return
    }
    if (!form.numero_cin) {
      toast.error('Le numéro CIN est obligatoire')
      return
    }
    if (!isValidCinMG(form.numero_cin)) {
      toast.error('CIN invalide — 12 chiffres exactement (ex: 101 234 567 890)')
      return
    }
    if (form.email && !isValidEmailComFr(form.email)) {
      toast.error('Email invalide — doit se terminer par .com ou .fr')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/etudiants/${editing.matricule}`, form)
        toast.success('Étudiant mis à jour')
        reset()
      } else {
        const r = await api.post('/etudiants', form)
        const mat = r.data.matricule
        setNewMatricule(mat)
        toast.success(`Étudiant créé — Matricule : ${mat}`)
        setForm(EMPTY)

        if (pendingFile) {
          await uploadPhotoFor(mat, pendingFile)
          setPendingFile(null)
        }
      }
      table.reload()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDeleteMat) return
    try {
      await api.delete(`/etudiants/${confirmDeleteMat}`)
      toast.success('Étudiant supprimé')
      table.reload()
    } catch (err: any) {
      // FIX : affiche désormais le vrai message du backend (ex: "il a 3
      // inscription(s)/paiement(s) enregistré(s)") au lieu d'un message
      // générique qui cachait la vraie raison du blocage.
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression')
    }
    finally { setConfirmDeleteMat(null) }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {editing ? <IcoEdit /> : <IcoPlus />}
            {editing ? "Modifier l'étudiant" : 'Nouvel étudiant'}
          </span>
          {editing && (
            <button className="btn btn-sm" onClick={reset}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              <IcoX /> Annuler
            </button>
          )}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nom </label>
                    <input className="form-control" value={form.nom}
                      onChange={e => setForm(p => ({ ...p, nom: toUpper(e.target.value) }))}
                      required placeholder="Nom de famille" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom(s) </label>
                    <input className="form-control" value={form.prenom}
                      onChange={e => setForm(p => ({ ...p, prenom: toTitleCase(e.target.value) }))}
                      required placeholder="Prénoms" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sexe</label>
                    <select className="form-control" value={form.sexe} onChange={set('sexe')}>
                      <option>HOMME</option><option>FEMME</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de naissance <span style={{ color:'#ef4444' }}></span></label>
                    {/* FIX : obligatoire — l'étudiant doit avoir au moins 18 ans */}
                    <input className="form-control" type="date" value={form.date_naissance}
                      onChange={set('date_naissance')}
                      style={form.date_naissance && !isAdult18(form.date_naissance) ? invalidFieldStyle : undefined}
                      required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Lieu de naissance</label>
                    <input className="form-control" value={form.lieu_naissance}
                      onChange={e => setForm(p => ({ ...p, lieu_naissance: toTitleCase(e.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro CIN <span style={{ color:'#ef4444' }}></span></label>
                    {/* FIX : obligatoire — formatage automatique "XXX XXX XXX XXX" (12 chiffres) */}
                    <input className="form-control" value={form.numero_cin}
                      onChange={e => setForm(p => ({ ...p, numero_cin: formatCinMG(e.target.value) }))}
                      style={form.numero_cin && !isValidCinMG(form.numero_cin) ? invalidFieldStyle : undefined}
                      required placeholder="Ex: 101 234 567 890" maxLength={15} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date CIN</label>
                    <input className="form-control" type="date" value={form.date_cin}
                      onChange={set('date_cin')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lieu CIN</label>
                    <input className="form-control" value={form.lieu_cin}
                       onChange={e => setForm(p => ({ ...p, lieu_cin: toTitleCase(e.target.value) }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Téléphone</label>
                    {/* FIX : formatage automatique "03X XX XXX XX" */}
                    <input className="form-control" value={form.telephone}
                      onChange={e => setForm(p => ({ ...p, telephone: formatTelephoneMG(e.target.value) }))}
                      style={form.telephone && !isValidTelephoneMG(form.telephone) ? invalidFieldStyle : undefined}
                      placeholder="Ex: 034 12 345 67" maxLength={13} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="form-control" type="email" value={form.email}
                      onChange={set('email')}
                      style={form.email && !isValidEmailComFr(form.email) ? invalidFieldStyle : undefined}
                      placeholder="exemple@domaine.com" />
                  </div>
                </div>
              </div>

              {/* Photo */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <div onClick={() => fileRef.current?.click()} style={{
                  cursor: 'pointer', width: 130, height: 155,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f8fafc',
                  border: `2px dashed ${preview ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  <img
                    src={preview || Avatar}
                    alt={preview ? '' : 'Photo par défaut'}
                    onError={(ev) => { (ev.target as HTMLImageElement).src = Avatar }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: preview ? 1 : 0.85 }}
                  />
                </div>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handlePhotoChange} />
                <button type="button" className="btn btn-secondary btn-sm"
                  style={{ width: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => fileRef.current?.click()}>
                  <IcoCameraModern /> Photo
                </button>
                {pendingFile && !editing && (
                  <div style={{ fontSize: 12, color: '#d97706', textAlign: 'center' }}>
                    Sera envoyée après enregistrement
                  </div>
                )}
                {newMatricule && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 13, textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                    Matricule : {newMatricule}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
                  : editing ? <><IcoSave /> Mettre à jour</> : <><IcoPlus /> Enregistrer</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="card-header">
          <div className="section-info">
            <div className="section-title">Liste d'étudiant(s)</div>
            <div className="section-count">
              {table.meta.total > 0
                ? `${table.meta.total} étudiant(s) — page ${table.meta.current_page}/${table.meta.last_page}`
                : `${table.data.length} étudiant(s)`
              }
            </div>
          </div>
          <div className="search-bar">
            <IcoSearch />
            <input
              placeholder="Mot à rechercher..."
              value={table.search}
              onChange={e => table.setSearch(e.target.value)}
            />
            {table.search && (
              <button onClick={() => table.setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 16, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
        </div>

        <div className="table-wrapper">
          {table.loading && table.data.length === 0 ? (
            <TableSkeleton rows={15} cols={9} />
          ) : (
            <table>
              {/* Colonne Éditeur retirée — désormais dans la fiche détail (clic sur la ligne) */}
              <thead>
                <tr>
                  <th>#</th>
                  <th>Matricule</th>
                  <th>Photo</th>
                  <th>Nom</th>
                  <th>Prénoms</th>
                  <th>Sexe</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {table.data.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        {table.search ? `Aucun résultat pour « ${table.search} »` : 'Aucun étudiant trouvé'}
                      </div>
                    </td>
                  </tr>
                ) : table.data.map((e, idx) => (
                  <tr key={e.matricule} onClick={() => setViewing(e)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>
                      {(table.meta.current_page - 1) * table.meta.per_page + idx + 1}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ whiteSpace: 'nowrap' }}>
                        {e.matricule.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <img
                        src={e.photo_url || Avatar}
                        alt=""
                        onError={(ev) => { (ev.target as HTMLImageElement).src = Avatar }}
                        style={{ width: 32, height: 38, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', display: 'block', opacity: e.photo_url ? 1 : 0.85 }}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.nom}</td>
                    <td>{e.prenom}</td>
                    <td>
                      <span className={`badge ${e.sexe === 'HOMME' || e.sexe === 'Homme' ? 'badge-info' : 'badge-warning'}`}>
                        {e.sexe}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{e.telephone}</td>
                    <td style={{ fontSize: 13 }}>{e.email}</td>
                    <td onClick={ev => ev.stopPropagation()}>
                      <div className="table-actions">
                        {/* FIX : nouveau bouton + — bascule vers l'onglet
                            Inscription avec ce matricule déjà pré-rempli */}
                        {onInscrire && (
                          <button className="btn-icon" title="Inscrire à une session"
                            onClick={() => onInscrire(e.matricule)}
                            style={{ color: '#16a34a' }}>
                            <IcoPlus />
                          </button>
                        )}
                        <button className="btn-icon edit" onClick={() => handleEdit(e)} title="Modifier">
                          <IcoEdit />
                        </button>
                        {isAdmin() && (
                          <button className="btn-icon delete" onClick={() => setConfirmDeleteMat(e.matricule)} title="Supprimer">
                            <IcoTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!table.loading && table.meta.total > 0 && (
          <Pagination
            meta={table.meta}
            onPage={table.setPage}
            onPerPage={table.setPerPage}
          />
        )}
      </div>

      {viewing && <DetailModal e={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={!!confirmDeleteMat}
        title="Supprimer cet étudiant ?"
        message={confirmDeleteMat ? `L'étudiant « ${confirmDeleteMat} » sera définitivement supprimé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteMat(null)}
      />
    </>
  )
}