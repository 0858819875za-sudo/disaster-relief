// =====================================================================
// Web Component ที่เลือกสำหรับ F5 (docs/Week10_Topic8_Analysis.md ข้อ 9):
// Modal Dialog ยืนยันการตัดจ่าย — เพราะการจัดสรรกระทบยอดคงเหลือจริงและ
// ย้อนกลับยาก (ต้องให้ admin ยกเลิกเองทีหลัง) การบังคับให้เห็นสรุปก่อนกด
// ยืนยันจึงลดความเสี่ยงกดพลาดตอนเจ้าหน้าที่ทำงานเร่งรีบ
//
// ใช้ <dialog> ของ HTML ล้วนๆ (ไม่ใช้ library) — ได้ focus trap +
// ปิดด้วย Esc + backdrop ฟรีจากเบราว์เซอร์
//
// จับคู่อัตโนมัติ: พอเลือกคำขอ ระบบแสดงทุกล็อตที่ใช้ได้ (หมวดหมู่ตรง,
// staff เห็นเฉพาะศูนย์เดียวกับคำขอ, ล็อตหมดอายุถูกตัดตั้งแต่ page.tsx)
// เรียงใกล้หมดอายุก่อน (FEFO) แล้วเติมจำนวนให้ไล่จากล็อตแรกจนครบที่ขาด
// เจ้าหน้าที่แก้ตัวเลขได้ และจัดสรรหลายล็อตได้ในครั้งเดียว
// กฎจริงยังบังคับซ้ำใน allocate_items_multi / allocate_items อีกชั้น
// =====================================================================

'use client'

import { useRef, useState } from 'react'
import { allocate } from './actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Req = {
  id: string
  center_id: string
  item_name: string
  category: string
  quantity_requested: number
  quantity_fulfilled: number
  centers: { name?: string } | null
}
type Don = {
  id: string
  center_id: string
  item_name: string
  category: string
  unit: string
  quantity_remaining: number
  expiry_date: string | null
  centers: { name?: string } | null
}

const DAY_MS = 1000 * 60 * 60 * 24

// อยู่นอก component เพราะอ่านเวลาปัจจุบัน — เรียกเฉพาะใน event handler
function daysUntil(dateStr: string) {
  return (new Date(dateStr).getTime() - Date.now()) / DAY_MS
}

function lotsForRequest(request: Req | undefined, donations: Don[], isAdmin: boolean) {
  if (!request) return []
  return donations.filter(
    (d) => d.category === request.category && (isAdmin || d.center_id === request.center_id),
  )
}

// เติมจำนวนแบบ FEFO: ไล่จากล็อตที่ใกล้หมดอายุที่สุดจนครบจำนวนที่คำขอยังขาด
function fefoPlan(request: Req, lots: Don[]) {
  let needed = request.quantity_requested - request.quantity_fulfilled
  const plan: Record<string, string> = {}
  for (const lot of lots) {
    const take = Math.max(0, Math.min(lot.quantity_remaining, needed))
    plan[lot.id] = take > 0 ? String(take) : ''
    needed -= take
  }
  return plan
}

