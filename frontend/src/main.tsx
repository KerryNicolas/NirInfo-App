import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// FIX : AuthProvider retiré d'ici — il était monté deux fois (ici ET dans
// App.tsx), ce qui créait deux états de connexion indépendants, deux appels
// GET /user au chargement et deux minuteries d'inactivité. Le seul
// AuthProvider est désormais celui d'App.tsx, placé à l'intérieur du
// BrowserRouter.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)