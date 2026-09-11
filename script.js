/* nav shadow on scroll */
const nav = document.getElementById('nav');
document.addEventListener('scroll', () => {
  nav.style.boxShadow = window.scrollY > 20 ? '0 4px 20px rgba(20,20,28,0.06)' : 'none';
}, { passive: true });

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

/* request form — front-end only until wired to a real inbox/CRM endpoint */
const form = document.getElementById('quoteForm');
const status = document.getElementById('formStatus');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    status.textContent = "Got it — we'll reply within one business day to schedule.";
    status.classList.add('is-success');
    form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
  });
}
