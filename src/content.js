(() => {
  const HOST_ID = "linkedin-repost-filter-host";
  const CARD_SELECTOR = '[role="button"][componentkey^="job-card-component-ref-"]';
  const REPOST_LABEL = /^(?:reposted|ripubblicat[oaie]|repost[ée]e?|republicad[oa]|repostad[oa])\b/i;
  const hiddenJobIds = new Set();
  let detectedJobIds = new Set();
  let scanRunning = false;
  let cancelRequested = false;
  let scanController;
  let host;
  let panel;

  function currentJobId() {
    return new URL(window.location.href).searchParams.get("currentJobId");
  }

  function getJobId(card) {
    const key = card.getAttribute("componentkey") || "";
    return key.match(/^job-card-component-ref-(\d+)$/)?.[1] || null;
  }

  function getCards() {
    return [...document.querySelectorAll(CARD_SELECTOR)]
      .map((card) => ({ card, id: getJobId(card), title: card.innerText.trim().split("\n").find(Boolean) || "" }))
      .filter((item) => item.id);
  }

  function findCard(jobId) {
    return [...document.querySelectorAll(CARD_SELECTOR)].find((card) => getJobId(card) === jobId);
  }

  function findRepostLabel() {
    return [...document.querySelectorAll("strong")]
      .map((element) => element.textContent.trim())
      .find((text) => REPOST_LABEL.test(text)) || null;
  }

  function detailJobId() {
    const link = document.querySelector('a[href*="/jobs/view/"]');
    return link?.href.match(/\/jobs\/view\/(\d+)/)?.[1] || null;
  }

  function setStatus(message) {
    const status = panel?.querySelector("[data-role=status]");
    if (status) status.textContent = message;
  }

  function setControls({ scanning = false, found = detectedJobIds.size } = {}) {
    const scanButton = panel?.querySelector('[data-action="scan"]');
    const hideButton = panel?.querySelector('[data-action="hide"]');
    const showButton = panel?.querySelector('[data-action="show"]');
    const cancelButton = panel?.querySelector('[data-action="cancel"]');
    if (!scanButton || !hideButton || !showButton || !cancelButton) return;

    scanButton.disabled = scanning;
    scanButton.textContent = scanning ? "Scanning…" : "Scan this page";
    hideButton.disabled = scanning || found === 0 || hiddenJobIds.size > 0;
    hideButton.textContent = `Hide ${found} repost${found === 1 ? "" : "s"}`;
    showButton.disabled = hiddenJobIds.size === 0;
    showButton.textContent = `Show ${hiddenJobIds.size} hidden`;
    cancelButton.classList.toggle("visible", scanning);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function waitForSelection(jobId, timeout = 7000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return false;
      if (currentJobId() === jobId && detailJobId() === jobId) return true;
      await wait(100);
    }
    return currentJobId() === jobId && detailJobId() === jobId;
  }

  function getScrollPositions() {
    const positions = [{ element: document.scrollingElement, top: document.scrollingElement?.scrollTop || 0 }];
    const card = document.querySelector(CARD_SELECTOR);
    for (let element = card?.parentElement; element && element !== document.body; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (element.scrollHeight > element.clientHeight + 2 && /auto|scroll/.test(style.overflowY)) {
        positions.push({ element, top: element.scrollTop });
      }
    }
    return positions;
  }

  function restoreScrollPositions(positions) {
    for (const position of positions) {
      if (position.element?.isConnected) position.element.scrollTop = position.top;
    }
  }

  async function scanJobResponse(id, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timeout = window.setTimeout(abort, 8000);
    try {
      const response = await fetch(`/jobs/view/${id}/`, { credentials: "same-origin", signal: controller.signal });
      if (response.status === 429) return "limited";
      if (!response.ok || !new RegExp(`^/jobs/view/${id}/?$`).test(new URL(response.url).pathname)) return "unknown";

      const html = await response.text();
      // LinkedIn streams the job header as HTML inside its response. The first
      // strong label in that header is the posting age or explicit repost label.
      const label = html.match(/<strong(?:\s[^>]*)?>\s*([^<]{1,160})\s*<\/strong>/i)?.[1]
        ?.replace(/&nbsp;|&#160;/gi, " ").trim();
      if (!label) return "unknown";
      if (REPOST_LABEL.test(label)) return "reposted";
      // Only treat a recognised age as a negative result. Other layouts and
      // languages are checked through LinkedIn's rendered detail pane instead.
      if (/^(?:(?:over|about|almost|less than)\s+)?\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago$/i.test(label)) return "original";
      return "unknown";
    } finally {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  }

  async function scanResponses(cards) {
    const results = new Map();
    let nextIndex = 0;
    let completed = 0;
    let limited = false;
    scanController = new AbortController();

    async function worker() {
      while (!cancelRequested && !limited && nextIndex < cards.length) {
        const { id } = cards[nextIndex++];
        try {
          const result = await scanJobResponse(id, scanController.signal);
          if (result === "limited") {
            limited = true;
            scanController.abort();
          } else if (result !== "unknown") {
            results.set(id, result);
          }
        } catch {
          // A failed or aborted request will be checked in the detail pane.
        }
        completed += 1;
        if (!cancelRequested) setStatus(`Checking jobs: ${completed} of ${cards.length}…`);
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(6, cards.length) }, worker));
    } finally {
      scanController = null;
    }
    return results;
  }

  async function scanPage() {
    if (scanRunning) return;
    const cards = getCards();
    if (!cards.length) {
      setStatus("No job cards found. Open a LinkedIn job search results page and try again.");
      return;
    }

    scanRunning = true;
    cancelRequested = false;
    detectedJobIds = new Set();
    const originalJobId = currentJobId();
    const scrollPositions = getScrollPositions();
    let incomplete = false;
    setControls({ scanning: true, found: 0 });
    setStatus(`Scanning 0 of ${cards.length} loaded jobs…`);

    try {
      const results = await scanResponses(cards);
      for (const [id, result] of results) {
        if (result === "reposted") detectedJobIds.add(id);
      }
      const remaining = cards.filter(({ id }) => !results.has(id));
      for (let index = 0; index < remaining.length; index += 1) {
        if (cancelRequested) break;
        const { id } = remaining[index];
        const card = findCard(id);
        if (!card) {
          incomplete = true;
          continue;
        }

        setStatus(`Checking remaining ${index + 1} of ${remaining.length}: ${remaining[index].title}`);
        if (currentJobId() !== id) {
          card.click();
          const selected = await waitForSelection(id);
          if (!selected) {
            incomplete = true;
            break;
          }
          // Let LinkedIn finish rendering the selected job details before reading them.
          await wait(250);
        }

        if (currentJobId() === id && findRepostLabel()) detectedJobIds.add(id);
      }
    } finally {
      if (originalJobId && currentJobId() !== originalJobId) {
        const originalCard = findCard(originalJobId);
        originalCard?.click();
        await waitForSelection(originalJobId, 4000);
      }
      restoreScrollPositions(scrollPositions);
      scanRunning = false;
      setControls();
      if (cancelRequested) {
        setStatus(`Scan stopped. Found ${detectedJobIds.size} repost${detectedJobIds.size === 1 ? "" : "s"}.`);
      } else if (incomplete) {
        setStatus(`Scan incomplete. Found ${detectedJobIds.size} reposts; some jobs could not be checked.`);
      } else {
        setStatus(`Found ${detectedJobIds.size} repost${detectedJobIds.size === 1 ? "" : "s"}. Review the count, then choose Hide.`);
      }
    }
  }

  function hideReposts() {
    const selectedJobId = currentJobId();
    for (const id of detectedJobIds) {
      const card = findCard(id);
      if (!card) continue;
      card.dataset.repostFilterHidden = "true";
      card.style.setProperty("display", "none", "important");
      hiddenJobIds.add(id);
    }
    if (selectedJobId && hiddenJobIds.has(selectedJobId)) {
      const nextVisibleCard = getCards().find(({ id }) => !hiddenJobIds.has(id));
      if (nextVisibleCard) findCard(nextVisibleCard.id)?.click();
    }
    setControls();
    setStatus(`Hidden ${hiddenJobIds.size} repost${hiddenJobIds.size === 1 ? "" : "s"}. Choose Show to restore them.`);
  }

  function showHidden() {
    for (const id of hiddenJobIds) {
      const card = findCard(id);
      if (!card) continue;
      card.style.removeProperty("display");
      delete card.dataset.repostFilterHidden;
    }
    hiddenJobIds.clear();
    setControls();
    setStatus("Reposted jobs are visible again.");
  }

  function mountPanel() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        :host([hidden]) { display: none !important; }
        .panel { width: 270px; padding: 14px; color: #191919; background: #fff; border: 1px solid #d6d6d6; border-radius: 12px; box-shadow: 0 4px 18px #0003; font: 14px/1.4 Arial, sans-serif; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .title { margin: 0; font-size: 15px; font-weight: 700; }
        .close { width: 28px; height: 28px; padding: 0; border-radius: 50%; background: transparent; color: #555; font-size: 21px; line-height: 1; }
        .close:hover { background: #eef3f8; }
        .status { min-height: 36px; margin: 0 0 10px; color: #555; overflow-wrap: anywhere; }
        .actions { display: flex; flex-wrap: wrap; gap: 7px; }
        button { border: 0; border-radius: 18px; padding: 8px 12px; background: #0a66c2; color: white; font-weight: 700; cursor: pointer; }
        button.secondary { background: #eef3f8; color: #0a66c2; }
        button:disabled { opacity: .5; cursor: default; }
        .cancel { display: none; margin-top: 8px; padding: 0; color: #555; background: transparent; text-decoration: underline; font-weight: 400; }
        .cancel.visible { display: inline-block; }
      </style>
      <section class="panel" aria-label="LinkedIn Repost Filter">
        <div class="header">
          <h2 class="title">Repost Filter</h2>
          <button class="close" data-action="close" type="button" aria-label="Close Repost Filter" title="Close">×</button>
        </div>
        <p class="status" data-role="status">Scan loaded jobs for LinkedIn’s repost label.</p>
        <div class="actions">
          <button data-action="scan" type="button">Scan this page</button>
          <button class="secondary" data-action="hide" type="button" disabled>Hide 0 reposts</button>
          <button class="secondary" data-action="show" type="button" disabled>Show 0 hidden</button>
        </div>
        <button class="cancel" data-action="cancel" type="button">Cancel scan</button>
      </section>`;
    panel = shadow;
    shadow.querySelector('[data-action="close"]').addEventListener("click", () => {
      host.hidden = true;
    });
    shadow.querySelector('[data-action="scan"]').addEventListener("click", scanPage);
    shadow.querySelector('[data-action="hide"]').addEventListener("click", hideReposts);
    shadow.querySelector('[data-action="show"]').addEventListener("click", showHidden);
    shadow.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      cancelRequested = true;
      scanController?.abort();
      setStatus("Stopping scan after the current job…");
    });
    document.documentElement.append(host);
    setControls();
  }

  mountPanel();
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  extensionApi?.runtime?.onMessage?.addListener((message) => {
    if (message?.type !== "toggleRepostPanel") return;
    if (!host?.isConnected) {
      mountPanel();
      host.hidden = false;
      return;
    }
    host.hidden = !host.hidden;
  });

  const pageObserver = new MutationObserver(() => {
    if (!host?.isConnected) mountPanel();
  });
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
