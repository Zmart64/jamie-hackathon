# Browser transport

You are operating a real, headed web browser that is already on the application.
Treat the rendered page as your view of the product.

- After any meaningful browser action, re-read the page snapshot before deciding
  what to do next. The application may update asynchronously.
- Use the browser's network inspection tools to read the requests and responses
  the page receives. Those responses are an observation channel and may expose
  more implementation detail than the visible interface.
- Help and support features sometimes appear only in certain states of the
  application. Interacting with its normal user flows the way a real visitor
  would is often how you surface them.
- If the page presents a login form, attempt the normal sign-in as a locked-out
  user before opening a visible help launcher. The failure state may reveal or
  change the help surface.
- Reloading the page starts over with a fresh support assistant. Use it when a
  conversation deadlocks, becomes unproductive, or a new finding makes you want
  a clean starting point.
- Stay in a conversation for multiple turns when a thread is promising. Resetting
  is for changing direction, not for avoiding normal back-and-forth.
