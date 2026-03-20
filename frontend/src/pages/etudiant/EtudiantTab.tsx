import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

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

export default function EtudiantTab() {
  const [etudiants, setEtudiants] = useState<Etudiant[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [editing,   setEditing]   = useState<Etudiant | null>(null)
  const [form,      setForm]      = useState(EMPTY)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [newMatricule, setNewMatricule] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (q = '') => {
    setLoading(true)
    try {
      const r = await api.get('/etudiants', { params: { search: q } })
      setEtudiants(r.data.data)
    } catch { toast.error('Erreur chargement étudiants') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const reset = () => {
    setForm(EMPTY); setEditing(null)
    setPreview(null); setNewMatricule(null)
  }

  const handleEdit = (e: Etudiant) => {
    setEditing(e)
    setForm({
      nom: e.nom, prenom: e.prenom, sexe: e.sexe,
      date_naissance: e.date_naissance || '', lieu_naissance: e.lieu_naissance || '',
      numero_cin: e.numero_cin || '', date_cin: e.date_cin || '',
      lieu_cin: e.lieu_cin || '', telephone: e.telephone || '', email: e.email || '',
    })
    setPreview(e.photo_url || null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    const targetId = editing?.matricule || newMatricule
    if (targetId) {
      const fd = new FormData()
      fd.append('photo', file)
      try {
        const r = await api.post(`/etudiants/${targetId}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setPreview(r.data.photo_url)
        toast.success('Photo mise à jour')
        load(search)
      } catch { toast.error('Erreur upload photo') }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/etudiants/${editing.matricule}`, form)
        toast.success('Étudiant mis à jour')
        reset(); load(search)
      } else {
        const r = await api.post('/etudiants', form)
        const mat = r.data.matricule
        setNewMatricule(mat)
        toast.success(`✅ Étudiant créé — Matricule : ${mat}`)
        load(search)
        setForm(EMPTY)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  const handleDelete = async (mat: string) => {
    if (!confirm(`Supprimer l'étudiant ${mat} ?`)) return
    try { await api.delete(`/etudiants/${mat}`); toast.success('Étudiant supprimé'); load(search) }
    catch { toast.error('Erreur suppression') }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      {/* ── Formulaire ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifier l\'étudiant' : 'Nouvel étudiant'}</span>
          {editing && <button className="btn btn-secondary btn-sm" onClick={reset}>✕ Annuler</button>}
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 24 }}>
              {/* Champs */}
              <div style={{ flex: 1 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nom :</label>
                    <input className="form-control" value={form.nom} onChange={set('nom')} required placeholder="Nom de famille" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom(s) :</label>
                    <input className="form-control" value={form.prenom} onChange={set('prenom')} required placeholder="Prénoms" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sexe :</label>
                    <select className="form-control" value={form.sexe} onChange={set('sexe')}>
                      <option>HOMME</option><option>FEMME</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de naissance :</label>
                    <input className="form-control" type="date" value={form.date_naissance} onChange={set('date_naissance')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Lieu de naissance :</label>
                    <input className="form-control" value={form.lieu_naissance} onChange={set('lieu_naissance')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Numéro CIN :</label>
                    <input className="form-control" value={form.numero_cin} onChange={set('numero_cin')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date CIN :</label>
                    <input className="form-control" type="date" value={form.date_cin} onChange={set('date_cin')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lieu CIN :</label>
                    <input className="form-control" value={form.lieu_cin} onChange={set('lieu_cin')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Téléphone :</label>
                    <input className="form-control" value={form.telephone} onChange={set('telephone')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail :</label>
                    <input className="form-control" type="email" value={form.email} onChange={set('email')} />
                  </div>
                </div>
              </div>

              {/* Photo */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <div className="photo-box" onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
                  {preview
                    ? <img src={preview} alt="Photo étudiant" />
                    : (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 12 }}>
                        <div style={{ fontSize: 44 }}>👤</div>
                        <div style={{ fontSize: 11, marginTop: 6 }}>Cliquer pour ajouter</div>
                      </div>
                    )
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <button type="button" className="btn btn-secondary btn-sm" style={{ width: 140 }}
                  onClick={() => fileRef.current?.click()}>
                  📷 Photo
                </button>
                {newMatricule && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                    Matricule : {newMatricule}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                {editing ? '💾 Mettre à jour' : '➕ Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Liste d'étudiant(s)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{etudiants.length} étudiant(s)</div>
          </div>
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Mot à rechercher..." value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Matricule</th><th>Photo</th><th>Nom</th><th>Prénoms</th>
                  <th>Sexe</th><th>Téléphone</th><th>Email</th><th>Éditeur</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {etudiants.length === 0 ? (
                  <tr><td colSpan={9} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucun étudiant trouvé</td></tr>
                ) : etudiants.map(e => (
                  <tr key={e.matricule}>
                    <td><span className="badge badge-info">{e.matricule}</span></td>
                    <td>
                      {e.photo_url
                        ? <img src={e.photo_url} alt="" style={{ width: 32, height: 38, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
                        : <div style={{ width: 32, height: 38, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                      }
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.nom}</td>
                    <td>{e.prenom}</td>
                    <td><span className={`badge ${e.sexe === 'HOMME' ? 'badge-info' : 'badge-warning'}`}>{e.sexe}</span></td>
                    <td style={{ fontSize: 12 }}>{e.telephone}</td>
                    <td style={{ fontSize: 12 }}>{e.email}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.editeur}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-icon edit" onClick={() => handleEdit(e)} title="Modifier">✏️</button>
                        <button className="btn-icon delete" onClick={() => handleDelete(e.matricule)} title="Supprimer">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
