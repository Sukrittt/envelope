import { redirect } from 'next/navigation'

/** Backwards-compatible public URL used by the published privacy-policy link. */
export default function PrivacyPolicyAliasPage() {
  redirect('/legal/privacy')
}
