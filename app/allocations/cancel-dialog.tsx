'use client'

import { useId, useRef, useState } from 'react'
import { cancelAllocation } from './actions'
import { SubmitButton } from '../submit-button'

// ยกเลิกการจัดสรร (admin หรือ staff ผู้จัดสรรเองภายใน 30 นาที) — ต้องกรอกเหตุผลก่อนยืนยัน
// เหตุผลถูกบันทึกใน allocations.cancel_reason และแสดงในหน้าประวัติ
// ตรวจความยาวเหตุผลเองเป็นภาษาของเว็บ (noValidate) cancel_allocation บังคับซ้ำอีกชั้น
export function CancelAllocationButton({
  id,
  labels,
  triggerClassName,
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
    reasonTooShort: string
    saving: string
  }
  triggerClassName?: string
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (reason.trim().length < 3) {
      event.preventDefault()
      setError(labels.reasonTooShort)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReason('')
          setError('')
          dialogRef.current?.showModal()
        }}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
        }
      >
        {labels.button}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md whitespace-normal rounded-lg border border-slate-200 p-0 text-left shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <form action={cancelAllocation} onSubmit={handleSubmit} noValidate className="p-6">
          <input type="hidden" name="id" value={id} />
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{labels.message}</p>

          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {labels.reasonLabel}
            <textarea
              name="reason"
              maxLength={300}
              rows={3}
              value={reason}
              aria-invalid={!!error}
              onChange={(e) => {
                setReason(e.target.value)
                setError('')
              }}
              placeholder={labels.reasonPlaceholder}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal dark:bg-slate-800 dark:text-slate-100 ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {labels.back}
            </button>
            <SubmitButton
              pendingLabel={labels.saving}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              {labels.submit}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  )
}
