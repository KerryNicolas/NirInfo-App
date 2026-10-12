import { useEffect, useState } from 'react'
import api from '../api/axios'

// Liste des lieux (formation et paiement), lue depuis /lieux : elle se gère
// dans l'onglet « Lieu » de Session au lieu d'être écrite en dur dans chaque
// écran. Les trois lieux d'origine servent de repli si la liste ne répond pas.
const LIEUX_D_ORIGINE = ['Ampandrana', 'Ampefiloha', 'Andravoahangy']

export function useLieux(): string[] {
  const [lieux, setLieux] = useState<string[]>(LIEUX_D_ORIGINE)

  useEffect(() => {
    let actif = true
    api.get('/lieux', { params: { per_page: 200, sort: 'l.nom_lieu', sort_dir: 'asc' } })
      .then(r => {
        const noms = (r.data?.data ?? []).map((l: { nom: string }) => l.nom).filter(Boolean)
        if (actif && noms.length > 0) setLieux(noms)
      })
      .catch(() => { /* on garde les lieux d'origine */ })
    return () => { actif = false }
  }, [])

  return lieux
}

const pareil = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

interface Props {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  /** Ajoute « Tous les lieux » en tête (filtres). */
  tous?: boolean
}

export default function LieuSelect({ value, onChange, tous }: Props) {
  const lieux = useLieux()

  // Les anciennes saisies sont parfois en minuscules (« ampefiloha ») : on
  // affiche le lieu correspondant de la liste. Un lieu déjà enregistré mais
  // absent de la liste reste proposé, pour ne pas le perdre à la modification.
  const connu   = lieux.find(l => pareil(l, value))
  const absent  = value && value !== 'Tous' && !connu
  const options = absent ? [...lieux, value] : lieux

  return (
    <select className="form-control" value={connu ?? value} onChange={onChange}>
      {tous && <option value="Tous">Tous les lieux</option>}
      {options.map(l => <option key={l} value={l}>{l}</option>)}
    </select>
  )
}
