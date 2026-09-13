'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveCenterId } from '@/lib/center-choice'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

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
    urgency: String(formData.get('urgency') || 'medium'),
    requested_by: user.id,
  })

  if (error) redirect('/requests/new?error=' + encodeURIComponent(error.message))

  revalidatePath('/requests')
  revalidatePath('/allocations')
  redirect('/requests')
}
