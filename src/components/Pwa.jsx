import { useState, useEffect } from 'react'
import { Icon } from './ui'

// Botão "Instalar app" — aparece quando o navegador permite instalação (PWA)
export function InstallButton({ compact }) {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    const instalado = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', instalado)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', instalado)
    }
  }, [])

  if (!prompt) return null

  const instalar = async () => {
    prompt.prompt()
    try {
      await prompt.userChoice
    } catch (_) {}
    setPrompt(null)
  }

  return (
    <button
      onClick={instalar}
      title="Instalar o ClawMarket no aparelho"
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-cream/25 bg-cream/10 px-2 py-2 text-sm font-medium text-cream transition hover:bg-cream/20"
    >
      <Icon name="Download" size={16} />
      {!compact && 'Instalar app'}
    </button>
  )
}

// Selo "offline" no cabeçalho quando sem conexão
export function OfflineBadge() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (online) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium text-[#a9740d]">
      <Icon name="WifiOff" size={13} /> offline
    </span>
  )
}
