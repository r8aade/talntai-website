/* nav shadow on scroll */
const nav = document.getElementById('nav');
document.addEventListener('scroll', () => {
  nav.style.boxShadow = window.scrollY > 20 ? '0 4px 20px rgba(20,20,28,0.06)' : 'none';
}, { passive: true });

/* mobile nav toggle */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* reveal on scroll */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* self-checkout buttons — hidden by default in HTML, shown per-tier once
   /api/checkout-config says that offer is open for self-checkout */
const checkoutButtons = document.querySelectorAll('[data-checkout-btn]');
if (checkoutButtons.length) {
  fetch('/api/checkout-config')
    .then((res) => res.json())
    .then((config) => {
      checkoutButtons.forEach((btn) => {
        const tier = btn.getAttribute('data-checkout-btn');
        if (!config[tier]) return;
        btn.hidden = false;
        const bookLink = document.querySelector(`[data-book-btn="${tier}"]`);
        if (bookLink) bookLink.hidden = true;
      });
    })
    .catch(() => {});

  checkoutButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tier = btn.getAttribute('data-checkout-btn');
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Redirecting to checkout…';
      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Checkout unavailable');
        window.location.href = data.url;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalText;
        alert("Checkout isn't available right now — please use the form below instead.");
      }
    });
  });
}

/* request form — submits to /api/leads, which syncs the lead to HubSpot */
const form = document.getElementById('quoteForm');
const status = document.getElementById('formStatus');
if (form) {
  const tsField = document.getElementById('formTs');
  if (tsField) tsField.value = Date.now();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Request failed');
      status.textContent = "Got it — we'll reply within one business day to schedule.";
      status.classList.add('is-success');
      form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
    } catch (err) {
      status.textContent = "Something went wrong — email us directly and we'll get right back to you.";
      submitBtn.disabled = false;
    }
  });
}
