/// <reference types="vite/client" />
// FIX : cette directive doit être la PREMIÈRE ligne du fichier, sinon
// TypeScript l'ignore — import.meta.env (VITE_API_URL) n'était pas typé.

declare module '*.png';
declare module '*.css';
declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.jpeg' {
  const value: string
  export default value
}
