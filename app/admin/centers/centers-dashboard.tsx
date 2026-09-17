'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { addCenter } from './actions'
import styles from './centers-dashboard.module.css'

type Center = { id: string; name: string; type: string; address: string | null; contact_phone: string | null; is_active: boolean }
type User = { id: string; center_id: string | null }
type Props = { centers: Center[]; users: User[]; dict: Dictionary; children: ReactNode; error?: string; loadError: boolean }
const defaults = { name: '', type: '', address: '', contact_phone: '', is_active: true }

export function CentersDashboard({ centers, users, dict, children, error, loadError }: Props) {
  const t = dict.centerDashboard
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const busy = useRef(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'centers' | 'users'>('centers')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ascending, setAscending] = useState(true)
  const dirty = JSON.stringify(draft) !== JSON.stringify(defaults)
  const field = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
  const button = 'min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800'

  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])
  useEffect(() => {
    if (!open || !dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [open, dirty])

  function close(force = false) {
    if (busy.current && !force) return
    if (!force && dirty && !window.confirm(t.discard)) return
    dialog.current?.close()
    setOpen(false)
    setDraft(defaults)
    setSaveError('')
    trigger.current?.focus()
  }

  async function save(formData: FormData) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setSaveError('')
    try {
      const result = await addCenter(formData)
      if (result.error) { setSaveError(result.error); return }
      setNotice(t.saved)
      setSearch(''); setType(''); setStatus(''); setPage(1); setTab('centers')
      close(true)
      router.refresh()
    } catch { setSaveError(t.saveError) }
    finally { busy.current = false; setSaving(false) }
  }

  const filtered = centers.filter(center => {
    const query = search.trim().toLocaleLowerCase()
    return `${center.name} ${center.address ?? ''} ${center.contact_phone ?? ''}`.toLocaleLowerCase().includes(query)
      && (!type || center.type === type) && (!status || center.is_active === (status === 'active'))
  }).sort((a, b) => (ascending ? 1 : -1) * a.name.localeCompare(b.name))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const stats = [
    [t.total, centers.length, '▦', 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'],
    [dict.admin.centerTypeShelter, centers.filter(c => c.type === 'shelter').length, '⌂', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'],
    [dict.admin.centerTypeWarehouse, centers.filter(c => c.type === 'warehouse').length, '♡', 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'],
    [dict.admin.usersInSystem, users.length, '♙', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'],
  ]

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 text-brand sm:px-6 dark:text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">{dict.admin.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.admin.subtitle}</p></div>
      <button ref={trigger} type="button" onClick={() => { setNotice(''); setOpen(true) }} className="min-h-12 rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700">＋ {dict.admin.addCenter}</button>
    </header>
    {(error || loadError) && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error || t.loadError}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>}
    <section aria-label={t.total} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(([label, value, icon, tone]) => <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><span aria-hidden="true" className={`flex h-14 w-14 items-center justify-center rounded-full text-3xl ${tone}`}>{icon}</span><div><h2 className="text-sm text-slate-500 dark:text-slate-400">{label}</h2><p className="mt-1 text-3xl font-semibold tabular-nums">{loadError ? '—' : value}</p></div></div>)}
    </section>
    <section>
      <div className="flex gap-1" aria-label={dict.admin.title}>
        {(['centers', 'users'] as const).map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`min-h-12 rounded-t-lg border px-5 text-sm font-semibold ${tab === key ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>{key === 'centers' ? dict.admin.centersInSystem : dict.admin.usersInSystem} <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700">{loadError ? '—' : key === 'centers' ? centers.length : users.length}</span></button>)}
      </div>
      {tab === 'users' ? <div className="rounded-b-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">{children}</div> : <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input aria-label={t.search} placeholder={t.search} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className={field} type="search" />
          <select aria-label={dict.admin.type} value={type} onChange={e => { setType(e.target.value); setPage(1) }} className={field}><option value="">{t.allTypes}</option><option value="shelter">{dict.admin.centerTypeShelter}</option><option value="warehouse">{dict.admin.centerTypeWarehouse}</option></select>
          <select aria-label={dict.common.status} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className={field}><option value="">{t.allStatuses}</option><option value="active">{t.active}</option><option value="inactive">{t.inactive}</option></select>
          <button type="button" className={button} onClick={() => { setSearch(''); setType(''); setStatus(''); setPage(1) }}>{t.clear}</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th aria-sort={ascending ? 'ascending' : 'descending'} className="px-4 py-3"><button type="button" onClick={() => setAscending(!ascending)}>{dict.admin.centerName} {ascending ? '↑' : '↓'}</button></th>{[dict.admin.type, dict.admin.address, dict.admin.contactPhone, t.members, dict.common.status].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{rows.map(center => <tr key={center.id} className="border-t border-slate-200 dark:border-slate-700"><td className="px-4 py-4 font-medium">{center.name}</td><td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${center.type === 'shelter' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'}`}>{center.type === 'shelter' ? dict.admin.centerTypeShelter : dict.admin.centerTypeWarehouse}</span></td><td className="max-w-64 px-4 py-4 text-slate-500 dark:text-slate-400">{center.address || '—'}</td><td className="px-4 py-4">{center.contact_phone || '—'}</td><td className="px-4 py-4 tabular-nums">{users.filter(user => user.center_id === center.id).length}</td><td className={`whitespace-nowrap px-4 py-4 ${center.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>● {center.is_active ? t.active : t.inactive}</td></tr>)}</tbody>
        </table>{!rows.length && <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">{loadError ? t.loadError : t.empty}</p>}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length} {t.results}</p><div className="flex items-center gap-2"><select aria-label={t.perPage} className={field} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / {t.perPage}</option>)}</select><button className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label={t.previous}>‹</button><span className="whitespace-nowrap">{currentPage} / {pages}</span><button className={button} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label={t.next}>›</button></div></div>
      </div>}
    </section>

    <dialog ref={dialog} aria-labelledby="center-drawer-title" className={`${styles.dialog} bg-white text-brand shadow-2xl dark:bg-slate-900 dark:text-slate-100`} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) { const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) close() } }}>
      {open && <form onSubmit={event => { event.preventDefault(); void save(new FormData(event.currentTarget)) }} className="flex min-h-full flex-col">
        <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-7"><div><h2 id="center-drawer-title" className="text-2xl font-semibold">{t.addTitle}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.addHint}</p></div><button type="button" disabled={saving} onClick={() => close()} aria-label={dict.common.close} className="h-11 w-11 shrink-0 rounded-lg text-2xl hover:bg-slate-100 dark:hover:bg-slate-800">×</button></div>
        <fieldset disabled={saving} className="flex-1 space-y-5 px-6 py-3">
          {saveError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{saveError}</p>}
          <label className="block space-y-2 text-sm font-medium"><span>{dict.admin.centerName} *</span><input autoFocus required maxLength={200} name="name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={field} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>{dict.admin.type} *</span><select required name="type" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} className={field}><option value="">{t.chooseType}</option><option value="shelter">{dict.admin.centerTypeShelter}</option><option value="warehouse">{dict.admin.centerTypeWarehouse}</option></select></label>
          <label className="block space-y-2 text-sm font-medium"><span>{dict.admin.contactPhone}</span><input type="tel" maxLength={50} name="contact_phone" value={draft.contact_phone} onChange={e => setDraft({ ...draft, contact_phone: e.target.value })} className={field} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>{dict.admin.address}</span><textarea rows={4} maxLength={1000} name="address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} className={field} /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" name="is_active" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} className="h-5 w-5 accent-blue-600" />{t.active}</label>
        </fieldset>
        <footer className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><button type="button" disabled={saving} className={`${button} flex-1`} onClick={() => close()}>{dict.common.cancel}</button><button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? t.saving : t.save}</button></footer>
      </form>}
    </dialog>
  </main>
}
