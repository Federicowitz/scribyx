import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installWritexAgentApi } from './agentApi.ts'
import { CloudPage } from './components/CloudPage.tsx'

installWritexAgentApi()

const routeParams = new URLSearchParams(window.location.search)
const isCloudRoute =
  routeParams.get('cloud') === '1' ||
  window.location.hash === '#cloud' ||
  window.location.pathname.endsWith('/cloud') ||
  window.location.pathname.endsWith('/cloud/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCloudRoute ? <CloudPage /> : <App />}
  </StrictMode>,
)
