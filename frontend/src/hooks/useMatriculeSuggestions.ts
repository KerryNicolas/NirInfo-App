import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

export interface EtudiantSuggestion {
  matricule: string
  nom: string
  prenom: string
}

export function useMatriculeSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<EtudiantSuggestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setSuggestions([]); return }

    timer.current = setTimeout(() => {
      api.get('/etudiants', { params: { search: query, per_page: 8 } })
        .then(r => {
          const data = r.data?.data ?? []
          setSuggestions(data.map((e: any) => ({ matricule: e.matricule, nom: e.nom, prenom: e.prenom })))
        })
        .catch(() => setSuggestions([]))
    }, 300)
  }, [query])

  return suggestions
}