import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

export interface ModuleSuggestion {
  code_module: string
  nom: string
}

// Même principe que useSessionSuggestions.ts / useMatriculeSuggestions.ts.
// Corrige au passage un bug réel : l'ancien <select> chargeait /modules sans
// per_page, donc seulement 15 des 65 modules existants étaient sélectionnables.
export function useModuleSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<ModuleSuggestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 1) { setSuggestions([]); return }

    timer.current = setTimeout(() => {
      api.get('/modules', { params: { search: query, per_page: 10 } })
        .then(r => {
          const data = r.data?.data ?? []
          setSuggestions(data.map((m: any) => ({ code_module: m.code_module, nom: m.nom })))
        })
        .catch(() => setSuggestions([]))
    }, 300)
  }, [query])

  return suggestions
}