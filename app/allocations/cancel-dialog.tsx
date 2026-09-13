'use client'

import { useRef } from 'react'
import { cancelAllocation } from './actions'

// ยกเลิกการจัดสรร (admin) — ต้องกรอกเหตุผลก่อนยืนยัน
// เหตุผลถูกบันทึกใน allocations.cancel_reason และแสดงในหน้าประวัติ
export function CancelAllocationButton({
  id,
  labels,
}: {
  id: string
  labels: {
    button: string
    title: string
    message: string
    reasonLabel: string
    reasonPlaceholder: string
    back: string
    submit: string
  }
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        title={labels.button}
        aria-label={labels.button}
        onClick={() => dialogRef.current?.showModal()}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-md whitespace-normal rounded-lg border border-slate-200 p-0 text-left shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <form action={cancelAllocation} className="p-6">
          <input type="hidden" name="id" value={id} />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{labels.message}</p>

          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {labels.reasonLabel}
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={300}
              rows={3}
              placeholder={labels.reasonPlaceholder}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {labels.back}
            </button>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {labels.submit}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
