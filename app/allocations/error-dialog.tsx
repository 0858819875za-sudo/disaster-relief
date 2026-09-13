'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ป๊อปอัปแจ้ง error — เปิดเองเมื่อหน้าโหลดพร้อม ?error=...
// ปิดแล้วพากลับ clearHref (ล้าง query) กันเด้งซ้ำตอนรีเฟรช
export function ErrorDialog({
  title,
  message,
  closeLabel,
  clearHref,
}: {
  title: string
  message: string
  closeLabel: string
  clearHref: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="error-dialog-title"
      onClose={() => router.replace(clearHref, { scroll: false })}
      className="m-auto w-full max-w-md rounded-lg border border-slate-200 p-0 shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <div>
            <h2 id="error-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
