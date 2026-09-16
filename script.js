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
