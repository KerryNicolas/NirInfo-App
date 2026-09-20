import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'

export interface TableMeta {
  total:        number
  per_page:     number
  current_page: number
  last_page:    number
  from:         number
  to:           number
}

export interface UseTableOptions {
  perPage?:     number
  defaultSort?: string
  defaultDir?:  'asc' | 'desc'
  params?:      Record<string, string | number>
  autoLoad?:    boolean
  /** Précharge automatiquement la page suivante en arrière-plan (défaut: true) */
  prefetchNext?: boolean
  /** Durée de vie du cache en ms avant de considérer une entrée "périmée" (défaut: 30s) */
  staleTime?:   number
}

export interface UseTableReturn<T> {
  data:        T[]
  loading:     boolean
  /** true seulement lors du tout premier chargement d'une clé jamais vue (pas de cache à afficher) */
  initialLoad: boolean
  /** true quand on affiche des données en cache pendant qu'un refresh tourne en fond */
  isValidating: boolean
  error:       string | null
  meta:        TableMeta
  search:      string
  sortCol:     string
  sortDir:     'asc' | 'desc'
  setSearch:   (v: string) => void
  setPage:     (p: number) => void
  setSort:     (col: string) => void
  setPerPage:  (n: number) => void
  setParams:   (p: Record<string, string | number>) => void
  reload:      () => void
  reset:       () => void
}

const DEFAULT_META: TableMeta = {
  total: 0, per_page: 15, current_page: 1, last_page: 1, from: 0, to: 0
}

type FetchOpts = {
  page: number; perPage: number; search: string
  sortCol: string; sortDir: string
  extraParams: Record<string, string | number>
}

type CacheEntry<T> = {
  data: T[]
  meta: TableMeta
  timestamp: number
}

// Cache global partagé entre tous les composants qui utilisent le même endpoint.
// Évite de re-fetcher quand on navigue entre onglets puis qu'on revient.
const globalCache = new Map<string, CacheEntry<unknown>>()

function buildKey(endpoint: string, opts: FetchOpts): string {
  return `${endpoint}::${JSON.stringify(opts)}`
}

