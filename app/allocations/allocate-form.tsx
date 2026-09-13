// =====================================================================
// Web Component ที่เลือกสำหรับ F5 (docs/Week10_Topic8_Analysis.md ข้อ 9):
// Modal Dialog ยืนยันการตัดจ่าย — เพราะการจัดสรรกระทบยอดคงเหลือจริงและ
// ย้อนกลับยาก (ต้องให้ admin ยกเลิกเองทีหลัง) การบังคับให้เห็นสรุปก่อนกด
// ยืนยันจึงลดความเสี่ยงกดพลาดตอนเจ้าหน้าที่ทำงานเร่งรีบ
//
// ใช้ <dialog> ของ HTML ล้วนๆ (ไม่ใช้ library) — ได้ focus trap +
// ปิดด้วย Esc + backdrop ฟรีจากเบราว์เซอร์
//
// ตัวเลือกล็อตกรองให้เหลือเฉพาะที่ใช้ได้กับคำขอที่เลือก (หมวดหมู่ตรง,
// staff เห็นเฉพาะศูนย์เดียวกับคำขอ) และหน้า page.tsx ตัดล็อตที่หมดอายุ
// ออกแล้ว — กฎจริงยังบังคับซ้ำใน allocate_items อีกชั้น
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
  const [donationId, setDonationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [nearExpiry, setNearExpiry] = useState(false)

  const selectedRequest = requests.find((r) => r.id === requestId)
  // ล็อตที่ใช้ได้: หมวดหมู่ตรงกับคำขอ และถ้าไม่ใช่ admin ต้องอยู่ศูนย์เดียวกับคำขอ
  const lotOptions = selectedRequest
    ? donations.filter(
        (d) =>
          d.category === selectedRequest.category &&
          (isAdmin || d.center_id === selectedRequest.center_id),
      )
    : []
  const selectedDonation = lotOptions.find((d) => d.id === donationId)
  const qty = Number(quantity) || 0
  const requestRemaining = selectedRequest
    ? selectedRequest.quantity_requested - selectedRequest.quantity_fulfilled
    : 0
  const remainingAfter = selectedDonation ? selectedDonation.quantity_remaining - qty : null

  const problem =
    !selectedRequest || !selectedDonation
      ? null
      : qty <= 0
        ? dict.allocations.invalidQty
        : qty > selectedDonation.quantity_remaining
          ? dict.allocations.overRemaining
          : qty > requestRemaining
            ? dict.allocations.overRequested
            : null

  function handleSubmit(e: React.FormEvent) {
    if (confirmedRef.current) return // ผ่านมาจากปุ่ม "ยืนยัน" ในโมดัลแล้ว ปล่อยให้ submit จริง
    e.preventDefault()
    if (!selectedRequest || !selectedDonation) return
    const daysLeft = selectedDonation.expiry_date ? daysUntil(selectedDonation.expiry_date) : null
    setNearExpiry(daysLeft !== null && daysLeft >= -1 && daysLeft <= 7)
    dialogRef.current?.showModal()
  }

  function handleConfirm() {
    if (problem) return
    confirmedRef.current = true
    dialogRef.current?.close()
    formRef.current?.requestSubmit()
  }

  const lotPlaceholder = !selectedRequest
    ? dict.allocations.selectRequestFirst
    : lotOptions.length === 0
      ? dict.allocations.noMatchingLots
      : dict.allocations.selectLotPlaceholder

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
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.allocations.selectRequest}</label>
          <select
            name="request_id"
            required
            value={requestId}
            onChange={(e) => {
              setRequestId(e.target.value)
              setDonationId('')
            }}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.allocations.selectLot}</label>
          <select
            name="donation_id"
            required
            disabled={!selectedRequest || lotOptions.length === 0}
            value={donationId}
            onChange={(e) => setDonationId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{lotPlaceholder}</option>
            {lotOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.centers?.name} — {d.item_name} {dict.allocations.remainingInLot} {d.quantity_remaining} {d.unit}
                {d.expiry_date ? ` (${dict.allocations.expiresOn} ${d.expiry_date})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.allocations.quantityToAllocate}</label>
          <input
            name="quantity"
            type="number"
            min={1}
            max={selectedDonation ? Math.min(selectedDonation.quantity_remaining, requestRemaining) : undefined}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep sm:col-span-3"
        >
          {dict.allocations.confirmAllocate}
        </button>
      </form>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-md rounded-lg border border-slate-200 p-0 shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dict.allocations.modalTitle}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dict.allocations.modalSubtitle}
          </p>

          <dl className="mt-4 space-y-2 rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.item}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {selectedRequest?.item_name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.quantityToAllocate}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {qty} {selectedDonation?.unit}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.fromLotOfCenter}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {selectedDonation?.centers?.name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.toCenter}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {selectedRequest?.centers?.name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{dict.allocations.remainingAfter}</dt>
              <dd
                className={`text-right font-medium ${
                  remainingAfter !== null && remainingAfter < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {remainingAfter ?? '—'} {selectedDonation?.unit}
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
