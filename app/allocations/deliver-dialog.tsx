'use client'

import { useId, useRef, useState } from 'react'
import { SubmitButton } from '../submit-button'

export type DeliverLabels = {
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
  receivedFull: string
  receivedPartial: string
  receivedInvalid: string
  noteTooShort: string
  saving: string
}

// ยืนยันรับของ — กรณีปกติกด "ได้รับครบ" ปุ่มเดียวจบ
// ถ้าไม่ครบ กด "ได้รับไม่ครบ" แล้วกรอกจำนวนจริง + หมายเหตุ ส่วนที่ขาดกลับไปเป็นยอดที่คำขอยังต้องการ
// ตรวจค่าเองเป็นภาษาของเว็บก่อนส่ง (noValidate) และ mark_delivered
// (docs/sql/23_f5_improvements.sql) บังคับกฎเดียวกันอีกชั้น
// ใช้ร่วมกันทั้งหน้าประวัติ หน้ารายละเอียด และหน้าอาสาสมัคร (ส่ง server action มาเป็น prop)
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
  variant: 'compact' | 'button'
  labels: DeliverLabels
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [partial, setPartial] = useState(false)
  const [received, setReceived] = useState(String(allocated))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const receivedNumber = Number(received)
  const validReceived =
    received.trim() !== '' && Number.isInteger(receivedNumber) && receivedNumber >= 0 && receivedNumber <= allocated
  const short = validReceived && receivedNumber < allocated

  function open() {
    setPartial(false)
    setReceived(String(allocated))
    setNote('')
    setError('')
    dialogRef.current?.showModal()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!partial) return
    const message = !validReceived
      ? labels.receivedInvalid.replace('{max}', String(allocated))
      : short && note.trim().length < 3
        ? labels.noteTooShort
        : ''
    if (message) {
      event.preventDefault()
      setError(message)
    }
  }

  const secondary =
    'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
  const primary =
    'rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:cursor-wait disabled:opacity-60'

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          aria-label={`${labels.button}: ${itemName}`}
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
        >
          <span aria-hidden="true">✓</span>
          {labels.button}
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
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md whitespace-normal rounded-lg border border-slate-200 p-0 text-left shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <form action={action} onSubmit={handleSubmit} noValidate className="p-6 text-slate-900 dark:text-slate-100">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="allocated" value={allocated} />
          <input type="hidden" name="unit" value={unit} />
          <h2 id={titleId} className="text-lg font-semibold">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{labels.message}</p>

          <dl className="mt-4 flex justify-between gap-4 rounded-md bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800">
            <dt className="text-slate-500 dark:text-slate-400">{itemName}</dt>
            <dd className="text-right font-medium">
              {labels.allocated} {allocated} {unit}
            </dd>
          </dl>

          {!partial ? (
            <>
              <input type="hidden" name="received" value={allocated} />
              <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                <SubmitButton pendingLabel={labels.saving} className={`${primary} sm:flex-1`}>
                  ✓ {labels.receivedFull.replace('{qty}', String(allocated)).replace('{unit}', unit)}
                </SubmitButton>
                <button type="button" onClick={() => setPartial(true)} className={`${secondary} sm:flex-1`}>
                  {labels.receivedPartial}
                </button>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="mt-3 w-full text-center text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {labels.back}
              </button>
            </>
          ) : (
            <>
              <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {labels.received}
                <span className="mt-1 flex items-center gap-2">
                  <input
                    name="received"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={allocated}
                    step={1}
                    autoFocus
                    value={received}
                    aria-invalid={!validReceived}
                    onChange={(e) => {
                      setReceived(e.target.value)
                      setError('')
                    }}
                    className={`w-28 rounded-md border px-3 py-2 text-sm font-normal dark:bg-slate-800 dark:text-slate-100 ${validReceived ? 'border-slate-300 dark:border-slate-600' : 'border-red-500'}`}
                  />
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{unit}</span>
                </span>
              </label>

              <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {labels.note}
                <textarea
                  name="note"
                  maxLength={300}
                  rows={2}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    setError('')
                  }}
                  placeholder={labels.notePlaceholder}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              {short && !error && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  {labels.noteRequired}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => dialogRef.current?.close()} className={secondary}>
                  {labels.back}
                </button>
                <SubmitButton pendingLabel={labels.saving} className={primary}>
                  {labels.submit}
                </SubmitButton>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  )
}
