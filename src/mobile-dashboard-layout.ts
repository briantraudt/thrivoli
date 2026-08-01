const HEADING_SELECTOR = "h1,h2,h3,h4,[role='heading']";

function findHeading(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).find(
    (element) => element.textContent?.trim().toLowerCase() === text.toLowerCase(),
  );
}

function findExactText(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".app-main *")).find(
    (element) => element.children.length === 0 && element.textContent?.trim().toLowerCase() === text.toLowerCase(),
  );
}

function lowestCommonAncestor(first: HTMLElement, second: HTMLElement) {
  const ancestors = new Set<HTMLElement>();
  let current: HTMLElement | null = first;
  while (current) {
    ancestors.add(current);
    current = current.parentElement;
  }
  current = second;
  while (current) {
    if (ancestors.has(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function nearestCard(element: HTMLElement | undefined | null) {
  let current = element;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    if (
      style.borderRadius !== "0px" &&
      (style.borderStyle !== "none" || style.backgroundColor === "rgb(255, 255, 255)")
    ) return current;
    current = current.parentElement;
  }
  return null;
}

function markDashboardSplit() {
  const scorecard = findHeading("Clinic scorecard");
  const decisions = findHeading("Needs a decision");
  if (scorecard && decisions) {
    let container = lowestCommonAncestor(scorecard, decisions);
    while (container && container !== document.body) {
      const style = getComputedStyle(container);
      if (style.display === "grid" || style.display === "flex") break;
      container = container.parentElement;
    }
    if (container && container !== document.body) {
      container.classList.add("mobile-dashboard-stack");
      Array.from(container.children).forEach((child) => child.classList.add("mobile-dashboard-panel"));
    }
  }

  const revenue = findExactText("Net revenue MTD");
  const capacity = findExactText("Growth capacity");
  if (revenue && capacity) {
    const kpiCard = lowestCommonAncestor(revenue, capacity);
    if (kpiCard) kpiCard.classList.add("mobile-kpi-card");
  }

  const performance = findHeading("Location performance");
  const performanceCard = nearestCard(performance);
  if (performanceCard) performanceCard.classList.add("mobile-performance-card");
}

const style = document.createElement("style");
style.dataset.thrivoliDashboardMobile = "true";
style.textContent = `
  @media (max-width: 920px) {
    .app-main {
      padding: 10px 10px 22px !important;
    }

    .page-heading {
      gap: 8px !important;
      margin-bottom: 10px !important;
    }

    .page-title-wrap {
      gap: 8px !important;
      padding-top: 0 !important;
    }

    .page-title-wrap h1 {
      font-size: 21px !important;
      line-height: 1.1 !important;
    }

    .mobile-menu-button {
      width: 38px !important;
      height: 38px !important;
      min-height: 38px !important;
      flex-basis: 38px !important;
    }

    .page-actions {
      gap: 7px !important;
    }

    .page-actions > div:first-child {
      padding: 7px 10px !important;
      min-height: 38px !important;
    }

    .page-actions button,
    .page-actions select {
      min-height: 38px !important;
    }

    .mobile-kpi-card {
      margin-bottom: 10px !important;
    }

    .mobile-kpi-card > * {
      padding-top: 11px !important;
      padding-bottom: 11px !important;
    }

    .mobile-kpi-card [style*="font-size:32px"],
    .mobile-kpi-card [style*="font-size:31px"],
    .mobile-kpi-card [style*="font-size:30px"] {
      font-size: 27px !important;
      line-height: 1.05 !important;
    }

    .mobile-dashboard-stack {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100% !important;
      max-width: 100% !important;
      gap: 10px !important;
    }

    .mobile-dashboard-panel,
    .mobile-dashboard-panel * {
      min-width: 0 !important;
      max-width: 100%;
    }

    .mobile-dashboard-panel {
      width: 100% !important;
      overflow: hidden !important;
    }

    .mobile-dashboard-panel td,
    .mobile-dashboard-panel th,
    .mobile-dashboard-panel p,
    .mobile-dashboard-panel span,
    .mobile-dashboard-panel button,
    .mobile-dashboard-panel a {
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .mobile-performance-card {
      margin-top: 10px !important;
      margin-bottom: 10px !important;
    }

    .mobile-performance-card > div:first-child {
      padding: 13px 14px 10px !important;
    }

    .mobile-performance-card h2 {
      margin-bottom: 3px !important;
      font-size: 18px !important;
    }

    .mobile-performance-card p {
      line-height: 1.35 !important;
    }

    .mobile-performance-card button {
      min-height: 34px !important;
    }

    .mobile-performance-card [style*="padding:16px"],
    .mobile-performance-card [style*="padding: 16px"] {
      padding: 10px 12px !important;
    }

    .mobile-performance-card [style*="padding:14px"],
    .mobile-performance-card [style*="padding: 14px"] {
      padding-top: 9px !important;
      padding-bottom: 9px !important;
    }

    #thrivoli-ai-root {
      position: fixed !important;
      inset: auto 14px calc(14px + env(safe-area-inset-bottom)) auto !important;
      left: auto !important;
      right: 14px !important;
      bottom: calc(14px + env(safe-area-inset-bottom)) !important;
      width: max-content !important;
      min-width: 0 !important;
      max-width: none !important;
      height: max-content !important;
      margin: 0 !important;
      padding: 0 !important;
      transform: none !important;
      z-index: 5000 !important;
    }

    #thrivoli-ai-root .tv-ai-launch {
      display: grid !important;
      width: 52px !important;
      height: 52px !important;
      min-width: 52px !important;
      min-height: 52px !important;
      margin: 0 !important;
      border-radius: 16px !important;
    }
  }

  @media (max-width: 560px) {
    .app-main {
      padding: 8px 8px 18px !important;
    }

    .mobile-kpi-card {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .mobile-performance-card > div:first-child {
      padding: 11px 12px 9px !important;
    }
  }
`;
document.head.appendChild(style);

const observer = new MutationObserver(markDashboardSplit);
observer.observe(document.documentElement, { childList: true, subtree: true });

markDashboardSplit();
document.addEventListener("DOMContentLoaded", markDashboardSplit, { once: true });
requestAnimationFrame(markDashboardSplit);
