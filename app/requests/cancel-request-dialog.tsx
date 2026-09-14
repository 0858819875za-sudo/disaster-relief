'use client'

import { useRef } from 'react'
import { cancelRequest } from './actions'

// ยกเลิกคำขอ — ต้องกรอกเหตุผล รายการจัดสรรที่ยังไม่ส่งมอบถูกยกเลิกและคืนยอดให้อัตโนมัติ
// (cancel_request ใน docs/sql/23_f5_improvements.sql)
export function CancelRequestButton({
  id,
  itemName,
  labels,
}: {
  id: string
  itemName: string
  labels: {
    button: string
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
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-medium text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        {labels.button}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`cancel-request-title-${id}`}
        className="m-auto w-full max-w-md whitespace-normal rounded-lg border border-slate-200 p-0 text-left shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <form action={cancelRequest} className="p-6">
          <input type="hidden" name="id" value={id} />
          <h2 id={`cancel-request-title-${id}`} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {labels.button}: {itemName}
          </h2>
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
