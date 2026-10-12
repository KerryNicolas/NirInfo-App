import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'

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
  /**
   * Champs de la réponse autres que les lignes et la pagination (par exemple
   * un total calculé par le serveur). Ils viennent de la MÊME réponse que
   * « data » : lignes et totaux sont donc toujours ceux d'une même lecture.
   * Objet vide si le serveur n'en envoie pas.
   */
  extra:       Record<string, unknown>
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
  extra: Record<string, unknown>
  timestamp: number
}

// Champs de la réponse déjà rangés dans « data » et « meta » : tout le reste va dans « extra ».
const CHAMPS_PAGINATION = ['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to']

// Cache global partagé entre tous les composants qui utilisent le même endpoint.
// Évite de re-fetcher quand on navigue entre onglets puis qu'on revient.
const globalCache = new Map<string, CacheEntry<unknown>>()

// ── Le cache appartient à UNE identité ──
// FIX : les clés du cache ne disaient pas QUI avait obtenu les données. Après
// une déconnexion puis la connexion d'un autre compte dans le même onglet, les
// listes du premier utilisateur étaient réaffichées telles quelles — sans
// limite de durée, et pour de bon si le rafraîchissement échouait.
//
// Chaque clé commence maintenant par l'identité de l'utilisateur :
//     « <identité>|<endpoint>::<options en JSON> »
// Un écran ne lit et n'écrit que les clés de l'identité courante : il ne peut
// pas tomber sur les données d'un autre compte. Rien n'est modifié pendant le
// rendu ; l'identité de l'onglet n'est mise à jour que dans un effet.
//
// Identité : undefined = session pas encore connue (chargement de
// l'application) ; null = personne n'est connecté ; nombre = utilisateur
// connecté. Elle est lue dans AuthContext, qui n'est pas modifié.
type Identite = number | null | undefined

// Identité pour laquelle cet onglet charge et range des listes. Mise à jour
// UNIQUEMENT dans un effet (jamais pendant le rendu).
let identiteDeLOnglet: Identite = undefined

function buildKey(identite: number, endpoint: string, opts: FetchOpts): string {
  return `${identite}|${endpoint}::${JSON.stringify(opts)}`
}

// L'identité est un nombre : elle s'arrête à la première barre. Le JSON des
// options commence toujours par « { » : l'endpoint est ce qui se trouve entre
// cette barre et le premier « ::{ ». Les deux se comparent EN ENTIER, jamais
// par préfixe : « /sessions » ne désigne pas « /sessions/en-cours ».
function partiesDeLaCle(cle: string): { identite: string; endpoint: string } {
  const barre = cle.indexOf('|')
  const fin   = cle.indexOf('::{')
  return { identite: cle.slice(0, barre), endpoint: cle.slice(barre + 1, fin === -1 ? undefined : fin) }
}

