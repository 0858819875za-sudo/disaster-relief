'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export type AllocationSummary = {
  itemName: string
  toCenter: string
  requestFulfilled: number
  requestRequested: number
  requestStatusLabel: string
  lots: { fromCenter: string; quantity: number; unit: string; lotRemaining: number }[]
}

// ป๊อปอัปแจ้งผลหลังจัดสรรสำเร็จ — เปิดเองเมื่อหน้าโหลดพร้อม ?done=<ids>
// ปิดแล้วล้าง query ออกจาก URL กันเปิดซ้ำตอนรีเฟรช
export function SuccessDialog({ summary, dict }: { summary: AllocationSummary; dict: Dictionary }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const total = summary.lots.reduce((sum, lot) => sum + lot.quantity, 0)

  return (
    <dialog
      ref={dialogRef}
      onClose={() => router.replace('/allocations', { scroll: false })}
      className="m-auto w-full max-w-md rounded-lg border border-slate-200 p-0 shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dict.allocations.successTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.allocations.successSubtitle}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.item}</dt>
            <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{summary.itemName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.toCenter}</dt>
            <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{summary.toCenter}</dd>
          </div>
          {summary.lots.map((lot, index) => (
            <div key={index} className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">
                {dict.allocations.fromLotOfCenter} {lot.fromCenter}
              </dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {lot.quantity} {lot.unit}
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  {dict.allocations.lotRemainingNow} {lot.lotRemaining} {lot.unit}
                </span>
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
            <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.totalToAllocate}</dt>
            <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">{total}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.requestProgress}</dt>
            <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
              {summary.requestFulfilled} / {summary.requestRequested} ({summary.requestStatusLabel})
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/allocations/history"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {dict.allocations.viewHistoryShort}
          </Link>
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
          >
            {dict.allocations.allocateAnother}
          </button>
        </div>
      </div>
    </dialog>
  )
}
