export const toUpper = (s: string) => s.toUpperCase()

export const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase())

export const toFirstUpper = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export const toMatriculePrefix = (s: string) => {
  // Force le préfixe "NI-" en majuscules, garde le reste tel quel
  const upper = s.toUpperCase()
  return upper
}