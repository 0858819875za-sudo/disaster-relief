'use client'

import { useRef, useState } from 'react'

// ยืนยันรับของ — กรอกจำนวนที่ได้รับจริง (ค่าเริ่มต้น = จำนวนที่จัดสรร)
// ถ้าได้รับไม่ครบต้องมีหมายเหตุ ส่วนที่ขาดจะถูกเปิดกลับเป็นยอดที่คำขอยังต้องการ
// mark_delivered (docs/sql/23_f5_improvements.sql) บังคับกฎเดียวกันอีกชั้น
// ใช้ร่วมกันทั้งหน้าประวัติของ staff และหน้าอาสาสมัคร (ส่ง server action มาเป็น prop)
export function DeliverButton({
  id,
  itemName,
  allocated,
  unit,
  action,
  variant,
  labels,
}: {
  id: string
  itemName: string
  allocated: number
  unit: string
  action: (formData: FormData) => void | Promise<void>
  variant: 'icon' | 'button'
  labels: {
    button: string
    title: string
    message: string
    allocated: string
    received: string
    note: string
    notePlaceholder: string
    noteRequired: string
    back: string
    submit: string
  }
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [received, setReceived] = useState(String(allocated))
  const receivedNumber = Number(received)
  const short = received !== '' && Number.isInteger(receivedNumber) && receivedNumber < allocated

  function open() {
    setReceived(String(allocated))
    dialogRef.current?.showModal()
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          title={labels.button}
          aria-label={`${labels.button}: ${itemName}`}
          onClick={open}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          aria-label={`${labels.button}: ${itemName}`}
          onClick={open}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
        >
          <span aria-hidden="true">✓</span>
          {labels.button}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`deliver-title-${id}`}
        className="m-auto w-full max-w-md whitespace-normal rounded-lg border border-slate-200 p-0 text-left shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <form action={action} className="p-6 text-slate-900 dark:text-slate-100">
          <input type="hidden" name="id" value={id} />
          <h2 id={`deliver-title-${id}`} className="text-lg font-semibold">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{labels.message}</p>

          <dl className="mt-4 flex justify-between gap-4 rounded-md bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800">
            <dt className="text-slate-500 dark:text-slate-400">{itemName}</dt>
            <dd className="text-right font-medium">
              {labels.allocated} {allocated} {unit}
            </dd>
          </dl>

          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {labels.received}
            <span className="mt-1 flex items-center gap-2">
              <input
                name="received"
                type="number"
                required
                min={0}
                max={allocated}
                step={1}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{unit}</span>
            </span>
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {labels.note}
            <textarea
              name="note"
              required={short}
              minLength={short ? 3 : undefined}
              maxLength={300}
              rows={2}
              placeholder={labels.notePlaceholder}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          {short && (
            <p role="status" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {labels.noteRequired}
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
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
            >
              {labels.submit}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
