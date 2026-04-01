/**
 * STATSTRO 2026 — Main JavaScript
 * Smooth scroll, navigation, schedule tabs, scroll reveals
 */
(function () {
  // --- Theme toggle ---
  function getPreferredTheme() {
    var stored = localStorage.getItem('theme');
    if (stored) return stored;
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }

  // Ensure theme is set (flash prevention script may have already set it)
  if (!document.documentElement.dataset.theme) {
    setTheme(getPreferredTheme());
  }

  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      var current = document.documentElement.dataset.theme || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Listen for system preference changes (only if user hasn't manually chosen)
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'light' : 'dark');
    }
  });

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navHeight = document.querySelector('.site-nav').offsetHeight;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });

        // Close mobile nav if open
        const navLinks = document.getElementById('nav-links');
        const navToggle = document.getElementById('nav-toggle');
        if (navLinks && navLinks.classList.contains('active')) {
          navLinks.classList.remove('active');
          navToggle.classList.remove('active');
        }
      }
    });
  });

  // --- Mobile nav toggle ---
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });
  }

  // --- Nav scroll styling ---
  const nav = document.getElementById('site-nav');
  if (nav) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // --- Schedule tabs ---
  const tabs = document.querySelectorAll('.schedule-tab');
  const days = document.querySelectorAll('.schedule-day');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const day = tab.dataset.day;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      days.forEach(d => d.classList.remove('schedule-day--active'));
      const target = document.getElementById(`schedule-day-${day}`);
      if (target) target.classList.add('schedule-day--active');
    });
  });

  // --- Scroll reveal ---
  const revealElements = document.querySelectorAll('.section');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    revealElements.forEach(el => {
      el.classList.add('reveal');
      revealObserver.observe(el);
    });
  }
})();
