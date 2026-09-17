import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { VolunteerAuth } from './volunteer-auth'

export default async function RegisterPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)

  return <VolunteerAuth dict={dict} />
}
