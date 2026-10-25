/*
  Contact details and rotating roles are managed through the local admin.
  The settings are stored in index.html so static hosting needs no backend.
*/
const portfolioConfig = JSON.parse(document.getElementById('portfolio-settings').textContent);

/* Keep all portfolio behaviour safely inside one private function. */
(() => {
  'use strict';

  const documentRoot = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const query = (selector, root = document) => root.querySelector(selector);
  const queryAll = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let toastTimer;
  const showToast = (message) => {
    const toast = query('#toast');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3600);
  };

  /* 1. SIMPLE LOADING SCREEN */
    const intro = query('#intro-screen');

    /* Hide the loading screen with a smooth fade. */
    const dismissIntro = () => {
      if (!intro) return;

      document.body.classList.remove('intro-active');
      intro.classList.add('intro-hidden');

      window.setTimeout(() => {
        intro.setAttribute('aria-hidden', 'true');
      }, 550);
    };

    /* Show the loader on every page refresh. */
    const runIntro = () => {
      if (!intro) return;

      /* Skip the animation when reduced motion is enabled. */
      if (reducedMotion) {
        intro.classList.add('intro-hidden');
        intro.setAttribute('aria-hidden', 'true');
        return;
      }

      document.body.classList.add('intro-active');

      /* This duration matches the CSS loading-line animation. */
      window.setTimeout(dismissIntro, 2200);
    };

    runIntro();

  /* 2. LIGHT / DARK THEME */
  const themeToggle = query('#theme-toggle');
  const sunIcon = query('#sun-icon');
  const moonIcon = query('#moon-icon');
  const themeMeta = query('meta[name="theme-color"]');

  const applyThemeUI = () => {
    const isDark = documentRoot.classList.contains('dark');
    themeToggle?.setAttribute('aria-pressed', String(isDark));
    themeToggle?.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    sunIcon?.classList.toggle('hidden', !isDark);
    moonIcon?.classList.toggle('hidden', isDark);
    themeMeta?.setAttribute('content', isDark ? '#050b18' : '#f8fbff');
  };

  applyThemeUI();
  themeToggle?.addEventListener('click', () => {
    const isDark = documentRoot.classList.toggle('dark');
    try {
      window.localStorage.setItem('avishka-theme', isDark ? 'dark' : 'light');
    } catch (error) {
      // Theme still changes for this page view if storage is unavailable.
    }
    applyThemeUI();
  });

  /* 3. MOBILE NAVIGATION */
  const menuToggle = query('#menu-toggle');
  const mobileMenu = query('#mobile-menu');
  const menuOpenIcon = query('#menu-open-icon');
  const menuCloseIcon = query('#menu-close-icon');

  const setMenuState = (open) => {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    mobileMenu.classList.toggle('hidden', !open);
    menuOpenIcon?.classList.toggle('hidden', open);
    menuCloseIcon?.classList.toggle('hidden', !open);
  };

  menuToggle?.addEventListener('click', () => {
    setMenuState(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  queryAll('.mobile-nav-link').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) setMenuState(false);
  });

  /* 4. SCROLL PROGRESS, ACTIVE SECTION, AND FLOATING HEADER */
  const header = query('#site-header');
  const scrollProgress = query('#scroll-progress');
  const sections = queryAll('main section[id]');
  const navigationLinks = queryAll('.nav-link, .mobile-nav-link');
  let scrollTicking = false;

  const updateScrollUI = () => {
    const scrollTop = window.scrollY;
    const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(Math.max(scrollTop / scrollableHeight, 0), 1);
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
    header?.classList.toggle('header-scrolled', scrollTop > 24);

    const marker = scrollTop + Math.min(window.innerHeight * 0.42, 330);
    let currentSection = sections[0]?.id || 'home';
    sections.forEach((section) => {
      if (section.offsetTop <= marker) currentSection = section.id;
    });

    navigationLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${currentSection}`;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    scrollTicking = false;
  };

  const requestScrollUpdate = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollUI);
  };

  updateScrollUI();
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate);

  /* 5. REVEAL ELEMENTS WHEN THEY ENTER THE SCREEN */
  const revealElements = queryAll('.reveal');
  revealElements.forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 65}ms`;
  });

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealElements.forEach((element) => revealObserver.observe(element));
  }

  /* 6. ROTATING JOB-TITLE TYPEWRITER */
  const roleText = query('#role-text');
  const roles = portfolioConfig.roles?.filter(role => role.trim()) || [];

  if (roleText && roles.length && !reducedMotion) {
    let roleIndex = 0;
    let letterIndex = roles[0].length;
    let deleting = true;

    const rotateRole = () => {
      const currentRole = roles[roleIndex];
      if (deleting) {
        letterIndex -= 1;
        roleText.textContent = currentRole.slice(0, letterIndex);
        if (letterIndex <= 0) {
          deleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          window.setTimeout(rotateRole, 280);
          return;
        }
        window.setTimeout(rotateRole, 42);
        return;
      }

      letterIndex += 1;
      roleText.textContent = roles[roleIndex].slice(0, letterIndex);
      if (letterIndex >= roles[roleIndex].length) {
        deleting = true;
        window.setTimeout(rotateRole, 1750);
        return;
      }
      window.setTimeout(rotateRole, 72);
    };

    window.setTimeout(rotateRole, 2200);
  }

  /* 7. REUSABLE SKILL AND PROJECT FILTERS */
  const connectFilter = ({ buttonSelector, cardSelector, buttonAttribute, cardAttribute }) => {
    const buttons = queryAll(buttonSelector);
    const cards = queryAll(cardSelector);

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filterValue = button.dataset[buttonAttribute];
        buttons.forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-selected', String(active));
        });

        cards.forEach((card) => {
          const categories = (card.dataset[cardAttribute] || '').split(/\s+/);
          const visible = filterValue === 'all' || categories.includes(filterValue);
          card.classList.toggle('filtered-out', !visible);
        });
      });
    });
  };

  connectFilter({
    buttonSelector: '[data-skill-filter]',
    cardSelector: '[data-skill-category]',
    buttonAttribute: 'skillFilter',
    cardAttribute: 'skillCategory'
  });

  connectFilter({
    buttonSelector: '[data-project-filter]',
    cardSelector: '[data-project-category]',
    buttonAttribute: 'projectFilter',
    cardAttribute: 'projectCategory'
  });

  /* 8. PROJECT DETAILS DIALOG */
  const projectDialog = query('#project-dialog');
  const dialogTitle = query('#project-dialog-title');
  const dialogDescription = query('#project-dialog-description');
  const dialogStack = query('#project-dialog-stack');
  const dialogMedia = query('#project-dialog-media');
  const dialogSymbol = query('#project-dialog-symbol');

  /* Project gallery controls */
  const galleryPrevious = query('#project-image-prev');
  const galleryNext = query('#project-image-next');
  const galleryCounter = query('#project-image-counter');

  const dialogGithub = query('#project-dialog-github');

  let projectGalleryImages = [];
  let projectGalleryIndex = 0;
  let projectGalleryFit = 'cover';

  /* Display the currently selected gallery image. */
  const showProjectGalleryImage = () => {
    const currentImage =
      projectGalleryImages[projectGalleryIndex] || '';

    const hasImage = Boolean(currentImage);
    const showNavigation = projectGalleryImages.length > 1;

    if (dialogMedia) {
      dialogMedia.classList.toggle(
        'has-project-image',
        hasImage
      );

      dialogMedia.style.backgroundImage = hasImage
        ? `url("${currentImage}")`
        : '';

      dialogMedia.style.backgroundSize = hasImage
        ? projectGalleryFit
        : '';

      dialogMedia.style.backgroundPosition = hasImage
        ? 'center'
        : '';

      dialogMedia.style.backgroundRepeat = hasImage
        ? 'no-repeat'
        : '';
    }

    if (galleryPrevious) {
      galleryPrevious.hidden = !showNavigation;
    }

    if (galleryNext) {
      galleryNext.hidden = !showNavigation;
    }

    if (galleryCounter) {
      galleryCounter.hidden = !showNavigation;

      galleryCounter.textContent = showNavigation
        ? `${projectGalleryIndex + 1} / ${projectGalleryImages.length}`
        : '';
    }
  };
  const dialogDemo = query('#project-dialog-demo');

  /* Activate an action only when its project card contains a real URL. */
  const setProjectDialogLink = (link, url, unavailableMessage) => {
    if (!link) return;
    const available = Boolean(url?.trim());
    link.href = available ? url.trim() : '#';
    link.classList.toggle('is-disabled', !available);
    link.setAttribute('aria-disabled', String(!available));
    link.title = available ? '' : unavailableMessage;
  };

  /* Read the selected card so the same dialog works for every project. */
  queryAll('[data-project-details]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.project-card');
      if (!card || !projectDialog) return;

      const title = query('.project-body h3', card)?.textContent.trim() || 'Project details';
      const description = card.dataset.projectDescription?.trim()
        || query('.project-body > p', card)?.textContent.trim()
        || '';
      const technologies = queryAll('.tag-row span', card).map((tag) =>
        tag.textContent.trim()
      );

      const cardVisual = query('.project-visual', card);
      const cardSymbol = query('.project-symbol', card);

      /* Find the screenshot inside the selected project card. */
      const cardImage = query('.project-image', card);
      const fallbackImage =
        cardImage?.getAttribute('src')?.trim() || '';

      /* Read all paths from data-project-images. */
      const listedImages = (card.dataset.projectImages || '')
        .split(/[|,]/)
        .map((image) => image.trim())
        .filter(Boolean);

      /* Use the card image when no gallery was added. */
      projectGalleryImages = listedImages.length
        ? listedImages
        : fallbackImage
          ? [fallbackImage]
          : [];

      projectGalleryFit = card.dataset.projectImageFit === 'contain' ? 'contain' : 'cover';
      projectGalleryIndex = 0;

      const visualClass = Array.from(cardVisual?.classList || []).find(
        (name) => name.startsWith('visual-')
      );

      if (dialogTitle) dialogTitle.textContent = title;
      if (dialogDescription) dialogDescription.textContent = description;

      /* Reuse the selected project's icon and background inside the large preview. */
      if (dialogMedia) {
        dialogMedia.className = 'project-dialog-media';

        if (visualClass) {
          dialogMedia.classList.add(visualClass);
        }

        dialogMedia.setAttribute(
          'aria-label',
          `${title} preview`
        );

        /* Start the gallery from its first image. */
        showProjectGalleryImage();
      }

      /* Show the old SVG icon only when there is no project image. */
      if (dialogSymbol) {
        dialogSymbol.replaceChildren();

        if (projectGalleryImages.length === 0 && cardSymbol) {
          const symbolCopy = cardSymbol.cloneNode(true);
          symbolCopy.setAttribute('class', 'project-dialog-icon');
          dialogSymbol.append(symbolCopy);
        }
      }

      if (dialogStack) {
        const tags = technologies.map((technology) => {
          const tag = document.createElement('span');
          tag.textContent = technology;
          return tag;
        });
        dialogStack.replaceChildren(...tags);
      }

      setProjectDialogLink(dialogGithub, card.dataset.projectGithub, 'GitHub link coming soon');
      setProjectDialogLink(dialogDemo, card.dataset.projectDemo, 'Live demo not accessible yet');

      if (typeof projectDialog.showModal === 'function') {
        projectDialog.showModal();
      } else {
        /* Simple fallback for older browsers without the native dialog API. */
        projectDialog.setAttribute('open', '');
      }
    });
  });

  /* Show the previous gallery image. */
  galleryPrevious?.addEventListener('click', () => {
    if (projectGalleryImages.length < 2) return;

    projectGalleryIndex =
      (projectGalleryIndex - 1 + projectGalleryImages.length)
      % projectGalleryImages.length;

    showProjectGalleryImage();
  });

  /* Show the next gallery image. */
  galleryNext?.addEventListener('click', () => {
    if (projectGalleryImages.length < 2) return;

    projectGalleryIndex =
      (projectGalleryIndex + 1)
      % projectGalleryImages.length;

    showProjectGalleryImage();
  });

  /* Keyboard arrow support. */
  projectDialog?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      galleryPrevious?.click();
    }

    if (event.key === 'ArrowRight') {
      galleryNext?.click();
    }
  });

  const closeProjectDialog = () => {
    if (!projectDialog?.hasAttribute('open')) return;
    if (typeof projectDialog.close === 'function') projectDialog.close();
    else projectDialog.removeAttribute('open');
  };

  /* Clicking the dimmed backdrop or the contact link closes the popup. */
  projectDialog?.addEventListener('click', (event) => {
    if (event.target === projectDialog) closeProjectDialog();
  });

  /* Disabled links keep the requested design visible without opening fake URLs. */
  queryAll('[data-project-dialog-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });
  });

  /* 9. PROFILE LINKS AND CONTACT FORM */
  const openProfile = (profile) => {
    const value = portfolioConfig[profile]?.trim();
    if (!value) {
      showToast(`Add your ${profile === 'email' ? 'email address' : `${profile} link`} in script.js to activate this button.`);
      return;
    }

    if (profile === 'email') {
      window.location.href = `mailto:${value}`;
      return;
    }

    window.open(value, '_blank', 'noopener,noreferrer');
  };

  queryAll('[data-profile]').forEach((button) => {
    button.addEventListener('click', () => openProfile(button.dataset.profile));
  });

  /* Show the real email in the About card after you add it to portfolioConfig. */
  const aboutEmail = query('#about-email');
  if (aboutEmail && portfolioConfig.email.trim()) {
    aboutEmail.textContent = portfolioConfig.email;
    aboutEmail.href = `mailto:${portfolioConfig.email}`;
  }

  const contactForm = query('#contact-form');
  contactForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = query('#contact-name')?.value.trim() || '';
    const senderEmail = query('#contact-email')?.value.trim() || '';
    const message = query('#contact-message')?.value.trim() || '';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !senderEmail || !message) {
      showToast('Please complete your name, email, and message.');
      return;
    }

    if (!emailPattern.test(senderEmail)) {
      showToast('Please enter a valid email address.');
      return;
    }

    if (!portfolioConfig.email.trim()) {
      showToast('Add your email address in script.js to activate the contact form.');
      return;
    }

    const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${senderEmail}\n\n${message}`);
    window.location.href = `mailto:${portfolioConfig.email}?subject=${subject}&body=${body}`;
  });

  /* 10. DESKTOP CUSTOM CURSOR */
  if (finePointer && !reducedMotion) {
    const cursorDot = query('#cursor-dot');
    const cursorRing = query('#cursor-ring');

    if (cursorDot && cursorRing) {
      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;
      let ringX = mouseX;
      let ringY = mouseY;

      const renderCursor = () => {
        ringX += (mouseX - ringX) * 0.16;
        ringY += (mouseY - ringY) * 0.16;
        cursorDot.style.transform = `translate3d(${mouseX - 2.5}px, ${mouseY - 2.5}px, 0)`;
        cursorRing.style.transform = `translate3d(${ringX - cursorRing.offsetWidth / 2}px, ${ringY - cursorRing.offsetHeight / 2}px, 0)`;
        window.requestAnimationFrame(renderCursor);
      };

      window.addEventListener('mousemove', (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        cursorDot.style.opacity = '1';
        cursorRing.style.opacity = '1';
      }, { passive: true });

      document.documentElement.addEventListener('mouseleave', () => {
        cursorDot.style.opacity = '0';
        cursorRing.style.opacity = '0';
      });

      queryAll('a, button, input, textarea, .skill-card, .project-card, .creative-card').forEach((element) => {
        element.addEventListener('mouseenter', () => cursorRing.classList.add('cursor-hover'));
        element.addEventListener('mouseleave', () => cursorRing.classList.remove('cursor-hover'));
      });

      renderCursor();
    }
  }

  /* 11. KEEP THE FOOTER YEAR CURRENT */
  const currentYear = query('#current-year');
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());
})();
