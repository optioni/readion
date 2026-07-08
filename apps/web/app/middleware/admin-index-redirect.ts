// The bare /admin index has no content of its own — it redirects to the real Certifications
// landing page. Runs after the `admin` role-gate middleware so an unauthenticated/non-admin
// visitor is bounced away before this ever fires.
export default defineNuxtRouteMiddleware(() => navigateTo('/admin/certifications'))
