import type { Dictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'

// ข้อความยืนยันผลหลังทำรายการ — server action redirect กลับมาพร้อม ?notice=...
// แล้วหน้าปลายทางแปลงเป็นข้อความตามภาษาที่เลือก (FlashNotice แสดงผล)

export type NoticeParams = { notice?: string; received?: string; short?: string; unit?: string; n?: string }

export function withNotice(path: string, notice: string, extra: Record<string, string | number> = {}) {
  const search = new URLSearchParams({ notice })
  for (const [key, value] of Object.entries(extra)) search.set(key, String(value))
  return `${path}?${search}`
}

// แทนค่า {key} ในข้อความจาก dictionary
export function fill(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

export function noticeMessage(params: NoticeParams, dict: Dictionary, locale: string): string | null {
  const unit = unitLabel(params.unit, locale)
  switch (params.notice) {
    case 'delivered':
      return Number(params.short) > 0
        ? fill(dict.allocations.noticeDeliveredShort, { received: params.received ?? '', short: params.short ?? '', unit })
        : fill(dict.allocations.noticeDelivered, { received: params.received ?? '', unit })
    case 'cancelled':
      return dict.allocations.noticeCancelled
    case 'request_cancelled':
      return Number(params.n) > 0
        ? fill(dict.requests.noticeRequestCancelledReturned, { n: params.n ?? '' })
        : dict.requests.noticeRequestCancelled
    default:
      return null
  }
}
