/**
 * CODEBASE-TO-COURSE — COMPLETE JS ENGINE
 * Copy this file verbatim into the course output directory.
 * Never regenerate it. It handles all interactivity generically.
 *
 * Engines included:
 *  - Navigation & progress bar
 *  - Scroll-triggered reveal animations
 *  - Keyboard navigation
 *  - Glossary tooltips
 *  - Quiz (multiple-choice & scenario)
 *  - Drag-and-drop matching
 *  - Group chat animation
 *  - Data flow / message flow animation
 *  - Architecture diagram
 *  - "Spot the bug" challenge
 *  - Layer toggle
 *  - Dark mode (system default + persisted toggle, injected into nav)
 *  - Table of contents (self-built from .module sections, collapsible)
 */
(function () {
  'use strict';

  /* ── HELPERS ──────────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* private mode */ } }

  /* ── DARK MODE ────────────────────────────────────────────────
     _base.html sets data-theme before first paint (no flash); this
     engine keeps it in sync, injects the nav toggle, and persists
     explicit choices. No stored choice → follow the OS setting live. */
  const THEME_KEY  = 'course-theme';
  const mediaDark  = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = $('.theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙'; // ☀️ / 🌙
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  (function initTheme() {
    const navInner = $('.nav-inner');
    if (navInner) {
      const btn = document.createElement('button');
      btn.className = 'theme-toggle';
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        storageSet(THEME_KEY, next);
        applyTheme(next);
      });
      navInner.appendChild(btn);
    }
    applyTheme(storageGet(THEME_KEY) || (mediaDark.matches ? 'dark' : 'light'));
    mediaDark.addEventListener('change', e => {
      if (!storageGet(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
    });
  })();

  /* ── NAVIGATION & PROGRESS BAR ────────────────────────────── */
  const progressBar = $('#progress-bar');
  const navDots     = $$('.nav-dot');
  const modules     = $$('.module');

  /* ── TABLE OF CONTENTS ────────────────────────────────────────
     Self-built from the .module sections (title from .module-title,
     falling back to the matching nav-dot tooltip), so courses need
     no extra authoring. Collapsible; hidden state persists. The
     active entry is driven by the same scroll-spy as the nav dots. */
  const TOC_KEY = 'course-toc-hidden';
  const tocLinks = [];

  (function initToc() {
    if (modules.length < 2) return;

    const toc = document.createElement('aside');
    toc.className = 'toc';
    toc.setAttribute('aria-label', 'Table of contents');

    const header = document.createElement('div');
    header.className = 'toc-header';
    const title = document.createElement('span');
    title.className = 'toc-title';
    title.textContent = 'Contents';
    const hideBtn = document.createElement('button');
    hideBtn.className = 'toc-hide-btn';
    hideBtn.type = 'button';
    hideBtn.textContent = '⟨ hide';
    hideBtn.setAttribute('aria-label', 'Hide table of contents');
    header.appendChild(title);
    header.appendChild(hideBtn);
    toc.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'toc-list';
    modules.forEach((mod, i) => {
      const titleEl = $('.module-title', mod);
      const dot     = navDots[i];
      const label   = (titleEl && titleEl.textContent.trim()) ||
                      (dot && dot.dataset.tooltip) || ('Module ' + (i + 1));
      const li   = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'toc-link';
      link.href = '#' + mod.id;
      const num = document.createElement('span');
      num.className = 'toc-num';
      num.textContent = String(i + 1).padStart(2, '0');
      const text = document.createElement('span');
      text.textContent = label;
      link.appendChild(num);
      link.appendChild(text);
      link.addEventListener('click', e => {
        e.preventDefault();
        mod.scrollIntoView({ behavior: 'smooth' });
        closeDrawer(); // no-op on desktop; collapses the mobile drawer
      });
      li.appendChild(link);
      list.appendChild(li);
      tocLinks.push(link);
    });
    toc.appendChild(list);

    const tab = document.createElement('button');
    tab.className = 'toc-tab';
    tab.type = 'button';
    tab.textContent = '☰';
    tab.setAttribute('aria-label', 'Show table of contents');

    function setHidden(hidden) {
      toc.classList.toggle('hidden', hidden);
      tab.classList.toggle('hidden', !hidden);
      storageSet(TOC_KEY, hidden ? '1' : '0');
    }
    hideBtn.addEventListener('click', () => setHidden(true));
    tab.addEventListener('click', () => setHidden(false));

    // Mobile / narrow screens: CSS (≤1279px) turns the ToC into a slide-out
    // drawer under the nav; this ☰ button in the header toggles it.
    const navBtn = document.createElement('button');
    navBtn.className = 'toc-nav-btn';
    navBtn.type = 'button';
    navBtn.textContent = '☰';
    navBtn.setAttribute('aria-label', 'Toggle table of contents');
    navBtn.setAttribute('aria-expanded', 'false');

    function closeDrawer() {
      toc.classList.remove('open');
      navBtn.setAttribute('aria-expanded', 'false');
    }
    navBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = toc.classList.toggle('open');
      navBtn.setAttribute('aria-expanded', String(open));
    });
    // Tap outside the open drawer → close (drawer only; harmless on desktop)
    document.addEventListener('click', e => {
      if (toc.classList.contains('open') && !toc.contains(e.target)) closeDrawer();
    });
    const navInner = $('.nav-inner');
    if (navInner) navInner.insertBefore(navBtn, navInner.firstChild);

    document.body.appendChild(toc);
    document.body.appendChild(tab);
    setHidden(storageGet(TOC_KEY) === '1');
  })();

  function updateProgress() {
    if (!progressBar) return;
    const scrollTop    = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct          = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', Math.round(pct));
    updateNavDots();
  }

  function updateNavDots() {
    const scrollMid = window.scrollY + window.innerHeight / 2;
    modules.forEach((mod, i) => {
      const top    = mod.offsetTop;
      const bottom = top + mod.offsetHeight;
      const isActive = scrollMid >= top && scrollMid < bottom;
      const dot = navDots[i];
      if (dot) {
        if (isActive) {
          dot.classList.add('active');
          dot.classList.remove('visited');
        } else if (window.scrollY + window.innerHeight > top) {
          dot.classList.remove('active');
          dot.classList.add('visited');
        } else {
          dot.classList.remove('active', 'visited');
        }
      }
      if (tocLinks[i]) tocLinks[i].classList.toggle('active', isActive);
    });
  }

  window.addEventListener('scroll', () => requestAnimationFrame(updateProgress), { passive: true });
  updateProgress();

  // Nav dot click → scroll to module
  navDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = $('#' + dot.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ── KEYBOARD NAVIGATION ───────────────────────────────────── */
  function currentModuleIndex() {
    const scrollMid = window.scrollY + window.innerHeight / 2;
    for (let i = 0; i < modules.length; i++) {
      const top    = modules[i].offsetTop;
      const bottom = top + modules[i].offsetHeight;
      if (scrollMid >= top && scrollMid < bottom) return i;
    }
    return 0;
  }

  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      const next = modules[currentModuleIndex() + 1];
      if (next) { next.scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const prev = modules[currentModuleIndex() - 1];
      if (prev) { prev.scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
    }
  });

  /* ── SCROLL-TRIGGERED REVEAL ───────────────────────────────── */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  $$('.animate-in').forEach(el => revealObserver.observe(el));

  // Stagger children
  $$('.stagger-children').forEach(parent => {
    Array.from(parent.children).forEach((child, i) => {
      child.style.setProperty('--stagger-index', i);
    });
  });

  /* ── GLOSSARY TOOLTIPS ─────────────────────────────────────── */
  let activeTooltip = null;

  function positionTooltip(term, tip) {
    const rect     = term.getBoundingClientRect();
    const tipWidth = Math.min(320, Math.max(200, window.innerWidth * 0.8));
    let left = rect.left + rect.width / 2 - tipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
    tip.style.left  = left + 'px';
    tip.style.width = tipWidth + 'px';
    document.body.appendChild(tip);
    const tipHeight = tip.offsetHeight;
    if (rect.top - tipHeight - 12 < 0) {
      tip.style.top = (rect.bottom + 8) + 'px';
      tip.classList.add('flip');
    } else {
      tip.style.top = (rect.top - tipHeight - 8) + 'px';
      tip.classList.remove('flip');
    }
  }

  function showTooltip(term, tip) {
    if (activeTooltip && activeTooltip !== tip) {
      activeTooltip.classList.remove('visible');
      activeTooltip.remove();
    }
    positionTooltip(term, tip);
    requestAnimationFrame(() => tip.classList.add('visible'));
    activeTooltip = tip;
  }

  function hideTooltip(tip) {
    tip.classList.remove('visible');
    setTimeout(() => { if (!tip.classList.contains('visible')) tip.remove(); }, 150);
    if (activeTooltip === tip) activeTooltip = null;
  }

  function wireTermTooltip(term) {
    const tip = document.createElement('span');
    tip.className = 'term-tooltip';
    tip.textContent = term.dataset.definition;

    term.addEventListener('mouseenter', () => showTooltip(term, tip));
    term.addEventListener('mouseleave', () => hideTooltip(tip));
    term.addEventListener('click', e => {
      e.stopPropagation();
      tip.classList.contains('visible') ? hideTooltip(tip) : showTooltip(term, tip);
    });
  }

  $$('.term').forEach(wireTermTooltip);

  document.addEventListener('click', () => {
    if (activeTooltip) { activeTooltip.classList.remove('visible'); activeTooltip.remove(); activeTooltip = null; }
  });

  /* ── TRANSLATION BLOCKS: COMMENTS-ON-TOP VIEW ─────────────────
     The authored two-panel layout can't keep code and English
     aligned once code lines wrap, and it halves the code's width.
     Replace it (at every screen size) with one full-width code
     panel where each English note sits as a comment-style line
     ABOVE its code line — positional pairing: note i belongs to
     code line i. A per-block toggle hides the notes for a pure-code
     read. The original panels remain as the no-JS fallback. */
  // Removes the leading whitespace run from a cloned code line. The
  // run may span several text nodes (e.g. a bare "\t" before the
  // first syntax span), so keep stripping until real content appears.
  function stripLeadingWS(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      node.nodeValue = node.nodeValue.replace(/^[\t ]+/, '');
      if (node.nodeValue !== '') break;
    }
  }

  $$('.translation-block').forEach(block => {
    const codeLines = $$('.code-line', block);
    const notes     = $$('.translation-lines .tl', block);
    if (!codeLines.length || !notes.length) return;
    const count = Math.max(codeLines.length, notes.length);

    // Display-only reformat: the code tokens are untouched, but the
    // layout is normalized for the panel. Strip the indentation the
    // whole snippet shares (mid-function extracts start tabs deep),
    // re-express nesting as 2 columns per tab, and apply it as
    // padding so wrapped continuations align under the code instead
    // of snapping back to column 0.
    const wsOf   = el => (el.textContent.match(/^[\t ]*/) || [''])[0];
    const prefixes = codeLines
      .filter(el => el.textContent.trim() !== '')
      .map(wsOf);
    const common = prefixes.length ? prefixes.reduce((a, b) => {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return a.slice(0, i);
    }) : '';
    const indentCols = el => {
      let cols = 0;
      for (const ch of wsOf(el).slice(common.length)) cols += (ch === '\t' ? 2 : 1);
      return Math.min(cols, 16);
    };

    const inline = document.createElement('div');
    inline.className = 'translation-inline';

    const bar = document.createElement('div');
    bar.className = 'ti-bar';
    const label = document.createElement('span');
    label.className = 'ti-label';
    const toggle = document.createElement('button');
    toggle.className = 'ti-toggle';
    toggle.type = 'button';
    function setNotesHidden(hidden) {
      inline.classList.toggle('notes-hidden', hidden);
      toggle.textContent = hidden ? 'show notes' : 'hide notes';
      toggle.setAttribute('aria-pressed', String(hidden));
      label.textContent = hidden ? 'CODE' : 'CODE · PLAIN ENGLISH';
    }
    toggle.addEventListener('click', () =>
      setNotesHidden(!inline.classList.contains('notes-hidden')));
    bar.appendChild(label);
    bar.appendChild(toggle);
    inline.appendChild(bar);

    const pre  = document.createElement('pre');
    const code = document.createElement('code');
    for (let i = 0; i < count; i++) {
      const cols = codeLines[i] ? indentCols(codeLines[i]) : 0;
      if (notes[i]) {
        const note = document.createElement('span');
        note.className = 'tl-inline';
        note.innerHTML = notes[i].innerHTML;
        // Same indent as the code line below — the note reads as that
        // line's comment. ch units match because notes render in mono.
        note.style.paddingLeft = cols + 'ch';
        $$('.term', note).forEach(wireTermTooltip); // clones need their own tooltip wiring
        code.appendChild(note);
      }
      if (codeLines[i]) {
        const clone = codeLines[i].cloneNode(true);
        stripLeadingWS(clone);
        clone.style.paddingLeft = cols + 'ch';
        code.appendChild(clone);
      }
    }
    pre.appendChild(code);
    inline.appendChild(pre);
    block.appendChild(inline);
    setNotesHidden(false);
    block.classList.add('inlined');
  });

  /* ── QUIZ ENGINE ───────────────────────────────────────────── */
  window.selectOption = function (btn) {
    const block = btn.closest('.quiz-question-block');
    $$('.quiz-option', block).forEach(o => o.classList.remove('selected'));
    btn.classList.add('selected');
  };

  window.checkQuiz = function (containerId) {
    const container = $('#' + containerId);
    if (!container) return;
    $$('.quiz-question-block', container).forEach(q => {
      const selected  = $('.quiz-option.selected', q);
      const feedback  = $('.quiz-feedback', q);
      const correct   = q.dataset.correct;
      const rightExp  = q.dataset.explanationRight  || '';
      const wrongExp  = q.dataset.explanationWrong  || '';

      if (!selected) {
        feedback.textContent = 'Pick an answer first!';
        feedback.className = 'quiz-feedback show warning';
        return;
      }
      $$('.quiz-option', q).forEach(o => o.disabled = true);

      if (selected.dataset.value === correct) {
        selected.classList.add('correct');
        feedback.innerHTML = '<strong>Exactly!</strong> ' + rightExp;
        feedback.className = 'quiz-feedback show success';
      } else {
        selected.classList.add('incorrect');
        const correctBtn = $(`.quiz-option[data-value="${correct}"]`, q);
        if (correctBtn) correctBtn.classList.add('correct');
        feedback.innerHTML = '<strong>Not quite.</strong> ' + wrongExp;
        feedback.className = 'quiz-feedback show error';
      }
    });
  };

  window.resetQuiz = function (containerId) {
    const container = $('#' + containerId);
    if (!container) return;
    $$('.quiz-option', container).forEach(o => {
      o.classList.remove('selected', 'correct', 'incorrect');
      o.disabled = false;
    });
    $$('.quiz-feedback', container).forEach(f => { f.className = 'quiz-feedback'; f.textContent = ''; });
  };

  /* ── DRAG-AND-DROP ENGINE ──────────────────────────────────── */
  function initDnD(containerEl) {
    if (!containerEl) return;
    const chips = $$('.dnd-chip', containerEl);
    const zones = $$('.dnd-zone', containerEl);

    // Mouse (HTML5 Drag API)
    chips.forEach(chip => {
      chip.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', chip.dataset.answer);
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    });

    zones.forEach(zone => {
      const target = $('.dnd-zone-target', zone);
      if (!target) return;
      target.addEventListener('dragover',  e => { e.preventDefault(); target.classList.add('drag-over'); });
      target.addEventListener('dragleave', ()  => target.classList.remove('drag-over'));
      target.addEventListener('drop', e => {
        e.preventDefault();
        target.classList.remove('drag-over');
        const answer = e.dataTransfer.getData('text/plain');
        const chip   = $(`.dnd-chip[data-answer="${answer}"]`, containerEl);
        if (!chip) return;
        target.textContent    = chip.textContent;
        target.dataset.placed = answer;
        chip.classList.add('placed');
      });
    });

    // Touch
    chips.forEach(chip => {
      chip.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.touches[0];
        const ghost = chip.cloneNode(true);
        ghost.classList.add('touch-ghost');
        ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;left:${touch.clientX - 40}px;top:${touch.clientY - 20}px;`;
        document.body.appendChild(ghost);
        chip._ghost  = ghost;
        chip._answer = chip.dataset.answer;
      }, { passive: false });

      chip.addEventListener('touchmove', e => {
        e.preventDefault();
        const touch = e.touches[0];
        if (chip._ghost) {
          chip._ghost.style.left = (touch.clientX - 40) + 'px';
          chip._ghost.style.top  = (touch.clientY - 20) + 'px';
        }
        zones.forEach(z => { const t = $('.dnd-zone-target', z); if (t) t.classList.remove('drag-over'); });
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const zt = el && el.closest('.dnd-zone-target');
        if (zt) zt.classList.add('drag-over');
      }, { passive: false });

      chip.addEventListener('touchend', e => {
        if (chip._ghost) { chip._ghost.remove(); chip._ghost = null; }
        const touch = e.changedTouches[0];
        const el    = document.elementFromPoint(touch.clientX, touch.clientY);
        const zt    = el && el.closest('.dnd-zone-target');
        if (zt) {
          zt.textContent    = chip.textContent;
          zt.dataset.placed = chip._answer;
          chip.classList.add('placed');
        }
        zones.forEach(z => { const t = $('.dnd-zone-target', z); if (t) t.classList.remove('drag-over'); });
      });
    });
  }

  window.checkDnD = function (containerId) {
    const container = $('#' + containerId);
    if (!container) return;
    $$('.dnd-zone', container).forEach(zone => {
      const target  = $('.dnd-zone-target', zone);
      if (!target || !target.dataset.placed) return;
      if (target.dataset.placed === zone.dataset.correct) {
        target.classList.add('correct-placed');
      } else {
        target.classList.add('incorrect-placed');
      }
    });
  };

  window.resetDnD = function (containerId) {
    const container = $('#' + containerId);
    if (!container) return;
    $$('.dnd-zone-target', container).forEach(t => {
      t.textContent = 'Drop here';
      delete t.dataset.placed;
      t.classList.remove('correct-placed', 'incorrect-placed');
    });
    $$('.dnd-chip', container).forEach(c => c.classList.remove('placed', 'dragging'));
  };

  // Auto-init all dnd containers
  $$('.dnd-container').forEach(el => initDnD(el));

  /* ── GROUP CHAT ENGINE ─────────────────────────────────────── */
  function initChat(containerEl) {
    if (!containerEl) return;
    const messages    = $$('.chat-message', containerEl);
    const typingEl    = $('.chat-typing', containerEl);
    const typingAvEl  = $('#' + containerEl.id + '-typing-avatar') || $('.chat-avatar', typingEl);
    const progressEl  = $('.chat-progress', containerEl);
    let index = 0;

    // Build actor map from messages
    const actors = {};
    messages.forEach(msg => {
      const sender = msg.dataset.sender;
      const avatar = $('.chat-avatar', msg);
      if (avatar && !actors[sender]) {
        actors[sender] = { initial: avatar.textContent.trim(), style: avatar.style.background };
      }
    });

    function updateProgress() {
      if (progressEl) progressEl.textContent = index + ' / ' + messages.length + ' messages';
    }

    function showNext() {
      if (index >= messages.length) return;
      const msg    = messages[index];
      const sender = msg.dataset.sender;

      if (typingEl && actors[sender]) {
        if (typingAvEl) {
          typingAvEl.textContent       = actors[sender].initial;
          typingAvEl.style.background  = actors[sender].style;
        }
        typingEl.style.display = 'flex';
      }

      setTimeout(() => {
        if (typingEl) typingEl.style.display = 'none';
        msg.style.display = 'flex';
        msg.style.animation = 'fadeSlideUp 0.3s var(--ease-out)';
        index++;
        updateProgress();
      }, 800);
    }

    function showAll() {
      const iv = setInterval(() => {
        if (index >= messages.length) { clearInterval(iv); return; }
        showNext();
      }, 1200);
    }

    function reset() {
      index = 0;
      messages.forEach(m => { m.style.display = 'none'; m.style.animation = ''; });
      if (typingEl) typingEl.style.display = 'none';
      updateProgress();
    }

    // Bind controls
    const nextBtn  = $('.chat-next-btn',  containerEl);
    const allBtn   = $('.chat-all-btn',   containerEl);
    const resetBtn = $('.chat-reset-btn', containerEl);
    if (nextBtn)  nextBtn.addEventListener('click',  showNext);
    if (allBtn)   allBtn.addEventListener('click',   showAll);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    updateProgress();
  }

  $$('.chat-window').forEach(el => initChat(el));

  /* ── FLOW ANIMATION ENGINE ─────────────────────────────────── */
  function initFlow(containerEl) {
    if (!containerEl) return;
    const stepsData  = JSON.parse(containerEl.dataset.steps || '[]');
    const labelEl    = $('.flow-step-label', containerEl);
    const progressEl = $('.flow-progress',   containerEl);
    const packet     = $('.flow-packet',     containerEl);
    let step = 0;

    function updateProgress() {
      if (progressEl) progressEl.textContent = 'Step ' + step + ' / ' + stepsData.length;
    }

    function animatePacket(fromId, toId) {
      if (!packet) return;
      const fromEl = $('#' + fromId);
      const toEl   = $('#' + toId);
      if (!fromEl || !toEl) return;
      const fromR = fromEl.getBoundingClientRect();
      const toR   = toEl.getBoundingClientRect();
      const contR = containerEl.getBoundingClientRect();
      const fx = fromR.left + fromR.width / 2  - contR.left;
      const fy = fromR.top  + fromR.height / 2 - contR.top;
      const tx = toR.left   + toR.width / 2    - contR.left;
      const ty = toR.top    + toR.height / 2   - contR.top;
      packet.style.setProperty('--packet-from-x', fx + 'px');
      packet.style.setProperty('--packet-from-y', fy + 'px');
      packet.style.setProperty('--packet-to-x',   tx + 'px');
      packet.style.setProperty('--packet-to-y',   ty + 'px');
      packet.style.display    = 'block';
      packet.style.animation  = 'none';
      packet.offsetHeight; // reflow
      packet.style.animation  = 'packetMove 0.8s var(--ease-in-out) forwards';
      setTimeout(() => { packet.style.display = 'none'; }, 850);
    }

    function next() {
      if (step >= stepsData.length) return;
      const s = stepsData[step];
      $$('.flow-actor', containerEl).forEach(a => a.classList.remove('active'));
      if (s.highlight) {
        const hEl = $('#' + s.highlight, containerEl) || $('#flow-' + s.highlight);
        if (hEl) hEl.classList.add('active');
      }
      if (s.packet && s.from && s.to) animatePacket('flow-' + s.from, 'flow-' + s.to);
      if (labelEl) labelEl.textContent = s.label || '';
      step++;
      updateProgress();
    }

    function reset() {
      step = 0;
      $$('.flow-actor', containerEl).forEach(a => a.classList.remove('active'));
      if (labelEl) labelEl.textContent = 'Click "Next Step" to begin';
      if (packet)  packet.style.display = 'none';
      updateProgress();
    }

    const nextBtn  = $('.flow-next-btn',  containerEl);
    const resetBtn = $('.flow-reset-btn', containerEl);
    if (nextBtn)  nextBtn.addEventListener('click',  next);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    updateProgress();
  }

  $$('.flow-animation').forEach(el => initFlow(el));

  /* ── ARCHITECTURE DIAGRAM ──────────────────────────────────── */
  $$('.arch-component').forEach(comp => {
    comp.addEventListener('click', function () {
      const diagram = this.closest('.arch-diagram');
      $$('.arch-component', diagram).forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const descEl = $('.arch-description', diagram);
      if (descEl) descEl.textContent = this.dataset.desc || '';
    });
  });

  /* ── BUG CHALLENGE ─────────────────────────────────────────── */
  window.checkBugLine = function (el, isCorrect) {
    const challenge = el.closest('.bug-challenge');
    const feedback  = $('.bug-feedback', challenge);
    if (isCorrect) {
      el.classList.add('correct');
      feedback.innerHTML  = '<strong>Found it!</strong> ' + (el.dataset.explanation || '');
      feedback.className  = 'bug-feedback show success';
      $$('.bug-line', challenge).forEach(l => l.style.pointerEvents = 'none');
    } else {
      el.classList.add('incorrect');
      feedback.innerHTML  = (el.dataset.hint || 'Not this line — keep looking...');
      feedback.className  = 'bug-feedback show error';
      setTimeout(() => {
        el.classList.remove('incorrect');
        feedback.className = 'bug-feedback';
      }, 1800);
    }
  };

  /* ── LAYER TOGGLE ──────────────────────────────────────────── */
  window.showLayer = function (layerId, btn) {
    const demo = btn ? btn.closest('.layer-demo') : null;
    if (!demo) return;
    $$('.layer', demo).forEach(l => l.style.display = 'none');
    $$('.layer-tab', demo).forEach(t => t.classList.remove('active'));
    const layer = $('#' + layerId);
    if (layer) layer.style.display = 'block';
    btn.classList.add('active');
  };

})();
