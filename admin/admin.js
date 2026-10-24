'use strict';
const $ = selector => document.querySelector(selector);
let doc, revision, token, settings, dirty = false, active = 'home';
const templates = {};
const collections = {
  skills: { card: '.skill-card', parent: '#skill-grid', name: 'skill' },
  education: { card: '.education-entry', parent: '.education-timeline', name: 'qualification' },
  projects: { card: '.project-card', parent: '.project-grid', name: 'project' }
};
const pages = { home: 'Home & introduction', about: 'About me', skills: 'Skills', education: 'Education', projects: 'Projects', contact: 'Contact section', settings: 'Links & rotating roles', global: 'Site & navigation', assets: 'Upload images & CV' };
function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function changed() { dirty = true; status('Unsaved changes — save to project when you are ready.'); }
function element(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
function button(text, action, className) { const node = element('button', text, className); node.type = 'button'; node.onclick = action; return node; }
function field(parent, title, value, update, multiline = false, options) {
  const label = element('label', title, multiline ? 'wide' : '');
  const input = element(options ? 'select' : multiline ? 'textarea' : 'input');
  if (options) for (const option of options) { const item = element('option', option); item.value = option; input.append(item); }
  input.value = value || '';
  input.addEventListener('input', () => { update(input.value); changed(); });
  label.append(input); parent.append(label); return input;
}
function panel(title) { const node = element('section', '', 'panel'); node.append(element('h2', title)); $('#editor').append(node); return node; }
function parseSkillSvg(source) {
  if (source.length > 100000) throw new Error('Please use an SVG smaller than 100 KB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG document declarations are not supported. Paste only the <svg> element.');
  const parsed = new DOMParser().parseFromString(source.trim(), 'image/svg+xml');
  const svg = parsed.documentElement;
  if (parsed.querySelector('parsererror') || svg.localName !== 'svg') throw new Error('Paste valid SVG code, starting with <svg> and ending with </svg>.');
  const tags = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc']);
  const attributes = new Set(['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'id', 'clip-path', 'mask', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity', 'fx', 'fy', 'fr', 'preserveAspectRatio', 'vector-effect', 'class', 'aria-hidden', 'role', 'focusable']);
  // Rebuild a small, inert SVG vocabulary rather than inserting arbitrary markup.
  const copy = node => {
    if (!tags.has(node.localName)) throw new Error(`Unsupported SVG element: ${node.localName}. Use a static icon made from paths and shapes.`);
    const clean = doc.createElementNS('http://www.w3.org/2000/svg', node.localName);
    for (const attribute of node.attributes) {
      if (!attributes.has(attribute.name)) throw new Error(`Unsupported SVG attribute: ${attribute.name}. Remove scripts, styles and external links; use fill/stroke attributes for colors.`);
      if (/url\s*\(/i.test(attribute.value) && !/^url\(#[\w.-]+\)$/.test(attribute.value)) throw new Error('SVG references must point to an ID inside the icon.');
      clean.setAttribute(attribute.name, attribute.value);
    }
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) clean.append(copy(child));
      else if (child.nodeType === Node.TEXT_NODE) clean.append(doc.createTextNode(child.textContent));
    }
    return clean;
  };
  const clean = copy(svg);
  // Keep gradient and clipping IDs unique when several icons share one page.
  const prefix = `skill-${crypto.randomUUID()}-`;
  const ids = new Map();
  for (const node of [clean, ...clean.querySelectorAll('*')]) if (node.id) { const old = node.id; node.id = prefix + old; ids.set(old, node.id); }
  for (const node of [clean, ...clean.querySelectorAll('*')]) for (const attribute of [...node.attributes]) {
    const match = attribute.value.match(/^url\(#([\w.-]+)\)$/);
    if (match) {
      if (!ids.has(match[1])) throw new Error(`Missing SVG reference: ${match[1]}.`);
      node.setAttribute(attribute.name, `url(#${ids.get(match[1])})`);
    }
  }
  clean.setAttribute('width', '32'); clean.setAttribute('height', '32');
  clean.removeAttribute('class'); clean.setAttribute('aria-hidden', 'true');
  return clean;
}
function editableText(root) {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.trim() && !node.parentElement.closest('script,style,svg,dialog,.skill-icon,.project-card .tag-row,[aria-hidden="true"],#current-year,#role-text,#about-email')) nodes.push(node);
  }
  return nodes;
}
function contentFields(root, parent) {
  for (const node of editableText(root)) {
    const context = node.parentElement;
    const title = context.matches('h1,h2,h3') ? 'Heading' : context.matches('a,button') ? 'Button / link label' : context.classList[0]?.replaceAll('-', ' ') || 'Text';
    const leading = node.textContent.match(/^\s*/)[0], trailing = node.textContent.match(/\s*$/)[0];
    field(parent, title, node.textContent.trim(), value => { node.textContent = leading + value + trailing; }, node.textContent.trim().length > 95);
  }
  for (const image of root.querySelectorAll('img')) {
    field(parent, 'Image path or URL', image.getAttribute('src'), value => image.setAttribute('src', value));
    field(parent, 'Image description (alt text)', image.alt, value => image.alt = value);
  }
  for (const link of root.querySelectorAll('a[href]')) {
    field(parent, `Link: ${link.textContent.trim().slice(0, 45) || link.getAttribute('aria-label') || 'URL'}`, link.getAttribute('href'), value => link.setAttribute('href', value));
  }
}
function renderCollection(key) {
  const config = collections[key];
  const collection = doc.querySelector(config.parent);
  const top = panel(`Manage ${pages[key].toLowerCase()}`);
  top.append(element('p', 'Add, edit, reorder or remove entries. Changes appear on your portfolio after saving.', 'hint'));
  top.append(button(`+ Add ${config.name}`, () => {
    const clone = templates[key].cloneNode(true);
    clone.querySelector('h3').textContent = `New ${config.name}`;
    if (key === 'projects') {
      for (const attr of ['data-project-github', 'data-project-demo', 'data-project-images']) clone.setAttribute(attr, '');
      clone.setAttribute('data-project-description', 'Describe your project.');
      clone.querySelector('.project-body > p').textContent = 'Describe your project.';
    }
    collection.append(clone); changed(); render();
    $('#editor').lastElementChild.scrollIntoView({ behavior: 'smooth' });
  }, 'primary'));
  const cards = [...collection.querySelectorAll(config.card)];
  if (!cards.length) top.append(element('p', 'No entries yet. Add your first one above.', 'hint'));
  cards.forEach((card, index) => {
    const section = panel(card.querySelector('h3')?.textContent || config.name);
    const heading = section.firstElementChild; const bar = element('div', '', 'toolbar'); bar.append(heading);
    const actions = element('div', '', 'actions');
    const up = button('↑ Move up', () => { cards[index - 1].before(card); changed(); render(); }); up.disabled = index === 0;
    const down = button('↓ Move down', () => { cards[index + 1].after(card); changed(); render(); }); down.disabled = index === cards.length - 1;
    let confirmingRemoval = false;
    const remove = button('Remove', () => {
      if (!confirmingRemoval) { confirmingRemoval = true; remove.textContent = 'Confirm removal'; return; }
      card.remove(); changed(); render();
    }, 'danger');
    actions.append(up, down, remove);
    bar.append(actions); section.append(bar);
    const fields = element('div', '', 'fields'); section.append(fields); contentFields(card, fields);
    if (key === 'skills') {
      field(fields, 'Categories (space separated: frontend backend language database creative tools)', card.dataset.skillCategory, value => card.dataset.skillCategory = value);
      const icon = card.querySelector('.skill-icon');
      const svgLabel = element('label', 'SVG icon code', 'wide');
      const svgInput = element('textarea'); svgInput.rows = 6; svgInput.spellcheck = false;
      svgInput.value = icon.querySelector('svg')?.outerHTML || '';
      svgInput.placeholder = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="..." /></svg>';
      svgLabel.append(svgInput);
      const feedback = element('p', 'Paste a complete <svg>…</svg>, then click Apply SVG icon before saving. Use paths/shapes and fill/stroke attributes; scripts, styles and external links are not accepted.', 'hint wide');
      feedback.setAttribute('role', 'status');
      const preview = element('div', '', 'skill-icon-preview wide');
      const updatePreview = () => { preview.replaceChildren(icon.cloneNode(true)); };
      updatePreview();
      field(fields, 'Replace icon with a short label or emoji (optional)', icon.querySelector('svg,img') ? '' : icon.textContent.trim(), value => {
        icon.textContent = value; svgInput.value = ''; updatePreview();
      });
      fields.append(svgLabel, button('Apply SVG icon', () => {
        try {
          const svg = parseSkillSvg(svgInput.value);
          icon.replaceChildren(svg); svgInput.value = svg.outerHTML;
          svgInput.removeAttribute('aria-invalid'); feedback.textContent = 'SVG icon applied. Click Save to project to keep it.';
          updatePreview(); changed();
        } catch (error) { svgInput.setAttribute('aria-invalid', 'true'); feedback.textContent = error.message; }
      }), feedback, preview);
    }
    if (key === 'projects') {
      field(fields, 'Filter category', card.dataset.projectCategory, value => card.dataset.projectCategory = value, false, ['web', 'mobile', 'system', 'logic']);
      field(fields, 'GitHub URL', card.dataset.projectGithub, value => card.dataset.projectGithub = value);
      field(fields, 'Live demo URL', card.dataset.projectDemo, value => card.dataset.projectDemo = value);
      field(fields, 'Full project description', card.dataset.projectDescription, value => card.dataset.projectDescription = value, true);
      field(fields, 'Gallery image paths (one per line)', card.dataset.projectImages.split(',').join('\n'), value => card.dataset.projectImages = value.split('\n').map(item => item.trim()).filter(Boolean).join(','), true);
      field(fields, 'Technologies (comma separated)', [...card.querySelectorAll('.tag-row span')].map(item => item.textContent).join(', '), value => {
        card.querySelector('.tag-row').replaceChildren(...value.split(',').map(item => item.trim()).filter(Boolean).map(item => { const span = doc.createElement('span'); span.textContent = item; return span; }));
      });
    }
  });
}
function render() {
  $('#page-title').textContent = pages[active]; $('#editor').replaceChildren();
  for (const item of $('#navigation').children) { item.classList.toggle('active', item.dataset.page === active); item.setAttribute('aria-current', item.dataset.page === active ? 'page' : 'false'); }
  if (collections[active]) return renderCollection(active);
  const section = panel(pages[active]); const fields = element('div', '', 'fields'); section.append(fields);
  if (active === 'settings') {
    for (const key of ['email', 'linkedin', 'github', 'phone', 'whatsapp']) field(fields, key === 'phone' ? 'Phone (tel:+947...)' : key, settings[key], value => settings[key] = value);
    field(fields, 'Rotating roles (one per line)', settings.roles.join('\n'), value => {
      settings.roles = value.split('\n').map(role => role.trim()).filter(Boolean);
      doc.querySelector('#role-text').textContent = settings.roles[0] || '';
    }, true);
  } else if (active === 'global') {
    field(fields, 'Browser title', doc.title, value => doc.title = value);
    const description = doc.querySelector('meta[name="description"]');
    field(fields, 'Search engine description', description.content, value => description.content = value, true);
    for (const selector of ['#site-header', 'footer', '#intro-screen']) { const root = doc.querySelector(selector); if (root) contentFields(root, fields); }
    for (const root of doc.querySelectorAll('.section-intro, .filter-bar')) contentFields(root, fields);
  } else if (active === 'assets') {
    section.append(element('p', 'Upload an image or PDF, then paste its returned path into an image, gallery or link field. Uploaded files are saved immediately; include assets/uploads in your commit.', 'hint'));
    const label = element('label', 'Choose an image or CV', 'upload'); const input = element('input'); input.type = 'file'; input.accept = '.png,.jpg,.jpeg,.webp,.gif,.pdf'; label.append(input); section.append(label);
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) return status('Choose a file smaller than 10 MB.', true);
      input.disabled = true;
      try {
        const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await request('/api/upload', { name: file.name, base64 });
        const output = element('input', '', 'asset-path'); output.readOnly = true; output.value = result.path; output.setAttribute('aria-label', 'Uploaded asset path'); output.onclick = () => output.select(); section.append(output); status('Asset uploaded. Copy the path into the relevant content field.');
      } catch (error) { status(error.message, true); } finally { input.disabled = false; }
    };
  } else contentFields(doc.querySelector(`#${active}`), fields);
}
function serialize() {
  doc.querySelector('#portfolio-settings').textContent = '\n' + JSON.stringify(settings).replaceAll('<', '\\u003c') + '\n';
  return '<!doctype html>\n' + doc.documentElement.outerHTML + '\n';
}
async function request(url, body) {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify(body) } : {});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Start the local editor with npm run admin, then open http://127.0.0.1:4173/admin/');
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed.'); return data;
}
$('#save').onclick = async () => {
  const html = serialize(); $('#save').disabled = true;
  try { const data = await request('/api/content', { html, revision }); revision = data.revision; dirty = serialize() !== html; status(dirty ? 'Saved. You have additional unsaved edits.' : 'Saved to index.html. Commit and push your changes to update your hosted site.'); }
  catch (error) { status(error.message, true); } finally { $('#save').disabled = false; }
};
$('#preview').onclick = () => {
  const preview = new DOMParser().parseFromString(serialize(), 'text/html');
  const base = preview.createElement('base'); base.href = location.origin + '/'; preview.head.prepend(base);
  // Sandboxed previews cannot access localStorage; skip the theme bootstrap.
  preview.querySelector('head script:not([src])')?.remove();
  $('#preview-dialog iframe').srcdoc = '<!doctype html>' + preview.documentElement.outerHTML;
  $('#preview-dialog').showModal();
};
$('#close-preview').onclick = () => { $('#preview-dialog').close(); $('#preview-dialog iframe').srcdoc = ''; };
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
(async () => {
  try {
    const data = await request('/api/content'); revision = data.revision; token = data.token;
    doc = new DOMParser().parseFromString(data.html, 'text/html'); settings = JSON.parse(doc.querySelector('#portfolio-settings').textContent);
    for (const [key, config] of Object.entries(collections)) {
      const card = doc.querySelector(config.card);
      // Persist templates in inert HTML so empty collections remain addable after a restart.
      let template = doc.querySelector(`#admin-template-${key}`);
      if (!template) { template = doc.createElement('template'); template.id = `admin-template-${key}`; template.content.append(card.cloneNode(true)); doc.body.append(template); }
      templates[key] = template.content.firstElementChild;
    }
    for (const [key, label] of Object.entries(pages)) { const item = button(label, () => { active = key; render(); }); item.dataset.page = key; $('#navigation').append(item); }
    $('#save').disabled = false; $('#preview').disabled = false; render(); status('Connected to your project. All changes save locally before you commit.');
  } catch (error) { status(`${error.message} Run npm run admin in your project and open http://127.0.0.1:4173/admin/`, true); }
})();
