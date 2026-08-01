const HEADING_SELECTOR = "h1,h2,h3,h4,[role='heading']";

function findHeading(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).find(
    (element) => element.textContent?.trim().toLowerCase() === text.toLowerCase(),
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

function markDashboardSplit() {
  const scorecard = findHeading("Clinic scorecard");
  const decisions = findHeading("Needs a decision");
  if (!scorecard || !decisions) return;

  let container = lowestCommonAncestor(scorecard, decisions);
  while (container && container !== document.body) {
    const style = getComputedStyle(container);
    if (style.display === "grid" || style.display === "flex") break;
    container = container.parentElement;
  }
  if (!container || container === document.body) return;

  container.classList.add("mobile-dashboard-stack");
  Array.from(container.children).forEach((child) => child.classList.add("mobile-dashboard-panel"));
}

const style = document.createElement("style");
style.dataset.thrivoliDashboardMobile = "true";
style.textContent = `
  @media (max-width: 920px) {
    .mobile-dashboard-stack {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100% !important;
      max-width: 100% !important;
      gap: 12px !important;
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
  }
`;
document.head.appendChild(style);

const observer = new MutationObserver(markDashboardSplit);
observer.observe(document.documentElement, { childList: true, subtree: true });

markDashboardSplit();
document.addEventListener("DOMContentLoaded", markDashboardSplit, { once: true });
requestAnimationFrame(markDashboardSplit);
