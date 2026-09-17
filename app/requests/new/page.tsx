import { createRequest } from '../actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { createClient } from '@/lib/supabase/server'
import { getCenterPicker } from '@/lib/center-choice'
import { CenterSelect } from '@/app/center-select'

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const centers = await getCenterPicker(await createClient(), 'shelter')

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.requests.newTitle}</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        action={createRequest}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        {centers && (
          <CenterSelect centers={centers} label={dict.common.center} placeholder={dict.common.selectCenter} />
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.requests.itemWanted}</label>
          <input
            name="item_name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.form.category}</label>
            <select
              name="category"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="food">{dict.form.categoryFood}</option>
              <option value="water">{dict.form.categoryWater}</option>
              <option value="medicine">{dict.form.categoryMedicine}</option>
              <option value="clothing">{dict.form.categoryClothing}</option>
              <option value="hygiene">{dict.form.categoryHygiene}</option>
              <option value="other">{dict.form.categoryOther}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.form.quantity}</label>
            <input
              name="quantity_requested"
              type="number"
              min={1}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div>
          <label htmlFor="request-unit" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {dict.requests.unit}
          </label>
          <input
            id="request-unit"
            name="unit"
            list="request-unit-options"
            maxLength={30}
            placeholder={dict.requests.unitPlaceholder}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <datalist id="request-unit-options">
            {['ชิ้น', 'ถุง', 'ขวด', 'กล่อง', 'แพ็ค', 'ลัง', 'ชุด', 'ห่อ', 'ผืน', 'กระป๋อง'].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dict.requests.unitHint}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{dict.requests.urgency}</label>
          <select
            name="urgency"
            defaultValue="medium"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="low">{dict.requests.urgencyLow}</option>
            <option value="medium">{dict.requests.urgencyMedium}</option>
            <option value="high">{dict.requests.urgencyHigh}</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {dict.requests.submit}
        </button>
      </form>
    </main>
  )
}