// Références stables rendues quand les données détenues ne sont pas celles de l'identité courante.
const AUCUNE_LIGNE: never[] = []
const AUCUN_EXTRA: Record<string, unknown> = {}

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
  const [extra,        setExtra]       = useState<Record<string, unknown>>({})
  const [search,       setSearchRaw]   = useState('')
  const [page,         setPageRaw]     = useState(1)
  const [perPage,      setPerPageRaw]  = useState(initPerPage)
  const [sortCol,      setSortCol]     = useState(initSort)
  const [sortDir,      setSortDir]     = useState<'asc' | 'desc'>(initDir)
  const [extraParams,  setExtraParams] = useState<Record<string, string | number>>(extraParamsInit)

  // Identité courante : simplement LUE pendant le rendu.
  const { user, loading: sessionEnCours } = useAuth()
  const identite: Identite = sessionEnCours ? undefined : (user?.id ?? null)
  // Identité qui a obtenu les données détenues par ce composant.
  const [proprietaire, setProprietaire] = useState<Identite>(undefined)
  // Vrai dès qu'une liste a été demandée (un écran en autoLoad:false n'est rechargé que s'il l'avait déjà été).
  const aDejaCharge = useRef(false)

  const stateRef = useRef({ page, perPage, search, sortCol, sortDir, extraParams })
  stateRef.current = { page, perPage, search, sortCol, sortDir, extraParams }

  const searchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef       = useRef<AbortController | null>(null)
  // évite qu'un prefetch redéclenche un prefetch en boucle
  const prefetchingRef = useRef<Set<string>>(new Set())

  const applyResult = useCallback((d: any, opts: FetchOpts): CacheEntry<T> => {
    let newData: T[]
    let newMeta: TableMeta
    let newExtra: Record<string, unknown> = {}
    if (d && d.data !== undefined) {
      newData = d.data
      newExtra = Object.fromEntries(Object.entries(d).filter(([champ]) => !CHAMPS_PAGINATION.includes(champ)))
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
    return { data: newData, meta: newMeta, extra: newExtra, timestamp: Date.now() }
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
    const pour = identiteDeLOnglet
    if (typeof pour !== 'number') return
    const key = buildKey(pour, endpoint, opts)
    if (globalCache.has(key) || prefetchingRef.current.has(key)) return
    prefetchingRef.current.add(key)
    rawFetch(opts).then(entry => {
      // Réponse arrivée après un changement d'identité : elle n'est pas rangée.
      if (identiteDeLOnglet === pour) globalCache.set(key, entry as CacheEntry<unknown>)
    }).catch(() => { /* silencieux : un prefetch raté n'affiche pas d'erreur */ }
    ).finally(() => {
      prefetchingRef.current.delete(key)
    })
  }, [endpoint, rawFetch])

  const fetchData = useCallback(async (opts: FetchOpts) => {
    // Aucune liste n'est demandée tant qu'aucun utilisateur n'est connu. « pour »
    // est l'identité au DÉPART de la requête : elle sert de clé, et de témoin
    // au retour.
    const pour = identiteDeLOnglet
    if (typeof pour !== 'number') return
    aDejaCharge.current = true
    const key = buildKey(pour, endpoint, opts)
    const cached = globalCache.get(key) as CacheEntry<T> | undefined

    // Annule la requête en vol précédente (évite les races page2/page3)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (cached) {
      // Affichage immédiat depuis le cache — 0 latence perçue
      setData(cached.data)
      setMeta(cached.meta)
      setExtra(cached.extra)
      setProprietaire(pour)
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
      // L'identité a changé pendant la requête : cette réponse est celle d'un
      // autre compte. Elle n'entre pas dans le cache et n'est pas affichée.
      if (identiteDeLOnglet !== pour) return
      globalCache.set(key, entry as CacheEntry<unknown>)
      setData(entry.data)
      setMeta(entry.meta)
      setExtra(entry.extra)
      setProprietaire(pour)
      setInitialLoad(false)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'CanceledError' || (err as { name?: string })?.name === 'AbortError') {
        return // requête annulée volontairement, on ignore
      }
      if (identiteDeLOnglet !== pour) return // échec d'une requête lancée pour une identité précédente : rien à afficher
      const reponse = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const msg = reponse?.data?.message ?? 'Erreur de chargement'
      // FIX : un refus du serveur (401, 403) signifie que ces données ne sont
      // plus accessibles à l'utilisateur. On ne laisse donc pas l'ancienne
      // copie à l'écran, et on l'oublie.
      const refuse = reponse?.status === 401 || reponse?.status === 403
      if (refuse) globalCache.delete(key)
      if (!cached || refuse) {
        setError(msg)
        setData([])
        setExtra({})
        setProprietaire(pour)
      }
      // Panne passagère (réseau, erreur 500) avec du cache : on laisse affichées
      // les données de CE MÊME utilisateur plutôt que de vider l'écran.
    } finally {
      setLoading(false)
      setIsValidating(false)
    }

    // Préchargement discret de la page suivante
    if (prefetchNext && opts.page < (globalCache.get(key)?.meta.last_page ?? 1)) {
      prefetchPage({ ...opts, page: opts.page + 1 })
    }
  }, [endpoint, rawFetch, staleTime, prefetchNext, prefetchPage])

  // Chargement initial, et rechargement à chaque changement d'identité.
  // C'est ICI, dans un effet, que l'onglet change d'identité : la requête en
  // vol est abandonnée, les entrées des autres identités sont retirées du
  // cache, puis la liste est demandée pour l'utilisateur connecté.
  // L'effet ne dépend que de l'identité (un nombre) : il ne peut pas boucler.
  useEffect(() => {
    abortRef.current?.abort()
    identiteDeLOnglet = identite
    if (identite !== undefined) {
      for (const cle of [...globalCache.keys()]) {
        if (partiesDeLaCle(cle).identite !== String(identite)) globalCache.delete(cle)
      }
    }
    if (typeof identite !== 'number') return
    if (autoLoad || aDejaCharge.current) {
      const s = stateRef.current
      fetchData({ page: s.page, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identite])

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
    // FIX : reload() est appelé après une création, une modification ou une
    // suppression. Ce ne sont alors pas seulement les lignes de la page
    // affichée qui sont périmées, mais TOUTES les variantes en cache de cette
    // liste (autres pages, autres filtres, autre recherche, autre tri : lignes
    // décalées, totaux changés). Seules les clés de CET endpoint, pour
    // l'identité courante, sont oubliées : les autres listes gardent leur cache.
    for (const cle of [...globalCache.keys()]) {
      const p = partiesDeLaCle(cle)
      if (p.endpoint === endpoint && p.identite === String(identiteDeLOnglet)) globalCache.delete(cle) // force un vrai refetch réseau, pas juste relire le cache
    }
    fetchData({ page: s.page, perPage: s.perPage, search: s.search, sortCol: s.sortCol, sortDir: s.sortDir, extraParams: s.extraParams })
  }, [fetchData, endpoint])

  const reset = useCallback(() => {
    setSearchRaw(''); setPageRaw(1); setSortCol(initSort); setSortDir(initDir)
    setExtraParams(extraParamsInit)
    fetchData({ page: 1, perPage, search: '', sortCol: initSort, sortDir: initDir, extraParams: extraParamsInit })
  }, [fetchData, perPage, initSort, initDir, extraParamsInit])

  // Les données détenues ne sont rendues que si elles ont été obtenues par
  // l'identité courante. Simple comparaison : rien n'est modifié ici.
  const aJour = typeof identite === 'number' && proprietaire === identite

  return {
    data:  aJour ? data  : AUCUNE_LIGNE,
    meta:  aJour ? meta  : DEFAULT_META,
    extra: aJour ? extra : AUCUN_EXTRA,
    error: aJour ? error : null,
    loading, initialLoad, isValidating,
    search, sortCol, sortDir,
    setSearch, setPage, setSort, setPerPage,
    setParams,
    reload, reset,
  }
}