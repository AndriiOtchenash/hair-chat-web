import { useEffect, useState } from 'react'

/** False until `ms` have passed since the first render, then true. */
export function useAfter(ms: number): boolean {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPassed(true)
    }, ms)
    return () => {
      clearTimeout(timer)
    }
  }, [ms])
  return passed
}
