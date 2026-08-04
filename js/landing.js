const pipelineSteps = [
  {
    title: 'Product',
    summary: 'Provide product information and image.',
    detail: 'Abra Zylo starts with the product itself: the name, category, image, and any pricing details that can improve the SEO context.'
  },
  {
    title: 'AI Analysis',
    summary: 'AI reads the product context and search intent.',
    detail: 'The generator examines the product image, name, category, and available metadata so the SEO output is tailored to the item rather than generic copy.'
  },
  {
    title: 'SEO Generation',
    summary: 'Create optimized meta title, description, slug, keywords, and product description.',
    detail: 'The workflow produces the structured fields used across product SEO, search results, and metadata management.'
  },
  {
    title: 'Validation',
    summary: 'Run deterministic checks against the generated fields.',
    detail: 'Abra Zylo validates title length, description length, keyword placement, slug quality, product relevance, and content completeness before anything saves.'
  },
  {
    title: 'Improvement',
    summary: 'Regenerate only fields that fail validation.',
    detail: 'Rather than replacing everything, the portal can target the exact weak section and recompute the SEO score after the change.'
  },
  {
    title: '98+ Score',
    summary: 'Reach the quality threshold for auto-save.',
    detail: 'When the score passes the configured threshold, the existing workflow proceeds to save the optimized result as part of the portal history.'
  }
];

function setActivePipelineStep(index) {
  const buttons = document.querySelectorAll('.public-pipeline-step');
  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle('is-active', buttonIndex === index);
  });

  const detail = document.getElementById('pipeline-detail');
  if (!detail) return;
  const step = pipelineSteps[index];
  if (!step) return;
  detail.innerHTML = `
    <h3>${step.title}</h3>
    <p>${step.summary}</p>
    <p>${step.detail}</p>
  `;
}

function initPipeline() {
  const buttons = document.querySelectorAll('.public-pipeline-step');
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => setActivePipelineStep(index));
    button.addEventListener('mouseenter', () => setActivePipelineStep(index));
  });
  if (buttons.length) setActivePipelineStep(0);
}

function initReveal() {
  const elements = document.querySelectorAll('.public-reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.12 });

  elements.forEach((element) => observer.observe(element));
}

function initHeader() {
  const header = document.getElementById('public-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function toggleMenu() {
  const nav = document.getElementById('public-nav');
  if (!nav) return;
  nav.classList.toggle('is-open');
}

function showAuth() {
  const publicPage = document.getElementById('page-public');
  const authPage = document.getElementById('page-auth');
  const appPage = document.getElementById('page-app');

  if (publicPage) publicPage.classList.remove('active');
  if (authPage) {
    authPage.classList.add('active');
    authPage.style.display = 'block';
  }
  if (appPage) {
    appPage.classList.remove('active');
    appPage.style.display = 'none';
  }

  document.body.removeAttribute('data-app-ready');
  document.body.classList.remove('app-ready');

  if (window.Auth?.showView) {
    window.Auth.showView('login');
  }
}

function init() {
  initHeader();
  initPipeline();
  initReveal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.Landing = { init, toggleMenu, showAuth };