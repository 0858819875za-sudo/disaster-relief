// =====================================================================
// หน้าฟอร์มสาธารณะ — แจ้งความประสงค์บริจาค (ผู้ใช้ทั่วไป)
//
// ไม่ต้อง login เป็นทางเข้าเดียวของ role "ผู้ใช้ทั่วไป" ในระบบนี้
// staff จะมาตรวจสอบ/ยืนยันคำร้องต่อที่หน้า /pledges (docs/sql/10_public_pledges.sql)
// =====================================================================

import shared from '../login/login.module.css'
import styles from './pledge.module.css'
import { submitPledge } from './actions'
import { BrandMark } from '../brand-mark'
import { BackHomeLink } from '../back-home-link'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function PledgePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const { ok, error } = await searchParams
  const locale = await getLocale()
  const dict = getDictionary(locale)

  return (
    <main className={`${shared.hero} ${styles.hero}`}>
      <div className={shared.artwork} aria-hidden="true" />
      <div className={styles.brand}><BrandMark size="lg" /></div>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <h2>{dict.pledge.introTitle}<span>{dict.pledge.introAccent}</span></h2>
          <p>{dict.pledge.introDesc}</p>
          <blockquote>{dict.pledge.motto}<span aria-hidden="true"> &hearts;</span></blockquote>
        </section>
        <section className={`${shared.panel} ${styles.panel}`} aria-labelledby="pledge-title">
          <BackHomeLink label={dict.common.backHome} />
          <header className={shared.formHeader}>
            <BrandMark size="lg" />
            <h1 id="pledge-title">{dict.pledge.title}</h1>
            <p>{dict.pledge.subtitle}</p>
          </header>
          {ok && <p role="status" className={styles.notice}>{dict.pledge.successMsg}</p>}
          {error && <p role="alert" className={shared.error}>{error}</p>}
          <form action={submitPledge} className={styles.form}>
            <div><label htmlFor="donor-name">{dict.form.name}</label>
              <input id="donor-name" name="donor_name" autoComplete="name" required placeholder={dict.pledge.namePlaceholder} /></div>
            <div className={styles.row}>
              <div><label htmlFor="donor-phone">{dict.form.phone}</label><input id="donor-phone" name="donor_phone" type="tel" autoComplete="tel" placeholder={dict.pledge.phonePlaceholder} /></div>
              <div><label htmlFor="donor-email">{dict.form.email}</label><input id="donor-email" name="donor_email" type="email" autoComplete="email" placeholder={dict.pledge.emailPlaceholder} /></div>
            </div>
            <div><label htmlFor="item-name">{dict.pledge.itemWanted}</label><input id="item-name" name="item_name" required placeholder={dict.pledge.itemPlaceholder} /></div>
            <div className={styles.row}>
              <div><label htmlFor="category">{dict.form.category}</label>
                <select id="category" name="category" required>
                  <option value="food">{dict.form.categoryFood}</option>
                  <option value="water">{dict.form.categoryWater}</option>
                  <option value="medicine">{dict.form.categoryMedicine}</option>
                  <option value="clothing">{dict.form.categoryClothing}</option>
                  <option value="hygiene">{dict.form.categoryHygiene}</option>
                  <option value="other">{dict.form.categoryOther}</option>
                </select></div>
              <div><label htmlFor="quantity">{dict.form.quantity}</label><input id="quantity" name="quantity" type="number" min={1} required placeholder={dict.pledge.quantityPlaceholder} /></div>
            </div>
            <div><label htmlFor="note">{dict.form.note}</label><textarea id="note" name="note" rows={2} placeholder={dict.form.noteOptional} /></div>
            <button type="submit" className={shared.submit}>{dict.pledge.submit}<span aria-hidden="true">&rarr;</span></button>
          </form>
          <p className={styles.notice}>{dict.pledge.followUp}</p>
        </section>
        <aside className={shared.features}>
          <div className={shared.feature}><span className={shared.shield}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 2 10 5v10l-10 5-10-5V7l10-5Zm0 10v10M2 7l10 5 10-5M7 4.5l10 5V15" /></svg></span><div><h2>{dict.pledge.goodsTitle}</h2><p>{dict.pledge.goodsDesc}</p></div></div>
          <div className={shared.feature}><span className={shared.heart}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21S2 15 2 8a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13Z" /></svg></span><div><h2>{dict.pledge.careTitle}</h2><p>{dict.pledge.careDesc}</p></div></div>
          <div className={shared.feature}><span className={shared.people}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3H6ZM4 4a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M3 15a4 4 0 0 0-2 4v1m20-5a4 4 0 0 1 2 4v1" /></svg></span><div><h2>{dict.entryHub.togetherTitle}</h2><p>{dict.login.togetherDesc}</p></div></div>
          <p className={styles.thanks}>{dict.pledge.thanks}<span aria-hidden="true"> &hearts;</span></p>
        </aside>
      </div>
    </main>
  )
}
