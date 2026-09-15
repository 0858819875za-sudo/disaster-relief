// =====================================================================
// Web Component ที่เลือกสำหรับ F5 (docs/Week10_Topic8_Analysis.md ข้อ 9):
// Modal Dialog ยืนยันการตัดจ่าย — เพราะการจัดสรรกระทบยอดคงเหลือจริงและ
// ย้อนกลับยาก การบังคับให้เห็นสรุปก่อนกดยืนยันจึงลดความเสี่ยงกดพลาดตอนเจ้าหน้าที่ทำงานเร่งรีบ
//
// ใช้ <dialog> ของ HTML ล้วนๆ (ไม่ใช้ library) — ได้ focus trap +
// ปิดด้วย Esc + backdrop ฟรีจากเบราว์เซอร์
//
// ขั้นตอนบนหน้าจอ:
//   ซ้าย: คำขอเป็นการ์ด ค้นหาได้ กรอง "มีของพร้อมจ่าย" / "ด่วน" ได้ มีแถบความคืบหน้า
//   ขวา: ล็อตที่ "ชื่อของตรงกับคำขอ" (lib/item-match.ts) เรียงใกล้หมดอายุก่อน (FEFO)
//        และเติมจำนวนให้ไล่จากล็อตแรกจนครบที่ขาด — เติมเฉพาะล็อตที่ชื่อตรงเป๊ะก่อน
//        ล็อตอื่นในหมวดเดียวกัน (ของทดแทน) ซ่อนไว้ ถ้าจะใช้ต้องติ๊กยืนยันใน Modal
// ข้อความผิดพลาดขึ้นหลังผู้ใช้เริ่มแก้ตัวเลขหรือกดยืนยันเท่านั้น (ไม่ดุตั้งแต่ยังไม่ทำอะไร)
// หมวดหมู่ / ศูนย์ (staff) / หน่วย / วันหมดอายุ / ยอดคงเหลือ ยังบังคับซ้ำใน
// allocate_items_multi → allocate_items อีกชั้น
// =====================================================================

'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { allocate } from './actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { itemCore, itemsMatch } from '@/lib/item-match'
import { unitLabel } from '@/lib/units'
import { formatDateOnly } from '@/lib/dates'
import { SubmitButton } from '../submit-button'

type Req = {
  id: string
  center_id: string
  item_name: string
  category: string
  unit: string | null
  urgency: string
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
  // คำนวณที่ server ตามวันที่เวลาไทย — null = ไม่มีวันหมดอายุ
  days_left: number | null
}

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
const secondaryBtn =
  'inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
