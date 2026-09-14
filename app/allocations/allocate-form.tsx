// =====================================================================
// Web Component ที่เลือกสำหรับ F5 (docs/Week10_Topic8_Analysis.md ข้อ 9):
// Modal Dialog ยืนยันการตัดจ่าย — เพราะการจัดสรรกระทบยอดคงเหลือจริงและ
// ย้อนกลับยาก (ต้องให้ admin ยกเลิกเองทีหลัง) การบังคับให้เห็นสรุปก่อนกด
// ยืนยันจึงลดความเสี่ยงกดพลาดตอนเจ้าหน้าที่ทำงานเร่งรีบ
//
// ใช้ <dialog> ของ HTML ล้วนๆ (ไม่ใช้ library) — ได้ focus trap +
// ปิดด้วย Esc + backdrop ฟรีจากเบราว์เซอร์
//
// จับคู่อัตโนมัติ: พอเลือกคำขอ ระบบแยกล็อตเป็น 2 กลุ่ม
//   - ล็อตที่ "ชื่อของตรงกับคำขอ" (lib/item-match.ts) เรียงใกล้หมดอายุก่อน (FEFO)
//     และเติมจำนวนให้ไล่จากล็อตแรกจนครบที่ขาด — เติมเฉพาะล็อตที่ชื่อตรงเป๊ะ
//     (หลังตัดขนาด) ก่อน ถ้าไม่มีเลยจึงเติมจากล็อตที่ชื่อคล้าย เช่น "ข้าวสาร" ↔ "ข้าวสารหอมมะลิ"
//   - ล็อตอื่นในหมวดเดียวกัน (ของทดแทน) ซ่อนไว้ ถ้าจะใช้ต้องติ๊กยืนยันใน Modal
// หมวดหมู่ / ศูนย์ (staff) / วันหมดอายุ / ยอดคงเหลือ ยังบังคับซ้ำใน
// allocate_items_multi → allocate_items อีกชั้น
// =====================================================================

'use client'

import { useRef, useState } from 'react'
import { allocate } from './actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { itemCore, itemsMatch } from '@/lib/item-match'
import { unitLabel } from '@/lib/units'

type Req = {
  id: string
  center_id: string
  item_name: string
  category: string
  unit: string | null
  quantity_requested: number
  quantity_fulfilled: number
  centers: { name?: string } | null
  ready: boolean
}
type Don = {
  id: string
  center_id: string
  item_name: string
  category: string
  unit: string
  quantity_remaining: number
  expiry_date: string | null
  received_at: string
  centers: { name?: string } | null
}

const DAY_MS = 1000 * 60 * 60 * 24

