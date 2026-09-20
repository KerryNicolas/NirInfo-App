import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

export interface FactureSuggestion {
  ref_facture: string
  numero_facture: string
  matricule: string
  code_session: string
  nom: string
  prenom: string
}

// Même principe que useMatriculeSuggestions.ts / useSessionSuggestions.ts.
// Recherche débattue sur /factures/suggestions (nouvel endpoint léger, lecture
// seule) — matche numero_facture, ref_facture, matricule, nom ou prénom.
export function useFactureSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<FactureSuggestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 1) { setSuggestions([]); return }

    timer.current = setTimeout(() => {
      api.get('/factures/suggestions', { params: { search: query } })
        .then(r => setSuggestions(r.data?.data ?? []))
        .catch(() => setSuggestions([]))
    }, 300)
  }, [query])

  return suggestions
}