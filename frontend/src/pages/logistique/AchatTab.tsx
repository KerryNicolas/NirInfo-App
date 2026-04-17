import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface Achat {
  id_achat: number
  nom_materiel: string
  prix_unitaire: number
  quantite: number
  montant: number
  date_achat: string
  photo_achat: string
  matricule_s: string | null
  editeur?: string
}

/* ── Icônes SVG ── */
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IcoTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IcoSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
)
const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IcoCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)
const IcoExcel = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
)
const IcoImage = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n)

const emptyForm = { nom_materiel: '', prix_unitaire: '', quantite: '1', date_achat: '', photo_achat: '' }

export default function AchatTab() {
  const [achats, setAchats]       = useState<Achat[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ ...emptyForm })
  const [editId, setEditId]       = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    api.get('/achats', { params: { search } })
      .then(r => setAchats(r.data.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    const fd = new FormData()
    fd.append('photo', file)
    try {
      const res = await api.post('/achats/upload-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, photo_achat: res.data.path ?? '' }))
    } catch {
      // silencieux
    }
  }

  const montant = () => {
    const p = parseFloat(form.prix_unitaire) || 0
    const q = parseInt(form.quantite) || 0
    return p * q
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom_materiel || !form.prix_unitaire || !form.date_achat) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setSubmitting(true)
    const payload = { ...form, montant: montant(), prix_unitaire: parseFloat(form.prix_unitaire), quantite: parseInt(form.quantite) }
    try {
      if (editId) {
        await api.put(`/achats/${editId}`, payload)
        toast.success('Achat modifié')
      } else {
        await api.post('/achats', payload)
        toast.success('Achat enregistré')
      }
      setForm({ ...emptyForm }); setEditId(null); setPhotoPreview(''); load()
    } catch { toast.error('Erreur lors de l\'enregistrement') }
    finally { setSubmitting(false) }
  }

  const handleEdit = (a: Achat) => {
    setEditId(a.id_achat)
    setForm({ nom_materiel: a.nom_materiel, prix_unitaire: String(a.prix_unitaire), quantite: String(a.quantite), date_achat: a.date_achat?.slice(0, 10) ?? '', photo_achat: a.photo_achat ?? '' })
    setPhotoPreview(a.photo_achat ? `http://localhost:8000/storage/${a.photo_achat}` : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet achat ?')) return
    try { await api.delete(`/achats/${id}`); toast.success('Achat supprimé'); load() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const handleCancel = () => { setForm({ ...emptyForm }); setEditId(null); setPhotoPreview('') }

  const exportCSV = () => {
    const rows = [['ID', 'Matériel', 'Prix unitaire', 'Quantité', 'Montant', 'Date', 'Éditeur'],
      ...achats.map(a => [a.id_achat, a.nom_materiel, a.prix_unitaire, a.quantite, a.montant, a.date_achat, a.editeur ?? ''])]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'achats.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalMontant = achats.reduce((s, a) => s + Number(a.montant), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Formulaire ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{editId ? 'Modifier l\'achat' : 'Nouvel achat'}</span>
          {editId && (
            <button onClick={handleCancel} style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              <IcoX /> Annuler
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 18px' }}>
          {/* Nom matériel */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Nom du matériel <span style={{ color:'#ef4444' }}>*</span></label>
            <input value={form.nom_materiel} onChange={e => setForm(f => ({ ...f, nom_materiel: e.target.value }))}
              placeholder="Ex: Chaise, Tableau blanc..."
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc' }}
              onFocus={e => e.target.style.borderColor='#3b82f6'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>

          {/* Date */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Date d'achat <span style={{ color:'#ef4444' }}>*</span></label>
            <input type="date" value={form.date_achat} onChange={e => setForm(f => ({ ...f, date_achat: e.target.value }))}
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc' }}
              onFocus={e => e.target.style.borderColor='#3b82f6'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>

          {/* Prix unitaire */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Prix unitaire (Ar) <span style={{ color:'#ef4444' }}>*</span></label>
            <input type="number" value={form.prix_unitaire} onChange={e => setForm(f => ({ ...f, prix_unitaire: e.target.value }))}
              placeholder="0"
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc' }}
              onFocus={e => e.target.style.borderColor='#3b82f6'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>

          {/* Quantité */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Quantité</label>
            <input type="number" min="1" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))}
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc' }}
              onFocus={e => e.target.style.borderColor='#3b82f6'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>

          {/* Montant calculé */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Montant total (calculé)</label>
            <div style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, background:'#f0fdf4', color:'#16a34a', fontWeight:700 }}>
              {fmt(montant())} Ar
            </div>
          </div>

          {/* Photo */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Photo du matériel</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:48, height:48, borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                {photoPreview ? <img src={photoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <IcoImage />}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ display:'flex', alignItems:'center', gap:6, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                <IcoCamera /> Choisir une photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }} />
            </div>
          </div>

          {/* Bouton submit — pleine largeur */}
          <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end', paddingTop:4 }}>
            <button type="submit" disabled={submitting}
              style={{ display:'flex', alignItems:'center', gap:7, background: editId ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:9, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow: editId ? '0 2px 10px rgba(245,158,11,0.3)' : '0 2px 10px rgba(30,64,175,0.3)', opacity: submitting ? 0.7 : 1 }}>
              <IcoSave /> {submitting ? 'Enregistrement...' : (editId ? 'Modifier' : 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>

      {/* ── Liste ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">Liste des achats</span>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Total : <b style={{ color:'#1e40af' }}>{fmt(totalMontant)} Ar</b></p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', display:'flex' }}><IcoSearch /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ paddingLeft:32, paddingRight:12, paddingTop:7, paddingBottom:7, borderRadius:8, border:'1px solid #e2e8f0', fontSize:12, outline:'none', fontFamily:'inherit', width:180 }} />
            </div>
            <button onClick={exportCSV}
              style={{ display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:8, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              <IcoExcel /> Exporter
            </button>
            <button onClick={() => { handleCancel(); window.scrollTo({ top:0, behavior:'smooth' }) }}
              style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(30,64,175,0.25)' }}>
              <IcoPlus /> Nouvel achat
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <table>
              <thead><tr>
                <th>#</th><th>Photo</th><th>Matériel</th><th>Prix unit.</th><th>Qté</th><th>Montant</th><th>Date</th><th>Action</th>
              </tr></thead>
              <tbody>
                {achats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>Aucun achat enregistré</td></tr>
                ) : achats.map((a, i) => (
                  <tr key={a.id_achat}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{i + 1}</td>
                    <td>
                      <div style={{ width:36, height:36, borderRadius:6, border:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                        {a.photo_achat ? <img src={`http://localhost:8000/storage/${a.photo_achat}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <IcoImage />}
                      </div>
                    </td>
                    <td style={{ fontWeight:600, color:'#1e293b' }}>{a.nom_materiel}</td>
                    <td style={{ color:'#64748b' }}>{fmt(Number(a.prix_unitaire))} Ar</td>
                    <td><span className="badge badge-info">{a.quantite}</span></td>
                    <td style={{ fontWeight:700, color:'#16a34a' }}>{fmt(Number(a.montant))} Ar</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{a.date_achat?.slice(0, 10)}</td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={() => handleEdit(a)} title="Modifier"
                          style={{ display:'flex', alignItems:'center', gap:4, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          <IcoEdit /> Modifier
                        </button>
                        <button onClick={() => handleDelete(a.id_achat)} title="Supprimer"
                          style={{ display:'flex', alignItems:'center', gap:4, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          <IcoTrash /> Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}