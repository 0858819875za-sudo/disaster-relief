'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { translateAllocationError } from '@/lib/allocation-errors'

async function errorText(message: string) {
  const dict = getDictionary(await getLocale())
  return encodeURIComponent(translateAllocationError(message, dict))
}

function revalidateAllocationPages() {
  revalidatePath('/allocations')
  revalidatePath('/allocations/history')
  revalidatePath('/requests')
  revalidatePath('/donations')
  revalidatePath('/inventory')
  revalidatePath('/volunteer')
}

type AllocationItem = { donation_id: string; quantity: number }

function parseItems(raw: FormDataEntryValue | null): AllocationItem[] {
  try {
    const parsed: unknown = JSON.parse(String(raw ?? '[]'))
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => ({
        donation_id: String((item as AllocationItem).donation_id ?? ''),
        quantity: Number((item as AllocationItem).quantity),
      }))
      .filter((item) => item.donation_id && Number.isInteger(item.quantity) && item.quantity > 0)
  } catch {
    return []
  }
}

// จัดสรรคำขอเดียวจากหลายล็อตใน transaction เดียว — allocate_items_multi
// (docs/sql/18_f5_features.sql) เรียก allocate_items ที่คุมทุกกฎให้ทีละล็อต
export async function allocate(formData: FormData) {
  const supabase = await createClient()

  const { data: allocationIds, error } = await supabase.rpc('allocate_items_multi', {
    p_request_id: String(formData.get('request_id')),
    p_items: parseItems(formData.get('items')),
  })

  if (error) {
    redirect('/allocations?error=' + (await errorText(error.message)))
  }

  revalidateAllocationPages()
  // ส่ง id กลับไปให้หน้าจัดสรรเปิดป๊อปอัปสรุปผลการจัดสรรที่เพิ่งทำ
  const ids = ((allocationIds as string[] | null) ?? []).join(',')
  redirect('/allocations?done=' + encodeURIComponent(ids))
}

export async function confirmDelivery(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_delivered', {
    p_allocation_id: String(formData.get('id')),
  })
  if (error) {
    redirect('/allocations/history?error=' + (await errorText(error.message)))
  }
  revalidateAllocationPages()
  redirect('/allocations/history')
}

// ยกเลิกการจัดสรร — คืนยอดกลับทั้งสองฝั่ง และบันทึกเหตุผลใน cancel_allocation
// ฟังก์ชันบังคับ is_admin() และความยาวเหตุผลเองอีกชั้นแล้ว
export async function cancelAllocation(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_allocation', {
    p_allocation_id: String(formData.get('id')),
    p_reason: String(formData.get('reason') ?? ''),
  })
  if (error) {
    redirect('/allocations/history?error=' + (await errorText(error.message)))
  }
  revalidateAllocationPages()
  redirect('/allocations/history')
}
