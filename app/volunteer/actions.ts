'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { translateAllocationError } from '@/lib/allocation-errors'
import { deliveryArgs } from '@/lib/delivery-args'

// อาสาสมัครทำได้อย่างเดียวคือกดยืนยันว่าของถึงศูนย์แล้ว ใช้ RPC เดียวกับ
// หน้า /allocations/history ของ staff (mark_delivered ใน 23_f5_improvements.sql)
// แต่ redirect กลับมาที่ /volunteer แทน เพราะอาสาสมัครเข้าหน้า staff ไม่ได้
export async function confirmReceipt(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_delivered', deliveryArgs(formData))
  if (error) {
    const dict = getDictionary(await getLocale())
    redirect('/volunteer?error=' + encodeURIComponent(translateAllocationError(error.message, dict)))
  }
  revalidatePath('/volunteer')
  revalidatePath('/allocations/history')
  redirect('/volunteer')
}
