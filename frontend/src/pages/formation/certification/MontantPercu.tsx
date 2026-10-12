import { useState } from 'react'
import api from '../../../api/axios'
import { IcoMoney, IcoAward, IcoSearch } from '../../../components/icons'
import { fmtMontant } from './types'

const today = new Date().toISOString().split('T')[0]

export default function MontantPercu() {
  const [dateDebut, setDateDebut] = useState(today)
  const [dateFin, setDateFin]     = useState(today)
  const [data, setData]           = useState<{ nb: number; montant: number } | null>(null)
  const [loading, setLoading]     = useState(false)

  const handleVoir = async () => {
    setLoading(true)
    try {
      const r = await api.get('/certifications/montant', { params: { date_debut: dateDebut, date_fin: dateFin } })
      setData(r.data)
    } catch { setData({ nb:0, montant:0 }) }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display:'flex', alignItems:'center', gap:7 }}><IcoMoney /> Montant perçu — Certifications</span>
      </div>
      <div className="card-body">
        <div style={{ display:'flex', alignItems:'flex-end', gap:12, flexWrap:'wrap', marginBottom:24 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Date début</label>
            <input className="form-control" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Date fin</label>
            <input className="form-control" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleVoir} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> Chargement…</> : <><IcoSearch /> Voir</>}
          </button>
        </div>
        {data ? (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:24, textAlign:'center' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'#dcfce7', color:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoAward /></div>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:6 }}>Certificats délivrés</p>
              <p style={{ fontSize:40, fontWeight:800, color:'#16a34a', lineHeight:1 }}>{data.nb}</p>
            </div>
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:24, textAlign:'center' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'#dbeafe', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><IcoMoney /></div>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:6 }}>Montant total perçu</p>
              <p style={{ fontSize:32, fontWeight:800, color:'#2563eb', lineHeight:1 }}>{fmtMontant(data.montant)} Ar</p>
            </div>
          </div>
        ) : <div className="empty-state">Sélectionnez une période et cliquez sur <b>Voir</b></div>}
      </div>
    </div>
  )
}