const URGENCY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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
  initialRequestId,
}: {
  requests: Req[]
  donations: Don[]
  dict: Dictionary
  isAdmin: boolean
  locale: string
  initialRequestId: string
}) {
  const t = dict.allocations
  const formRef = useRef<HTMLFormElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const confirmedRef = useRef(false)

  const CATEGORY_LABEL: Record<string, string> = {
    food: dict.form.categoryFood,
    water: dict.form.categoryWater,
    medicine: dict.form.categoryMedicine,
    clothing: dict.form.categoryClothing,
    hygiene: dict.form.categoryHygiene,
    other: dict.form.categoryOther,
  }
  const URGENCY_LABEL: Record<string, string> = {
    high: dict.requests.urgencyHigh,
    medium: dict.requests.urgencyMedium,
    low: dict.requests.urgencyLow,
  }

  // เปิดจากปุ่ม "จัดสรร" ในหน้าคำขอ (?request=<id>) → เลือกคำขอนั้นไว้ให้เลย
  const [requestId, setRequestId] = useState(() =>
    requests.some((r) => r.id === initialRequestId) ? initialRequestId : '',
  )
  // เก็บเฉพาะตัวเลขที่ผู้ใช้แก้เอง (ผูกกับคำขอ) — ถ้ายังไม่แก้ ใช้แผน FEFO ที่คำนวณสดทุกครั้ง
  const [edits, setEdits] = useState<{ requestId: string; qty: Record<string, string> } | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [substituteOk, setSubstituteOk] = useState(false)
  const [touched, setTouched] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'ready' | 'urgent'>('all')

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
  const hasEdits = !!edits && edits.requestId === requestId
  const qtyByLot = hasEdits ? edits.qty : plan

  const entries = [...matchedLots, ...otherLots].map((lot) => {
    const raw = qtyByLot[lot.id] ?? ''
    return { lot, raw, qty: raw === '' ? 0 : Number(raw), matched: matchedIds.has(lot.id) }
  })
  const chosen = entries.filter((e) => e.qty !== 0)
  const total = chosen.reduce((sum, e) => sum + e.qty, 0)
  const usesSubstitute = chosen.some((e) => !e.matched)
  const mixedUnits = new Set(chosen.map((e) => e.lot.unit.trim())).size > 1
  const othersVisible = showOthers || entries.some((e) => !e.matched && e.raw !== '')
  const nearExpiry = chosen.some((c) => c.lot.days_left !== null && c.lot.days_left <= 7)

  const problem = !selectedRequest
    ? null
    : chosen.some((e) => !Number.isInteger(e.qty) || e.qty < 0)
      ? t.invalidQty
      : chosen.length === 0
        ? t.noLotSelected
        : chosen.some((e) => e.qty > e.lot.quantity_remaining)
          ? t.overRemaining
          : total > requestRemaining
            ? t.overRequested
            : null
  const canConfirm = !problem && (!usesSubstitute || substituteOk)

  const itemsJson = JSON.stringify(chosen.map((e) => ({ donation_id: e.lot.id, quantity: e.qty })))
  const unitText = selectedRequest?.unit ? ` ${unitLabel(selectedRequest.unit, locale)}` : ''

  const needle = query.trim().toLocaleLowerCase()
  const visibleRequests = requests.filter(
    (r) =>
      (!needle || `${r.centers?.name ?? ''} ${r.item_name}`.toLocaleLowerCase().includes(needle)) &&
      (filter === 'all' || (filter === 'ready' && r.ready) || (filter === 'urgent' && r.urgency === 'high')),
  )

  function selectRequest(id: string) {
    setRequestId(id)
    setEdits(null)
    setShowOthers(false)
    setSubstituteOk(false)
    setTouched(false)
    // จอแคบรายการคำขออยู่ด้านบน — เลื่อนลงไปที่ส่วนกรอกจำนวนให้เห็นทันที
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  function setQty(lotId: string, value: string) {
    setEdits({ requestId, qty: { ...qtyByLot, [lotId]: value } })
    setSubstituteOk(false)
    setTouched(true)
  }

  function handleSubmit(e: React.FormEvent) {
    if (confirmedRef.current) return // ผ่านมาจากปุ่ม "ยืนยัน" ในโมดัลแล้ว ปล่อยให้ submit จริง
    e.preventDefault()
    if (!selectedRequest) return
    setTouched(true)
    if (problem) return
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

  function filterChip(value: 'all' | 'ready' | 'urgent', label: string) {
    const active = filter === value
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setFilter(value)}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          active
            ? 'border-brand bg-brand text-white dark:border-sky-500 dark:bg-sky-600'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {label}
      </button>
    )
  }

  function lotRow({ lot, raw, qty, matched }: (typeof entries)[number]) {
    const invalid = touched && raw !== '' && (!Number.isInteger(qty) || qty < 0 || qty > lot.quantity_remaining)
    const unit = unitLabel(lot.unit, locale)
    return (
      <li key={lot.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:items-center">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {lot.item_name}
            {!matched && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                {t.substituteBadge}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {lot.centers?.name} · {t.receivedOn} {receivedLabel(lot.received_at)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.lotLeft} {lot.quantity_remaining} {unit}
          </p>
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300">
          <span className="text-xs text-slate-500 sm:hidden dark:text-slate-400">{t.expiryHeader}: </span>
          {formatDateOnly(lot.expiry_date, locale)}
          {lot.days_left !== null && lot.days_left <= 7 && (
            <span className="ml-2 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 sm:ml-0 sm:mt-1 sm:block sm:w-fit dark:bg-amber-500/10 dark:text-amber-400">
              {lot.days_left <= 0 ? t.expiresToday : t.daysLeft.replace('{n}', String(lot.days_left))}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2">
          <span className="sr-only">{`${t.quantityToAllocate} — ${lot.item_name} (${lot.centers?.name ?? ''})`}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={lot.quantity_remaining}
            value={raw}
            aria-invalid={invalid}
            onChange={(e) => setQty(lot.id, e.target.value)}
            className={`w-24 rounded-md border px-2 py-1.5 text-sm dark:bg-slate-800 dark:text-slate-100 ${
              invalid ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
            }`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>
        </label>
      </li>
    )
  }

  return (
    <>
      {!isAdmin && (
        <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t.crossCenterNote}
        </p>
      )}

      <form
        ref={formRef}
        action={allocate}
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
      >
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="items" value={itemsJson} />

        <section aria-labelledby="allocate-requests-title" className={`${panel} p-4`}>
          <h2 id="allocate-requests-title" className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t.selectRequest}{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">({requests.length})</span>
          </h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchRequests}
            aria-label={t.searchRequests}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {filterChip('all', t.filterAll)}
            {filterChip('ready', t.filterReady)}
            {filterChip('urgent', t.filterUrgent)}
          </div>

          {requests.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t.noOpenRequests}</p>
          ) : visibleRequests.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t.noRequestMatch}</p>
          ) : (
            <ul className="mt-3 space-y-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
              {visibleRequests.map((r) => {
                const remaining = r.quantity_requested - r.quantity_fulfilled
                const percent =
                  r.quantity_requested > 0 ? Math.round((r.quantity_fulfilled / r.quantity_requested) * 100) : 0
                const selected = r.id === requestId
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectRequest(r.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected
                          ? 'border-brand bg-slate-50 ring-2 ring-brand/20 dark:border-sky-500 dark:bg-slate-800 dark:ring-sky-500/30'
                          : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{r.item_name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[r.urgency] ?? URGENCY_STYLE.low}`}
                        >
                          {URGENCY_LABEL[r.urgency] ?? r.urgency}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {r.centers?.name} · {CATEGORY_LABEL[r.category] ?? r.category}
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <span
                          className="block h-full rounded-full bg-sky-600 dark:bg-sky-400"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {t.stillNeededShort} {remaining}
                          {r.unit ? ` ${unitLabel(r.unit, locale)}` : ''}
                        </span>
                        {r.ready ? (
                          <span className="text-emerald-700 dark:text-emerald-400">✓ {t.readyStock}</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">{t.noStock}</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section ref={detailRef} aria-live="polite" className={`${panel} min-w-0 scroll-mt-4 p-4 sm:p-5`}>
          {!selectedRequest ? (
            <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t.chooseRequestHint}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedRequest.item_name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedRequest.centers?.name} · {t.stillNeededShort} {requestRemaining}
                    {unitText}
                  </p>
                </div>
                {hasEdits && (
                  <button
                    type="button"
                    onClick={() => {
                      setEdits(null)
                      setTouched(false)
                    }}
                    className={secondaryBtn}
                  >
                    ↺ {t.useSuggested}
                  </button>
                )}
              </div>

              {matchedLots.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.autoFillNote}</p>
              )}

              {matchedLots.length === 0 && !othersVisible && (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.noLotsTitle}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.noLotsHint}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {otherLots.length > 0 && (
                      <button type="button" onClick={() => setShowOthers(true)} className={secondaryBtn}>
                        {t.viewSubstitutes} ({otherLots.length})
                      </button>
                    )}
                    <Link href="/pledges" className={secondaryBtn}>
                      {t.viewPledges}
                    </Link>
                    <Link href="/donations/new" className={secondaryBtn}>
                      {t.receiveStock}
                    </Link>
                  </div>
                  {otherLots.length > 0 && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.substituteHint}</p>
                  )}
                </div>
              )}

              {(matchedLots.length > 0 || othersVisible) && (
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                  <li className="hidden gap-3 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_150px_150px] dark:bg-slate-800 dark:text-slate-400">
                    <span>{t.lotsForRequest}</span>
                    <span>{t.expiryHeader}</span>
                    <span>{t.quantityToAllocate}</span>
                  </li>
                  {entries.filter((e) => e.matched).map(lotRow)}
                  {othersVisible && otherLots.length > 0 && (
                    <li className="bg-amber-50/60 px-4 py-2 text-xs text-amber-700 dark:bg-amber-500/5 dark:text-amber-400">
                      {t.otherLotsWarning} {t.substituteHint}
                    </li>
                  )}
                  {othersVisible && entries.filter((e) => !e.matched).map(lotRow)}
                </ul>
              )}

              {otherLots.length > 0 && !othersVisible && matchedLots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOthers(true)}
                  className="mt-2 text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  {t.showOtherLots} ({otherLots.length})
                </button>
              )}

              {hiddenByUnit > 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t.unitFilteredNote.replace('{n}', String(hiddenByUnit))}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t.totalToAllocate} {total} / {requestRemaining}
                    {unitText}
                  </p>
                  {touched && problem && (
                    <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {problem}
                    </p>
                  )}
                  {mixedUnits && !problem && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t.mixedUnitsWarning}</p>
                  )}
                </div>
                <SubmitButton
                  pendingLabel={dict.common.saving}
                  disabled={categoryLots.length === 0}
                  className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.reviewAndConfirm} →
                </SubmitButton>
              </div>
            </>
          )}
        </section>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby="allocate-confirm-title"
        className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-lg backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="p-6">
          <h2 id="allocate-confirm-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.modalTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.modalSubtitle}</p>

          <dl className="mt-4 space-y-2 rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.requestedItem}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.item_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.toCenter}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedRequest?.centers?.name ?? '—'}</dd>
            </div>
            {chosen.map(({ lot, qty, matched }) => (
              <div key={lot.id} className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
                <dt className="text-slate-500 dark:text-slate-400">
                  {lot.item_name}
                  {!matched && <span className="text-amber-700 dark:text-amber-400"> ({t.substituteBadge})</span>}
                  <span className="block text-xs">{lot.centers?.name ?? '—'}</span>
                </dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {qty} {unitLabel(lot.unit, locale)}
                  <span
                    className={`block text-xs font-normal ${
                      lot.quantity_remaining - qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t.remainingAfter} {lot.quantity_remaining - qty}
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{t.totalToAllocate}</dt>
              <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">
                {total} / {requestRemaining}
                {unitText}
              </dd>
            </div>
          </dl>

          {nearExpiry && !problem && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {t.nearExpiryWarning}
            </p>
          )}

          {mixedUnits && !problem && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {t.mixedUnitsWarning}
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
              {t.substituteConfirm}
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
              {t.confirmAllocate}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
