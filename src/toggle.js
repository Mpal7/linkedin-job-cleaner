(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;

  async function togglePanel() {
    try {
      const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
      if (Number.isInteger(tab?.id)) {
        await extensionApi.tabs.sendMessage(tab.id, { type: "toggleRepostPanel" });
      }
    } catch {
      // The active tab may not be a LinkedIn search results page.
    } finally {
      window.close();
    }
  }

  togglePanel();
})();
