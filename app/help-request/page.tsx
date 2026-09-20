import shared from '../login/login.module.css'
import styles from '../pledge/pledge.module.css'
import { createClient } from '@/lib/supabase/server'
import { submitHelpRequest } from './actions'
import { BrandMark } from '../brand-mark'
import { BackHomeLink } from '../back-home-link'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function HelpRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const { ok, error } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const { data: shelters } = await supabase
    .from('centers')
    .select('id, name')
    .eq('type', 'shelter')
    .eq('is_active', true)
    .order('name')

  const features = [
    { title: dict.helpRequest.needsTitle, desc: dict.helpRequest.needsDesc, icon: 'list' },
    { title: dict.helpRequest.contactTitle, desc: dict.helpRequest.contactDesc, icon: 'phone' },
    { title: dict.helpRequest.localTitle, desc: dict.helpRequest.localDesc, icon: 'people' },
  ] as const

  return (
    <main className={`${shared.hero} ${styles.hero}`}>
      <div className={shared.artwork} aria-hidden="true" />
      <div className={styles.brand}>
        <BrandMark size="lg" />
      </div>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <h2>
            {dict.helpRequest.introTitle}
            <span>{dict.helpRequest.introAccent}</span>
          </h2>
          <p>{dict.helpRequest.introDesc}</p>
          <blockquote>
            {dict.helpRequest.motto}
            <span aria-hidden="true"> &hearts;</span>
          </blockquote>
        </section>

        <section className={`${shared.panel} ${styles.panel}`} aria-labelledby="help-title">
          <BackHomeLink label={dict.common.backHome} />
          <header className={shared.formHeader}>
            <BrandMark size="lg" />
            <h1 id="help-title">{dict.helpRequest.title}</h1>
            <p>{dict.helpRequest.subtitle}</p>
          </header>

          {ok && <p role="status" className={styles.notice}>{dict.helpRequest.successMsg}</p>}
          {error && <p role="alert" className={shared.error}>{error}</p>}

          {!shelters || shelters.length === 0 ? (
            <p className={styles.notice}>{dict.helpRequest.noShelters}</p>
          ) : (
            <form action={submitHelpRequest} className={`${styles.form} space-y-4`}>
              <div>
                <label htmlFor="requester_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {dict.form.name}
                </label>
                <input
                  id="requester_name"
                  name="requester_name"
                  autoComplete="name"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="requester_phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {dict.form.phoneContact}
                  </label>
                  <input
                    id="requester_phone"
                    name="requester_phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label htmlFor="requester_email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {dict.form.email}
                  </label>
                  <input
                    id="requester_email"
                    name="requester_email"
                    type="email"
                    autoComplete="email"
                    placeholder={dict.pledge.emailPlaceholder}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="center_id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {dict.helpRequest.nearestShelter}
                </label>
                <select
                  id="center_id"
                  name="center_id"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">{dict.form.selectCenterPlaceholder}</option>
                  {shelters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="item_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {dict.helpRequest.itemNeeded}
                </label>
                <input
                  id="item_name"
                  name="item_name"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {dict.form.category}
                  </label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
                  <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {dict.form.quantity}
                  </label>
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="urgency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {dict.helpRequest.urgency}
                </label>
                <select
                  id="urgency"
                  name="urgency"
                  defaultValue="medium"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="low">{dict.helpRequest.urgencyLow}</option>
                  <option value="medium">{dict.helpRequest.urgencyMedium}</option>
                  <option value="high">{dict.helpRequest.urgencyHigh}</option>
                </select>
              </div>

              <div>
                <label htmlFor="note" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {dict.form.noteOptional}
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <button type="submit" className={`${shared.submit} w-full py-3 text-base font-medium transition duration-150`}>
                {dict.helpRequest.submit}
              </button>
            </form>
          )}
          <p className={styles.notice}>{dict.helpRequest.followUp}</p>
        </section>

        <aside className={shared.features}>
          {features.map((feature) => (
            <div className={shared.feature} key={feature.icon}>
              <span className={feature.icon === 'list' ? shared.shield : feature.icon === 'phone' ? shared.heart : shared.people}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {feature.icon === 'list' && (
                    <>
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <path d="M8 7h8M8 11h8M8 15h8M8 19h5" />
                    </>
                  )}
                  {feature.icon === 'phone' && (
                    <path d="m6 3 3 5-2 3a17 17 0 0 0 6 6l3-2 5 3c-1 4-4 4-7 3C7 19 2 13 2 7c0-2 1-4 4-4Z" />
                  )}
                  {feature.icon === 'people' && (
                    <>
                      <circle cx="12" cy="7" r="3" />
                      <path d="M6 21v-3a6 6 0 0 1 12 0v3H6ZM4 4a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M3 15a4 4 0 0 0-2 4v1m20-5a4 4 0 0 1 2 4v1" />
                    </>
                  )}
                </svg>
              </span>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.desc}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </main>
  )
}