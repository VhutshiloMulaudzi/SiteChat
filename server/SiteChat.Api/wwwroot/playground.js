(() => {
  "use strict";

  const defaults = Object.freeze({
    botName: "SiteChat Assistant",
    welcomeMessage: "Hello! How can I help?",
    accentColor: "#A7F3D0",
    position: "right"
  });

  const suggestedQuestions = [
    "How do I install SiteChat?",
    "How do I keep my API key private?"
  ];

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const elements = {
    form: $("#config-form"),
    botName: $("#bot-name"),
    welcomeMessage: $("#welcome-message"),
    accentColor: $("#accent-color"),
    accentPicker: $("#accent-picker"),
    accentSwatch: $("#accent-swatch"),
    accentHelp: $("#accent-help"),
    reset: $("#reset-config"),
    status: $("#form-status"),
    widgetPreview: $("#widget-preview"),
    hostShell: $("#host-shell"),
    hostToggles: $$("[data-host-theme]"),
    snippet: $("#install-snippet"),
    copy: $("#copy-snippet"),
    copyStatus: $("#copy-status")
  };

  let widgetInstance = null;
  let remountTimer = null;
  let statusTimer = null;

  function selectedPosition() {
    return $("input[name='position']:checked")?.value || defaults.position;
  }

  function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function getConfiguration() {
    const candidate = elements.accentColor.value.trim();
    return {
      botName: elements.botName.value.trim() || defaults.botName,
      welcomeMessage: elements.welcomeMessage.value.trim() || defaults.welcomeMessage,
      accentColor: isHexColor(candidate) ? candidate.toUpperCase() : defaults.accentColor,
      position: selectedPosition()
    };
  }

  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setStatus(message, isError = false) {
    window.clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.classList.toggle("is-error", isError);
    if (message) {
      statusTimer = window.setTimeout(() => {
        elements.status.textContent = "";
        elements.status.classList.remove("is-error");
      }, 3200);
    }
  }

  function setCopyStatus(message, isError = false) {
    elements.copyStatus.textContent = message;
    elements.copyStatus.classList.toggle("is-error", isError);
  }

  function updateAccentControl() {
    const value = elements.accentColor.value.trim();
    const isValid = isHexColor(value);
    elements.accentHelp.classList.toggle("is-invalid", !isValid);
    elements.accentHelp.textContent = isValid
      ? "Use a six-digit hex value, such as #A7F3D0."
      : "Enter a six-digit hex value, such as #A7F3D0.";

    if (isValid) {
      const normalized = value.toUpperCase();
      elements.accentSwatch.style.backgroundColor = normalized;
      elements.accentPicker.value = normalized;
    }
    return isValid;
  }

  function makeInstallationSnippet(config) {
    const scriptUrl = new URL("/widget/sitechat.js", window.location.origin).href;
    return [
      `<script defer src="${escapeHtmlAttribute(scriptUrl)}"`,
      `  data-site-id="demo"`,
      `  data-bot-name="${escapeHtmlAttribute(config.botName)}"`,
      `  data-welcome="${escapeHtmlAttribute(config.welcomeMessage)}"`,
      `  data-accent="${escapeHtmlAttribute(config.accentColor)}"`,
      `  data-position="${escapeHtmlAttribute(config.position)}"></script>`
    ].join("\n");
  }

  function updateInstallationSnippet(config = getConfiguration()) {
    elements.snippet.textContent = makeInstallationSnippet(config);
  }

  function destroyCurrentWidget() {
    if (widgetInstance && typeof widgetInstance.destroy === "function") {
      try {
        widgetInstance.destroy();
      } catch (error) {
        console.warn("SiteChat demo widget could not be destroyed before remounting.", error);
      }
    }
    widgetInstance = null;
    elements.widgetPreview.replaceChildren();
  }

  function displayPreviewUnavailable() {
    const fallback = document.createElement("p");
    fallback.className = "preview-unavailable";
    fallback.textContent = "The SiteChat preview is unavailable. Start the SiteChat API to load the widget script.";
    elements.widgetPreview.replaceChildren(fallback);
  }

  function mountWidget({ announce = true } = {}) {
    const config = getConfiguration();
    updateInstallationSnippet(config);
    destroyCurrentWidget();

    if (!window.SiteChat || typeof window.SiteChat.init !== "function") {
      displayPreviewUnavailable();
      if (announce) setStatus("Widget script is unavailable; the installation snippet is still ready to copy.", true);
      return;
    }

    try {
      elements.widgetPreview.dataset.position = config.position;
      widgetInstance = window.SiteChat.init({
        container: document.getElementById("widget-preview"),
        siteId: "demo",
        botName: config.botName,
        welcomeMessage: config.welcomeMessage,
        accentColor: config.accentColor,
        position: config.position,
        endpoint: new URL("/api/chat", location.origin).href,
        suggestedQuestions
      });
      if (announce) setStatus("Preview refreshed. Demo message history was reset.");
    } catch (error) {
      console.error("SiteChat demo widget could not be initialized.", error);
      displayPreviewUnavailable();
      if (announce) setStatus("The widget could not be initialized. Check that the SiteChat API is running.", true);
    }
  }

  function scheduleMount() {
    window.clearTimeout(remountTimer);
    remountTimer = window.setTimeout(() => mountWidget(), 260);
  }

  function updateHostTheme(theme) {
    const isLight = theme === "light";
    elements.hostShell.classList.toggle("host-light", isLight);
    elements.hostShell.classList.toggle("host-dark", !isLight);
    elements.hostToggles.forEach((button) => {
      const isActive = button.dataset.hostTheme === theme;
      button.classList.toggle("is-selected", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  async function copySnippet() {
    const text = elements.snippet.textContent;
    setCopyStatus("");

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard API is unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopyStatus("Snippet copied to your clipboard.");
      return;
    } catch (clipboardError) {
      const temporaryField = document.createElement("textarea");
      temporaryField.value = text;
      temporaryField.setAttribute("readonly", "");
      temporaryField.style.position = "fixed";
      temporaryField.style.opacity = "0";
      temporaryField.style.pointerEvents = "none";
      document.body.appendChild(temporaryField);
      temporaryField.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (fallbackError) {
        copied = false;
      }
      document.body.removeChild(temporaryField);

      if (copied) {
        setCopyStatus("Snippet copied to your clipboard.");
      } else {
        setCopyStatus("Copy was not available. Select the snippet and copy it manually.", true);
      }
    }
  }

  function resetConfiguration() {
    elements.botName.value = defaults.botName;
    elements.welcomeMessage.value = defaults.welcomeMessage;
    elements.accentColor.value = defaults.accentColor;
    elements.accentPicker.value = defaults.accentColor;
    const positionInput = $("input[name='position'][value='right']");
    if (positionInput) positionInput.checked = true;
    updateAccentControl();
    mountWidget({ announce: false });
    setStatus("Configuration reset. Demo message history was reset.");
  }

  function bindEvents() {
    elements.botName.addEventListener("input", scheduleMount);
    elements.welcomeMessage.addEventListener("input", scheduleMount);
    elements.accentColor.addEventListener("input", () => {
      if (updateAccentControl()) scheduleMount();
    });
    elements.accentColor.addEventListener("blur", () => {
      const value = elements.accentColor.value.trim();
      if (isHexColor(value)) {
        elements.accentColor.value = value.toUpperCase();
        updateAccentControl();
      }
    });
    elements.accentPicker.addEventListener("input", () => {
      elements.accentColor.value = elements.accentPicker.value.toUpperCase();
      updateAccentControl();
      scheduleMount();
    });
    $$("input[name='position']").forEach((input) => input.addEventListener("change", scheduleMount));
    elements.reset.addEventListener("click", resetConfiguration);
    elements.copy.addEventListener("click", copySnippet);
    elements.hostToggles.forEach((button) => {
      button.addEventListener("click", () => updateHostTheme(button.dataset.hostTheme));
    });
  }

  function init() {
    updateAccentControl();
    updateInstallationSnippet();
    bindEvents();
    mountWidget({ announce: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
