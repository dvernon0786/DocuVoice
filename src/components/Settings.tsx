import React from 'react'

export default function Settings({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-modal p-4 bg-white rounded shadow">
      <h3 className="font-semibold">Settings</h3>
      <p className="text-sm text-slate-500">Settings placeholder.</p>
      <button className="mt-3 px-3 py-1 bg-gray-600 text-white rounded" onClick={onClose}>Close</button>
    </div>
  )
}
