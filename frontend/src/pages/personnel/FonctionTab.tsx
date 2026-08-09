import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {  IcoEdit, IcoPlus, IcoSave, IcoTrash, IcoX,  } from '../../components/icons'


interface Fonction {
  id_fonction: number
  nom_fonction: string
  description_fonction: string
}


const emptyForm = { nom_fonction: '', description_fonction: '' }

export default function FonctionTab() {
  const [fonctions, setFonctions] = useState<Fonction[]>([])
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState({ ...emptyForm })
  const [editId, setEditId]       = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/fonctions').then(r => setFonctions(r.data.data ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom_fonction) { toast.error('Le nom de la fonction est obligatoire'); return }
    setSubmitting(true)
    try {
      if (editId) { await api.put(`/fonctions/${editId}`, form); toast.success('Fonction modifiée') }
      else { await api.post('/fonctions', form); toast.success('Fonction enregistrée') }
      setForm({ ...emptyForm }); setEditId(null); load()
    } catch { toast.error('Erreur lors de l\'enregistrement') }
    finally { setSubmitting(false) }
  }

  const handleEdit = (f: Fonction) => {
    setEditId(f.id_fonction)
    setForm({ nom_fonction: f.nom_fonction, description_fonction: f.description_fonction ?? '' })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette fonction ?')) return
    try { await api.delete(`/fonctions/${id}`); toast.success('Fonction supprimée'); load() }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const inputStyle = { padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', fontFamily:'inherit', background:'#fafbfc', width:'100%', boxSizing:'border-box' as const }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">{editId ? 'Modifier la fonction' : 'Nouvelle fonction'}</span>
          {editId && <button onClick={() => { setForm({ ...emptyForm }); setEditId(null) }} style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoX /> Annuler</button>}
        </div>
        <form onSubmit={handleSubmit} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 18px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Nom de la fonction <span style={{ color:'#ef4444' }}>*</span></label>
            <input value={form.nom_fonction} onChange={e => setForm(f => ({ ...f, nom_fonction: e.target.value }))} placeholder="Ex: Directeur, Formateur..." style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Description</label>
            <input value={form.description_fonction} onChange={e => setForm(f => ({ ...f, description_fonction: e.target.value }))} placeholder="Description optionnelle..." style={inputStyle} onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end' }}>
            <button type="submit" disabled={submitting}
              style={{ display:'flex', alignItems:'center', gap:7, background: editId ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:9, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 10px rgba(30,64,175,0.3)', opacity: submitting ? 0.7 : 1 }}>
              <IcoSave /> {submitting ? 'Enregistrement...' : (editId ? 'Modifier' : 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Liste des fonctions</span>
          <button onClick={() => { setForm({ ...emptyForm }); setEditId(null); window.scrollTo({top:0,behavior:'smooth'}) }} style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#1e40af,#2563eb)', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(30,64,175,0.25)' }}><IcoPlus /> Nouvelle fonction</button>
        </div>
        <div className="table-wrapper">
          {loading ? <div className="loading-center"><div className="spinner"/></div> : (
            <table>
              <thead><tr><th>#</th><th>Nom de la fonction</th><th>Description</th><th>Action</th></tr></thead>
              <tbody>
                {fonctions.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>Aucune fonction enregistrée</td></tr>
                ) : fonctions.map((f, i) => (
                  <tr key={f.id_fonction}>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{i+1}</td>
                    <td style={{ fontWeight:600, color:'#1e293b' }}>{f.nom_fonction}</td>
                    <td style={{ color:'#64748b', fontSize:12 }}>{f.description_fonction || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={() => handleEdit(f)} style={{ display:'flex', alignItems:'center', gap:4, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoEdit /> Modifier</button>
                        <button onClick={() => handleDelete(f.id_fonction)} style={{ display:'flex', alignItems:'center', gap:4, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}><IcoTrash /> Suppr.</button>
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