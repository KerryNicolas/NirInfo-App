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
}

export interface UseTableReturn<T> {
  data:       T[]
  loading:    boolean
  error:      string | null
  meta:       TableMeta
  search:     string
  sortCol:    string
  sortDir:    'asc' | 'desc'
  setSearch:  (v: string) => void
  setPage:    (p: number) => void
  setSort:    (col: string) => void
  setPerPage: (n: number) => void
  setParams:  (p: Record<string, string | number>) => void
  reload:     () => void
  reset:      () => void
}

const DEFAULT_META: TableMeta = {
  total: 0, per_page: 15, current_page: 1, last_page: 1, from: 0, to: 0
}

export function useTable<T = Record<string, unknown>>(
  endpoint: string,
  options: UseTableOptions = {}
): UseTableReturn<T> {
  const {
    perPage:     initPerPage = 15,
    defaultSort: initSort    = '',
    defaultDir:  initDir     = 'desc',
    params:      extraParamsInit = {},
    autoLoad                 = true,
  } = options

  const [data,        setData]       = useState<T[]>([])
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState<string | null>(null)
  const [meta,        setMeta]       = useState<TableMeta>(DEFAULT_META)
  const [search,      setSearchRaw]  = useState('')
  const [page,        setPageRaw]    = useState(1)
  const [perPage,     setPerPageRaw] = useState(initPerPage)
  const [sortCol,     setSortCol]    = useState(initSort)
  const [sortDir,     setSortDir]    = useState<'asc' | 'desc'>(initDir)
  const [extraParams, setExtraParams] = useState<Record<string, string | number>>(extraParamsInit)

  const stateRef = useRef({ page, perPage, search, sortCol, sortDir, extraParams })
  stateRef.current = { page, perPage, search, sortCol, sortDir, extraParams }

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (opts: {
    page: number; perPage: number; search: string
    sortCol: string; sortDir: string
    extraParams: Record<string, string | number>
  }) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {
        page:     opts.page,
        per_page: opts.perPage,
        ...opts.extraParams,
      }
      if (opts.search)  params.search   = opts.search
      if (opts.sortCol) { params.sort = opts.sortCol; params.sort_dir = opts.sortDir }

      const r = await api.get(endpoint, { params })
      const d = r.data

      if (d && d.data !== undefined) {
        setData(d.data)
        setMeta({
          total:        d.total        ?? d.data.length,
          per_page:     d.per_page     ?? opts.perPage,
          current_page: d.current_page ?? opts.page,
          last_page:    d.last_page    ?? Math.ceil((d.total ?? d.data.length) / opts.perPage),
          from:         d.from         ?? ((opts.page - 1) * opts.perPage + 1),
          to:           d.to           ?? Math.min(opts.page * opts.perPage, d.total ?? d.data.length),
        })
      } else {
        const arr = Array.isArray(d) ? d : []
        setData(arr)
        setMeta({ ...DEFAULT_META, total: arr.length, per_page: opts.perPage })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur de chargement'
      setError(msg)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [endpoint])

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

  // ── NOUVEAU : setParams ──
  const setParams = useCallback((p: Record<string, string | number>) => {
    setExtraParams(p)
    setSearchRaw('')
    setPageRaw(1)
    const s = stateRef.current
    fetchData({ page: 1, perPage: s.perPage, search: '', sortCol: s.sortCol, sortDir: s.sortDir, extraParams: p })
  }, [fetchData])

  const reload = useCallback(() => {
    const s = stateRef.current
    fetchData({ page: s.page, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
  }, [fetchData])

  const reset = useCallback(() => {
    setSearchRaw(''); setPageRaw(1); setSortCol(initSort); setSortDir(initDir)
    setExtraParams(extraParamsInit)
    fetchData({ page: 1, perPage, search: '', sortCol: initSort, sortDir: initDir, extraParams: extraParamsInit })
  }, [fetchData, perPage, initSort, initDir, extraParamsInit])

  return {
    data, loading, error, meta,
    search, sortCol, sortDir,
    setSearch, setPage, setSort, setPerPage,
    setParams,
    reload, reset,
  }
}