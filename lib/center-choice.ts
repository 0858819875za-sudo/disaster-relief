import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

// admin ส่วนกลางไม่ได้ผูกกับศูนย์ (center_id = null) — ให้เลือกศูนย์เองตอนบันทึก
// staff ใช้ศูนย์ของตัวเองเสมอ (RLS บังคับซ้ำที่ DB อยู่แล้ว)

// คืนรายการศูนย์ให้เลือก เฉพาะ admin ที่ไม่มีศูนย์ / คนอื่นคืน null = ไม่ต้องแสดงช่องเลือก
export async function getCenterPicker(supabase: Client, type: 'warehouse' | 'shelter') {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, center_id')
    .eq('id', user.id)
    .single()
  if (profile?.center_id || profile?.role !== 'admin') return null

  const { data } = await supabase
    .from('centers')
    .select('id, name')
    .eq('type', type)
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ศูนย์ที่จะบันทึกลงแถวใหม่: ศูนย์ของผู้ใช้ก่อน ถ้าเป็น admin ไม่มีศูนย์ใช้ค่าจากฟอร์ม
export async function resolveCenterId(supabase: Client, userId: string, formData: FormData) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, center_id')
    .eq('id', userId)
    .single()
  if (profile?.center_id) return profile.center_id as string
  if (profile?.role === 'admin') return String(formData.get('center_id') || '') || null
  return null
}
