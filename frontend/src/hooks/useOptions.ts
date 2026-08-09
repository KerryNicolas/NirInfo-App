import { useState, useEffect } from 'react'
import api from '../api/axios'

export function useOptions<T = Record<string, unknown>>(
  endpoint: string,
  valueKey: keyof T,
  labelKey: keyof T,
  extraParams: Record<string, string | number> = {}
): { value: string; label: string; raw: T }[] {
  const [options, setOptions] = useState<{ value: string; label: string; raw: T }[]>([])

  useEffect(() => {
    api.get(endpoint, { params: { per_page: 500, ...extraParams } })
      .then(r => {
        const list: T[] = Array.isArray(r.data) ? r.data : (r.data.data ?? [])
        setOptions(list.map(item => ({
          value: String(item[valueKey] ?? ''),
          label: String(item[labelKey] ?? ''),
          raw:   item,
        })))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  return options
}