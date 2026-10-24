# Carbon Zero demo

- This is the second, independent app. `apps/web` remains the dashboard.
- Use the same React, TypeScript, Vite, Tailwind and shadcn conventions as the
  dashboard. Its orange theme does not apply here: this app is intentionally
  white with forest-green branding, including when the OS uses dark mode.
- The login form is a local demo with no authentication backend. Always reject
  password submissions. Never persist, log, or transmit login-form credentials.
  Sprout sends chat text to `apps/support-agent`; recovery actions use mock data.
  Keep sessions in memory and clearly identify simulated recovery results.
- Keep the login compact and progressive: email first, then password. Preserve
  labels, focus states, keyboard operation and reduced-motion support.
- Verify the flow at desktop, 200% zoom and 390px mobile. Add meaningful tests
  for errors, recovery and helper actions, and run `make check` for both apps.
