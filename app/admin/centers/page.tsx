// =====================================================================
// หน้าจัดการศูนย์และผู้ใช้ (F1) — เฉพาะผู้ดูแลระบบ
//
// RLS ฝั่ง DB (04_rls_policies.sql) บังคับอยู่แล้วว่าแก้ไข profiles/centers
// ได้เฉพาะ admin แต่เช็คซ้ำที่นี่เพื่อไม่ให้ staff เห็นฟอร์มแล้วกดพังเปล่าๆ
// =====================================================================

import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { addCenter, updateUser } from './actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function AdminCentersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const user = await requireStaffOrAdmin(supabase)

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (me?.role !== 'admin') {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {dict.admin.adminOnly}
        </p>
      </main>
    )
  }

  const [{ data: centers }, { data: users }] = await Promise.all([
    supabase.from('centers').select('*').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, username, role, center_id, centers(name)')
      .order('full_name'),
  ])

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.admin.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.admin.subtitle}</p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{dict.admin.centersInSystem}</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.admin.centerName}</th>
                <th className="px-4 py-2 font-medium">{dict.admin.type}</th>
                <th className="px-4 py-2 font-medium">{dict.admin.address}</th>
                <th className="px-4 py-2 font-medium">{dict.admin.contactPhone}</th>
              </tr>
            </thead>
            <tbody>
              {(centers ?? []).map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {c.type === 'warehouse' ? dict.admin.centerTypeWarehouse : dict.admin.centerTypeShelter}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.address ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.contact_phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={addCenter}
          className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2"
        >
          <input
            name="name"
            required
            placeholder={dict.admin.centerName}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <select
            name="type"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="warehouse">{dict.admin.centerTypeWarehouse}</option>
            <option value="shelter">{dict.admin.centerTypeShelter}</option>
          </select>
          <input
            name="address"
            placeholder={dict.admin.address}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            name="contact_phone"
            placeholder={dict.admin.contactPhone}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep sm:col-span-2"
          >
            {dict.admin.addCenter}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{dict.admin.usersInSystem}</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.admin.name}</th>
                <th className="px-4 py-2 font-medium">{dict.admin.role}</th>
                <th className="px-4 py-2 font-medium">{dict.admin.center}</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                    {/* บัญชีที่สร้างจาก Dashboard ไม่มี full_name — ใช้ username แทนให้แยกได้ว่าใครเป็นใคร */}
                    {u.full_name || u.username || '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{u.role}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {(u.centers as unknown as { name?: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <form action={updateUser} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                        <option value="volunteer">volunteer</option>
                      </select>
                      <select
                        name="center_id"
                        defaultValue={u.center_id ?? ''}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">{dict.admin.noCenter}</option>
                        {(centers ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-deep"
                      >
                        {dict.common.save}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