// อยู่นอก component เพราะอ่านเวลาปัจจุบัน — เรียกเฉพาะใน event handler
function daysUntil(dateStr: string) {
  return (new Date(dateStr).getTime() - Date.now()) / DAY_MS
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
  locale,
}: {
  requests: Req[]
  donations: Don[]
  dict: Dictionary
  isAdmin: boolean
  locale: string
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
  // เก็บเฉพาะตัวเลขที่ผู้ใช้แก้เอง (ผูกกับคำขอ) — ถ้ายังไม่แก้ ใช้แผน FEFO ที่คำนวณสดทุกครั้ง
  // จึงไม่พึ่ง onChange ของ select (กันกรณีเบราว์เซอร์คืนค่าฟอร์มเองแล้วช่องจำนวนว่าง)
  const [edits, setEdits] = useState<{ requestId: string; qty: Record<string, string> } | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [substituteOk, setSubstituteOk] = useState(false)
  const [nearExpiry, setNearExpiry] = useState(false)

  const selectedRequest = requests.find((r) => r.id === requestId)
  const sameCategoryLots = selectedRequest
    ? donations.filter(
        (d) =>
          d.category === selectedRequest.category &&
          (isAdmin || d.center_id === selectedRequest.center_id),
      )
    : []
  // คำขอที่ระบุหน่วย: allocate_items ปฏิเสธล็อตหน่วยอื่น จึงไม่แสดงให้เลือกตั้งแต่แรก
  const requestUnit = selectedRequest?.unit?.trim() ?? ''
  const categoryLots = requestUnit
    ? sameCategoryLots.filter((d) => d.unit.trim() === requestUnit)
    : sameCategoryLots
  const hiddenByUnit = sameCategoryLots.length - categoryLots.length
  const matchedLots = selectedRequest
    ? categoryLots.filter((d) => itemsMatch(selectedRequest.item_name, d.item_name))
    : []
  const matchedIds = new Set(matchedLots.map((d) => d.id))
  const otherLots = categoryLots.filter((d) => !matchedIds.has(d.id))

  const requestRemaining = selectedRequest
    ? selectedRequest.quantity_requested - selectedRequest.quantity_fulfilled
    : 0
  // ชื่อคล้ายแต่ไม่ใช่ของเดียวกัน (เช่น "น้ำดื่ม 600ml" กับ "น้ำดื่มสำหรับเด็ก") ยังแสดงให้เลือก
  // แต่ไม่เติมจำนวนให้เอง ถ้ามีล็อตที่ชื่อตรงเป๊ะอยู่แล้ว
  const exactLots = selectedRequest
    ? matchedLots.filter((d) => itemCore(d.item_name) === itemCore(selectedRequest.item_name))
    : []
  const plan = selectedRequest
    ? fefoPlan(selectedRequest, exactLots.length > 0 ? exactLots : matchedLots)
    : {}
  const qtyByLot = edits && edits.requestId === requestId ? edits.qty : plan

  const entries = [...matchedLots, ...otherLots].map((lot) => {
    const raw = qtyByLot[lot.id] ?? ''
    return { lot, raw, qty: raw === '' ? 0 : Number(raw), matched: matchedIds.has(lot.id) }
  })
  const chosen = entries.filter((e) => e.qty !== 0)
  const total = chosen.reduce((sum, e) => sum + e.qty, 0)
  const usesSubstitute = chosen.some((e) => !e.matched)
  const mixedUnits = new Set(chosen.map((e) => e.lot.unit.trim())).size > 1
  const othersVisible = showOthers || entries.some((e) => !e.matched && e.raw !== '')

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
  const canConfirm = !problem && (!usesSubstitute || substituteOk)

  const itemsJson = JSON.stringify(
    chosen.map((e) => ({ donation_id: e.lot.id, quantity: e.qty })),
  )

  function selectRequest(id: string) {
    setRequestId(id)
    setEdits(null)
    setShowOthers(false)
    setSubstituteOk(false)
  }

  function setQty(lotId: string, value: string) {
    setEdits({ requestId, qty: { ...qtyByLot, [lotId]: value } })
    setSubstituteOk(false)
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
    if (!canConfirm) return
    confirmedRef.current = true
    dialogRef.current?.close()
    // requestSubmit ยิง submit event แบบ synchronous — handleSubmit เห็นค่า true ไปแล้ว
    // จึงรีเซ็ตทันที ไม่งั้นถ้า action ตอบ error กลับมาหน้าเดิม รอบถัดไปจะข้าม Modal
    formRef.current?.requestSubmit()
    confirmedRef.current = false
  }

  const dateLocale = locale === 'th' ? 'th-TH' : 'en-GB'
  const receivedLabel = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale, { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })

  function lotRow({ lot, raw, matched }: (typeof entries)[number]) {
    return (
      <tr key={lot.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
        <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
          <span className="block">
            {lot.item_name}
            {!matched && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                {dict.allocations.substituteBadge}
              </span>
            )}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {lot.centers?.name} · {dict.allocations.receivedOn} {receivedLabel(lot.received_at)}
          </span>
        </td>
        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
          {lot.quantity_remaining} {unitLabel(lot.unit, locale)}
        </td>
        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{lot.expiry_date ?? '—'}</td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={lot.quantity_remaining}
              value={raw}
              onChange={(e) => setQty(lot.id, e.target.value)}
              aria-label={`${dict.allocations.quantityToAllocate} — ${lot.item_name} (${lot.centers?.name ?? ''})`}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">{unitLabel(lot.unit, locale)}</span>
          </div>
        </td>
      </tr>
    )
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
          <label htmlFor="allocate-request" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {dict.allocations.selectRequest}
          </label>
          <select
            id="allocate-request"
            name="request_id"
            required
            autoComplete="off"
            value={requestId}
            onChange={(e) => selectRequest(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{dict.allocations.selectRequestPlaceholder}</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.centers?.name} — {r.item_name} ({CATEGORY_LABEL[r.category] ?? r.category}) · {dict.allocations.remainingWord}{' '}
                {r.quantity_requested - r.quantity_fulfilled}
                {r.unit ? ` ${r.unit}` : ''} · {r.ready ? dict.allocations.readyStock : dict.allocations.noStock}
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

            {matchedLots.length === 0 && (
              <p className="mb-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {dict.allocations.noMatchingItemLots}
              </p>
            )}

            {(matchedLots.length > 0 || othersVisible) && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">{dict.allocations.lotColumn}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.remainingHeader}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.expiryHeader}</th>
                      <th className="px-4 py-2 font-medium">{dict.allocations.quantityToAllocate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.filter((e) => e.matched).map(lotRow)}
                    {othersVisible && otherLots.length > 0 && (
                      <tr className="bg-amber-50/60 dark:bg-amber-500/5">
                        <td colSpan={4} className="whitespace-normal px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
                          {dict.allocations.otherLotsWarning}
                        </td>
                      </tr>
                    )}
                    {othersVisible && entries.filter((e) => !e.matched).map(lotRow)}
                  </tbody>
                </table>
              </div>
            )}

            {otherLots.length > 0 && !othersVisible && (
              <button
                type="button"
                onClick={() => setShowOthers(true)}
                className="mt-2 text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {dict.allocations.showOtherLots} ({otherLots.length})
              </button>
            )}

            <p className={`mt-2 text-sm ${problem ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {dict.allocations.totalToAllocate} {total} / {dict.allocations.stillNeeded} {requestRemaining}
              {problem ? ` — ${problem}` : ''}
            </p>
            {mixedUnits && !problem && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{dict.allocations.mixedUnitsWarning}</p>
            )}
            {hiddenByUnit > 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {dict.allocations.unitFilteredNote.replace('{n}', String(hiddenByUnit))}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedRequest || categoryLots.length === 0}
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
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.requestedItem}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.item_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.toCenter}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.centers?.name ?? '—'}</dd>
            </div>
            {chosen.map(({ lot, qty, matched }) => (
              <div key={lot.id} className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
                <dt className="text-slate-500 dark:text-slate-400">
                  {lot.item_name}
                  {!matched && <span className="text-amber-700 dark:text-amber-400"> ({dict.allocations.substituteBadge})</span>}
                  <span className="block text-xs">{lot.centers?.name ?? '—'}</span>
                </dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {qty} {unitLabel(lot.unit, locale)}
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
                {selectedRequest?.unit ? ` ${selectedRequest.unit}` : ''}
              </dd>
            </div>
          </dl>

          {nearExpiry && !problem && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {dict.allocations.nearExpiryWarning}
            </p>
          )}

          {mixedUnits && !problem && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {dict.allocations.mixedUnitsWarning}
            </p>
          )}

          {usesSubstitute && !problem && (
            <label className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <input
                type="checkbox"
                checked={substituteOk}
                onChange={(e) => setSubstituteOk(e.target.checked)}
                className="mt-0.5"
              />
              {dict.allocations.substituteConfirm}
            </label>
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
              disabled={!canConfirm}
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
