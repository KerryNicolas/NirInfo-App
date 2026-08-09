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
/// <reference types="vite/client" />