export function AllocateForm({
  requests,
  donations,
  dict,
  isAdmin,
}: {
  requests: Req[]
  donations: Don[]
  dict: Dictionary
  isAdmin: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmedRef = useRef(false)

  const CATEGORY_LABEL: Record<string, string> = {
    food: dict.form.categoryFood,
    water: dict.form.categoryWater,
    medicine: dict.form.categoryMedicine,
    clothing: dict.form.categoryClothing,
    hygiene: dict.form.categoryHygiene,
    other: dict.form.categoryOther,
  }

  const [requestId, setRequestId] = useState('')
  const [qtyByLot, setQtyByLot] = useState<Record<string, string>>({})
  const [nearExpiry, setNearExpiry] = useState(false)

  const selectedRequest = requests.find((r) => r.id === requestId)
  const lots = lotsForRequest(selectedRequest, donations, isAdmin)
  const requestRemaining = selectedRequest
    ? selectedRequest.quantity_requested - selectedRequest.quantity_fulfilled
    : 0

  const entries = lots.map((lot) => {
    const raw = qtyByLot[lot.id] ?? ''
    return { lot, raw, qty: raw === '' ? 0 : Number(raw) }
  })
  const chosen = entries.filter((e) => e.qty !== 0)
  const total = chosen.reduce((sum, e) => sum + e.qty, 0)

  const problem = !selectedRequest
    ? null
    : chosen.some((e) => !Number.isInteger(e.qty) || e.qty < 0)
      ? dict.allocations.invalidQty
      : chosen.length === 0
        ? dict.allocations.noLotSelected
        : chosen.some((e) => e.qty > e.lot.quantity_remaining)
          ? dict.allocations.overRemaining
          : total > requestRemaining
            ? dict.allocations.overRequested
            : null

  const itemsJson = JSON.stringify(
    chosen.map((e) => ({ donation_id: e.lot.id, quantity: e.qty })),
  )

  function selectRequest(id: string) {
    setRequestId(id)
    const request = requests.find((r) => r.id === id)
    setQtyByLot(request ? fefoPlan(request, lotsForRequest(request, donations, isAdmin)) : {})
  }

  function handleSubmit(e: React.FormEvent) {
    if (confirmedRef.current) return // ผ่านมาจากปุ่ม "ยืนยัน" ในโมดัลแล้ว ปล่อยให้ submit จริง
    e.preventDefault()
    if (!selectedRequest) return
    setNearExpiry(
      chosen.some((c) => {
        if (!c.lot.expiry_date) return false
        const days = daysUntil(c.lot.expiry_date)
        return days >= -1 && days <= 7
      }),
    )
    dialogRef.current?.showModal()
  }

  function handleConfirm() {
    if (problem) return
    confirmedRef.current = true
    dialogRef.current?.close()
    formRef.current?.requestSubmit()
  }

  return (
    <>
      {!isAdmin && (
        <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {dict.allocations.crossCenterNote}
        </p>
      )}

      <form
        ref={formRef}
        action={allocate}
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <input type="hidden" name="items" value={itemsJson} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.allocations.selectRequest}</label>
          <select
            name="request_id"
            required
            value={requestId}
            onChange={(e) => selectRequest(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{dict.allocations.selectRequestPlaceholder}</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.centers?.name} — {r.item_name} ({CATEGORY_LABEL[r.category] ?? r.category})
                {dict.allocations.remainingWord} {r.quantity_requested - r.quantity_fulfilled}
              </option>
            ))}
          </select>
        </div>

        {selectedRequest && (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">{dict.allocations.lotsForRequest}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{dict.allocations.autoFillNote}</p>
            </div>

            {lots.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                {dict.allocations.noMatchingLots}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[560px] whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">{dict.allocations.lotColumn}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.remainingInLot}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.expiresOn}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.quantityToAllocate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(({ lot, raw }) => (
                      <tr key={lot.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                          {lot.centers?.name} — {lot.item_name}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                          {lot.quantity_remaining} {lot.unit}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{lot.expiry_date ?? '—'}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            max={lot.quantity_remaining}
                            value={raw}
                            onChange={(e) => setQtyByLot((current) => ({ ...current, [lot.id]: e.target.value }))}
                            aria-label={`${dict.allocations.quantityToAllocate} — ${lot.centers?.name ?? ''} ${lot.item_name}`}
                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className={`mt-2 text-sm ${problem ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {dict.allocations.totalToAllocate} {total} / {dict.allocations.stillNeeded} {requestRemaining}
              {problem ? ` — ${problem}` : ''}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedRequest || lots.length === 0}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dict.allocations.confirmAllocate}
        </button>
      </form>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dict.allocations.modalTitle}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dict.allocations.modalSubtitle}</p>

          <dl className="mt-4 space-y-2 rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.item}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.item_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.toCenter}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.centers?.name ?? '—'}</dd>
            </div>
            {chosen.map(({ lot, qty }) => (
              <div key={lot.id} className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
                <dt className="text-slate-500 dark:text-slate-400">
                  {dict.allocations.fromLotOfCenter} {lot.centers?.name ?? '—'}
                </dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {qty} {lot.unit}
                  <span
                    className={`block text-xs font-normal ${
                      lot.quantity_remaining - qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {dict.allocations.remainingAfter} {lot.quantity_remaining - qty}
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.totalToAllocate}</dt>
              <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">
                {total} / {requestRemaining}
              </dd>
            </div>
          </dl>

          {nearExpiry && !problem && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {dict.allocations.nearExpiryWarning}
            </p>
          )}

          {problem && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {problem}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dict.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!!problem}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dict.allocations.confirmAllocate}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
