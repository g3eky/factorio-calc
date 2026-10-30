import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../theme/global.css'
import { App } from './App.tsx'
import { UpdateNotice } from './updates.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateNotice />
  </StrictMode>,
)
