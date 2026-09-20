import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

export interface SessionSuggestion {
  code_session: string
  module_nom?: string
}

// Même principe que useMatriculeSuggestions.ts déjà dans le projet : recherche
// débattue, résultats limités — évite de charger toutes les sessions (2671+
// lignes en base) d'un coup dans un <select>.
//
// onlyActive (true par défaut) exclut les sessions déjà terminées — pertinent
// pour une NOUVELLE inscription. Passer false pour Recouvrement (on peut
// encore percevoir de l'argent sur une session finie) et pour l'historique de
// Pointage (justement fait pour consulter des sessions passées).
export function useSessionSuggestions(query: string, onlyActive: boolean = true) {
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setSuggestions([]); return }

    timer.current = setTimeout(() => {
      api.get('/sessions', { params: { search: query, per_page: 10, ...(onlyActive ? { only_active: 1 } : {}) } })
        .then(r => {
          const data = r.data?.data ?? []
          setSuggestions(data.map((s: any) => ({ code_session: s.code_session, module_nom: s.module_nom })))
        })
        .catch(() => setSuggestions([]))
    }, 300)
  }, [query, onlyActive])

  return suggestions
}