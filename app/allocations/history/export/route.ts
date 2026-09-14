// ส่งออกประวัติการจัดสรรเป็น CSV ตามตัวกรองเดียวกับหน้าประวัติ
// ใช้เป็นรายงานตรวจสอบย้อนหลัง — เห็นเฉพาะรายการที่ RLS ให้เห็น (staff = ศูนย์ตัวเอง)

import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { historyQuery, parseHistoryFilters, type HistoryRow } from '@/lib/allocation-history'
import { unitLabel } from '@/lib/units'

const MAX_ROWS = 5000

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.allocations

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const filters = parseHistoryFilters(params, me?.role === 'admin')

  const { data, error } = await historyQuery(supabase, filters, false).range(0, MAX_ROWS - 1)
  if (error) {
    return new Response(error.message, { status: 500 })
  }

  const STATUS_LABEL: Record<string, string> = {
    allocated: t.statusAllocated,
    delivered: t.statusDelivered,
    cancelled: t.statusCancelled,
  }
  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        })
      : ''

  const header = [
    t.allocatedAt,
    t.item,
    t.allocatedQuantity,
    t.receivedQuantity,
    dict.requests.unit,
    t.sourceCenter,
    t.receivingCenter,
    t.allocatedBy,
    dict.common.status,
    t.deliveredAt,
    t.deliveredBy,
    t.deliveryNote,
    t.cancelReason,
    t.slipNo,
  ]

  const rows = ((data ?? []) as unknown as HistoryRow[]).map((a) => [
    formatDate(a.allocated_at),
    a.requests?.item_name ?? a.donations?.item_name ?? '',
    a.quantity_allocated,
    a.status === 'delivered' ? (a.received_quantity ?? a.quantity_allocated) : '',
    unitLabel(a.donations?.unit, locale),
    a.donations?.centers?.name ?? '',
    a.requests?.centers?.name ?? '',
    a.allocated_by_name ?? '',
    STATUS_LABEL[a.status] ?? a.status,
    formatDate(a.delivered_at),
    a.delivered_by_name ?? '',
    a.delivery_note ?? '',
    a.cancel_reason ? `${a.cancel_reason}${a.cancelled_by_name ? ` (${a.cancelled_by_name})` : ''}` : '',
    a.id.slice(0, 8).toUpperCase(),
  ])

  // BOM ให้ Excel เปิดภาษาไทยได้ถูกต้อง
  const csv = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="allocations-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
