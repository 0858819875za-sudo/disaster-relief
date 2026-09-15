'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveCenterId } from '@/lib/center-choice'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { translateAllocationError } from '@/lib/allocation-errors'
import { withNotice } from '@/lib/notice'

export async function createRequest(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const centerId = await resolveCenterId(supabase, user.id, formData)
  if (!centerId) {
    const dict = getDictionary(await getLocale())
    redirect('/requests/new?error=' + encodeURIComponent(dict.common.noCenter))
  }

  const { error } = await supabase.from('requests').insert({
    center_id: centerId,
    item_name: String(formData.get('item_name')),
    category: String(formData.get('category')),
    quantity_requested: Number(formData.get('quantity_requested')),
    // หน่วยไม่บังคับ — ถ้าระบุ allocate_items จะจ่ายจากล็อตหน่วยเดียวกันเท่านั้น
    unit: String(formData.get('unit') ?? '').trim() || null,
    urgency: String(formData.get('urgency') || 'medium'),
    requested_by: user.id,
  })

  if (error) redirect('/requests/new?error=' + encodeURIComponent(error.message))

  revalidatePath('/requests')
  revalidatePath('/allocations')
  redirect('/requests')
}

// ยกเลิกคำขอ — cancel_request (docs/sql/23_f5_improvements.sql) ตรวจสิทธิ์ศูนย์
// และคืนยอดรายการจัดสรรที่ยังไม่ส่งมอบให้ใน transaction เดียว
export async function cancelRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: returned, error } = await supabase.rpc('cancel_request', {
    p_request_id: String(formData.get('id')),
    p_reason: String(formData.get('reason') ?? ''),
  })
  if (error) {
    const dict = getDictionary(await getLocale())
    redirect('/requests?error=' + encodeURIComponent(translateAllocationError(error.message, dict)))
  }
  for (const path of ['/requests', '/allocations', '/allocations/history', '/inventory', '/donations', '/volunteer', '/']) {
    revalidatePath(path)
  }
  revalidatePath('/', 'layout')
  // cancel_request คืนจำนวนรายการจัดสรรที่ถูกยกเลิกและคืนยอด
  redirect(withNotice('/requests', 'request_cancelled', { n: Number(returned) || 0 }))
}