export function useTable<T = Record<string, unknown>>(
  endpoint: string,
  options: UseTableOptions = {}
): UseTableReturn<T> {
  const {
    perPage:      initPerPage    = 15,
    defaultSort:  initSort       = '',
    defaultDir:   initDir        = 'desc',
    params:       extraParamsInit = {},
    autoLoad                     = true,
    prefetchNext                 = true,
    staleTime                    = 30_000,
  } = options

  const [data,         setData]        = useState<T[]>([])
  const [loading,      setLoading]     = useState(false)
  const [initialLoad,  setInitialLoad] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error,        setError]       = useState<string | null>(null)
  const [meta,         setMeta]        = useState<TableMeta>(DEFAULT_META)
  const [search,       setSearchRaw]   = useState('')
  const [page,         setPageRaw]     = useState(1)
  const [perPage,      setPerPageRaw]  = useState(initPerPage)
  const [sortCol,      setSortCol]     = useState(initSort)
  const [sortDir,      setSortDir]     = useState<'asc' | 'desc'>(initDir)
  const [extraParams,  setExtraParams] = useState<Record<string, string | number>>(extraParamsInit)

  const stateRef = useRef({ page, perPage, search, sortCol, sortDir, extraParams })
  stateRef.current = { page, perPage, search, sortCol, sortDir, extraParams }

  const searchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef       = useRef<AbortController | null>(null)
  // évite qu'un prefetch redéclenche un prefetch en boucle
  const prefetchingRef = useRef<Set<string>>(new Set())

  const applyResult = useCallback((d: any, opts: FetchOpts): CacheEntry<T> => {
    let newData: T[]
    let newMeta: TableMeta
    if (d && d.data !== undefined) {
      newData = d.data
      newMeta = {
        total:        d.total        ?? d.data.length,
        per_page:     d.per_page     ?? opts.perPage,
        current_page: d.current_page ?? opts.page,
        last_page:    d.last_page    ?? Math.ceil((d.total ?? d.data.length) / opts.perPage),
        from:         d.from         ?? ((opts.page - 1) * opts.perPage + 1),
        to:           d.to           ?? Math.min(opts.page * opts.perPage, d.total ?? d.data.length),
      }
    } else {
      const arr = Array.isArray(d) ? d : []
      newData = arr
      newMeta = { ...DEFAULT_META, total: arr.length, per_page: opts.perPage }
    }
    return { data: newData, meta: newMeta, timestamp: Date.now() }
  }, [])

  const rawFetch = useCallback(async (opts: FetchOpts, signal?: AbortSignal) => {
    const params: Record<string, string | number> = {
      page:     opts.page,
      per_page: opts.perPage,
      ...opts.extraParams,
    }
    if (opts.search)  params.search   = opts.search
    if (opts.sortCol) { params.sort = opts.sortCol; params.sort_dir = opts.sortDir }

    const r = await api.get(endpoint, { params, signal })
    return applyResult(r.data, opts)
  }, [endpoint, applyResult])

  // Précharge silencieusement une page dans le cache global, sans toucher au state affiché.
  const prefetchPage = useCallback((opts: FetchOpts) => {
    const key = buildKey(endpoint, opts)
    if (globalCache.has(key) || prefetchingRef.current.has(key)) return
    prefetchingRef.current.add(key)
    rawFetch(opts).then(entry => {
      globalCache.set(key, entry as CacheEntry<unknown>)
    }).catch(() => { /* silencieux : un prefetch raté n'affiche pas d'erreur */ }
    ).finally(() => {
      prefetchingRef.current.delete(key)
    })
  }, [endpoint, rawFetch])

  const fetchData = useCallback(async (opts: FetchOpts) => {
    const key = buildKey(endpoint, opts)
    const cached = globalCache.get(key) as CacheEntry<T> | undefined

    // Annule la requête en vol précédente (évite les races page2/page3)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (cached) {
      // Affichage immédiat depuis le cache — 0 latence perçue
      setData(cached.data)
      setMeta(cached.meta)
      setInitialLoad(false)
      setError(null)
      const isFresh = Date.now() - cached.timestamp < staleTime
      if (isFresh) {
        // Assez récent : on ne relance même pas de requête réseau
        setIsValidating(false)
        return
      }
      // Périmé : on garde l'affichage actuel et on revalide en fond
      setIsValidating(true)
    } else {
      setLoading(true)
      setIsValidating(false)
    }
    setError(null)

    try {
      const entry = await rawFetch(opts, controller.signal)
      globalCache.set(key, entry as CacheEntry<unknown>)
      setData(entry.data)
      setMeta(entry.meta)
      setInitialLoad(false)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'CanceledError' || (err as { name?: string })?.name === 'AbortError') {
        return // requête annulée volontairement, on ignore
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur de chargement'
      if (!cached) {
        setError(msg)
        setData([])
      }
      // si on avait du cache, on le laisse affiché plutôt que de vider l'écran sur une erreur de revalidation
    } finally {
      setLoading(false)
      setIsValidating(false)
    }

    // Préchargement discret de la page suivante
    if (prefetchNext && opts.page < (globalCache.get(key)?.meta.last_page ?? 1)) {
      prefetchPage({ ...opts, page: opts.page + 1 })
    }
  }, [endpoint, rawFetch, staleTime, prefetchNext, prefetchPage])

  // Chargement initial
  useEffect(() => {
    if (autoLoad) {
      fetchData({ page: 1, perPage: initPerPage, search: '', sortCol: initSort, sortDir: initDir, extraParams: extraParamsInit })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rechargement quand extraParams changent
  const prevParamsRef = useRef(JSON.stringify(extraParamsInit))
  useEffect(() => {
    const current = JSON.stringify(extraParams)
    if (current !== prevParamsRef.current) {
      prevParamsRef.current = current
      fetchData({ page: 1, perPage, search, sortCol, sortDir, extraParams })
      setPageRaw(1)
    }
  }, [extraParams, fetchData, perPage, search, sortCol, sortDir])

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v)
    setPageRaw(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const s = stateRef.current
      fetchData({ page: 1, perPage: s.perPage, search: v, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
    }, 320)
  }, [fetchData])

  const setPage = useCallback((p: number) => {
    setPageRaw(p)
    const s = stateRef.current
    fetchData({ page: p, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
  }, [fetchData])

  const setPerPage = useCallback((n: number) => {
    setPerPageRaw(n)
    setPageRaw(1)
    const s = stateRef.current
    fetchData({ page: 1, perPage: n, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
  }, [fetchData])

  const setSort = useCallback((col: string) => {
    const s = stateRef.current
    const dir = s.sortCol === col && s.sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(col); setSortDir(dir); setPageRaw(1)
    fetchData({ page: 1, perPage: s.perPage, search: s.search, sortCol: col, sortDir: dir, extraParams: s.extraParams })
  }, [fetchData])

  const setParams = useCallback((p: Record<string, string | number>) => {
    setExtraParams(p)
    setSearchRaw('')
    setPageRaw(1)
    const s = stateRef.current
    fetchData({ page: 1, perPage: s.perPage, search: '', sortCol: s.sortCol, sortDir: s.sortDir, extraParams: p })
  }, [fetchData])

  const reload = useCallback(() => {
    const s = stateRef.current
    const key = buildKey(endpoint, { page: s.page, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
    globalCache.delete(key) // force un vrai refetch réseau, pas juste relire le cache
    fetchData({ page: s.page, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
  }, [fetchData, endpoint])

  const reset = useCallback(() => {
    setSearchRaw(''); setPageRaw(1); setSortCol(initSort); setSortDir(initDir)
    setExtraParams(extraParamsInit)
    fetchData({ page: 1, perPage, search: '', sortCol: initSort, sortDir: initDir, extraParams: extraParamsInit })
  }, [fetchData, perPage, initSort, initDir, extraParamsInit])

  return {
    data, loading, initialLoad, isValidating, error, meta,
    search, sortCol, sortDir,
    setSearch, setPage, setSort, setPerPage,
    setParams,
    reload, reset,
  }
}