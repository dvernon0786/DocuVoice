import React from 'react'

export default function ChatPage({ apiKey }: { apiKey: string | null }) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Chat</h2>
      <p className="text-sm text-slate-400">Chat API key: {apiKey ? 'loaded' : 'not set'}</p>
    </div>
  )
}
