(function installSiteChatWidget(global, documentRef) {
  "use strict";

  if (!global || !documentRef) {
    return;
  }

  var API_MARKER = "__sitechatWidgetApiV1__";
  var existingNamespace = global.SiteChat;

  // A repeated script include should retain the same SDK and its active instance.
  if (existingNamespace && existingNamespace[API_MARKER]) {
    return;
  }

  // Do not replace an application-owned global with the same name.
  if (typeof existingNamespace !== "undefined") {
    if (global.console && typeof global.console.warn === "function") {
      global.console.warn("SiteChat widget was not installed because window.SiteChat is already in use.");
    }
    return;
  }

  var activeInstance = null;
  var instanceSequence = 0;
  var installedScript = findWidgetScript();
  var DEFAULT_ACCENT = "#A7F3D0";
  var DEFAULT_BOT_NAME = "SiteChat";
  var DEFAULT_WELCOME = "Hello — how can I help?";

  var api = {
    init: function init(options) {
      return startInstance(options, installedScript || findWidgetScript());
    }
  };

  try {
    Object.defineProperty(api, API_MARKER, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  } catch (error) {
    api[API_MARKER] = true;
  }

  global.SiteChat = api;

  function startInstance(options, scriptNode) {
    if (activeInstance) {
      activeInstance.destroy();
    }

    var widget = new SiteChatWidget(normalizeOptions(options, scriptNode));
    activeInstance = widget;
    widget.scheduleMount();
    return widget.publicApi;
  }

  function autoInitialize(scriptNode) {
    if (!scriptNode || isManualScript(scriptNode)) {
      return;
    }

    var siteId = scriptNode.getAttribute("data-site-id");
    if (!siteId || !String(siteId).trim()) {
      return;
    }

    startInstance(
      {
        siteId: siteId,
        botName: scriptNode.getAttribute("data-bot-name"),
        welcomeMessage: scriptNode.getAttribute("data-welcome"),
        accentColor: scriptNode.getAttribute("data-accent"),
        position: scriptNode.getAttribute("data-position"),
        endpoint: scriptNode.getAttribute("data-endpoint")
      },
      scriptNode
    );
  }

  function isManualScript(scriptNode) {
    return String(scriptNode.getAttribute("data-manual") || "").trim().toLowerCase() === "true";
  }

  function findWidgetScript() {
    var current = documentRef.currentScript;
    if (current && current.src) {
      return current;
    }

    var scripts = documentRef.getElementsByTagName("script");
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var candidate = scripts[index];
      var source = candidate.getAttribute("src") || "";
      if (/(?:^|\/)sitechat\.js(?:[?#]|$)/i.test(source)) {
        return candidate;
      }
    }

    return null;
  }

  function normalizeOptions(rawOptions, scriptNode) {
    var options = isObject(rawOptions) ? rawOptions : {};
    var errors = [];
    var scriptUrl = getScriptUrl(scriptNode);
    var endpoint = toSafeUrl(
      hasMeaningfulValue(options.endpoint) ? options.endpoint : "../api/chat",
      scriptUrl
    );

    if (!endpoint) {
      errors.push("The chat endpoint must use an http or https URL.");
    }

    var siteId = cleanText(options.siteId, 40);
    if (!siteId || /[\u0000-\u001F\u007F]/.test(siteId)) {
      errors.push("A valid site ID is required.");
    }

    var requestedContainer = options.container;
    var container = null;
    if (requestedContainer != null) {
      if (isElement(requestedContainer)) {
        container = requestedContainer;
      } else {
        errors.push("The chat container must be an HTML element.");
      }
    }

    var accent = normalizeAccent(options.accentColor);
    if (hasMeaningfulValue(options.accentColor) && !accent) {
      errors.push("The accent colour must be a hexadecimal colour.");
    }

    return {
      endpoint: endpoint ? endpoint.href : "",
      stylesheetUrl: getStylesheetUrl(scriptUrl),
      siteId: siteId,
      botName: cleanText(options.botName, 80) || DEFAULT_BOT_NAME,
      welcomeMessage: cleanText(options.welcomeMessage, 1000) || DEFAULT_WELCOME,
      accentColor: accent || DEFAULT_ACCENT,
      position: String(options.position || "right").toLowerCase() === "left" ? "left" : "right",
      container: container,
      suggestedQuestions: normalizeSuggestedQuestions(options.suggestedQuestions),
      configurationError: errors.join(" ")
    };
  }

  function getScriptUrl(scriptNode) {
    if (scriptNode && scriptNode.src) {
      return scriptNode.src;
    }

    try {
      return new URL("/widget/sitechat.js", global.location.href).href;
    } catch (error) {
      return "/widget/sitechat.js";
    }
  }

  function getStylesheetUrl(scriptUrl) {
    try {
      return new URL("sitechat.css", scriptUrl).href;
    } catch (error) {
      return "/widget/sitechat.css";
    }
  }

  function toSafeUrl(value, baseUrl) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      var parsed = new URL(value.trim(), baseUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function normalizeAccent(value) {
    if (!hasMeaningfulValue(value)) {
      return DEFAULT_ACCENT;
    }

    var accent = String(value).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) {
      return accent.toUpperCase();
    }
    if (/^#[0-9a-fA-F]{3}$/.test(accent)) {
      return (
        "#" +
        accent.charAt(1) +
        accent.charAt(1) +
        accent.charAt(2) +
        accent.charAt(2) +
        accent.charAt(3) +
        accent.charAt(3)
      ).toUpperCase();
    }
    return null;
  }

  function normalizeSuggestedQuestions(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var questions = [];
    for (var index = 0; index < value.length && questions.length < 5; index += 1) {
      var question = cleanText(value[index], 180);
      if (question) {
        questions.push(question);
      }
    }
    return questions;
  }

  function cleanText(value, limit) {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, limit);
  }

  function hasMeaningfulValue(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function isElement(value) {
    return value && value.nodeType === 1 && typeof value.appendChild === "function";
  }

  function SiteChatWidget(config) {
    this.config = config;
    this.id = "sitechat-" + String(++instanceSequence);
    this.destroyed = false;
    this.mounted = false;
    this.readyListener = null;
    this.host = null;
    this.root = null;
    this.elements = {};
    this.request = null;
    this.state = {
      messages: [
        {
          id: this.id + "-welcome",
          role: "assistant",
          content: config.welcomeMessage,
          failed: false
        }
      ],
      pending: false,
      failedTurnId: null,
      status: "",
      error: config.configurationError || ""
    };

    var self = this;
    this.publicApi = {
      open: function open() {
        self.open();
      },
      close: function close() {
        self.close();
      },
      destroy: function destroy() {
        self.destroy();
      }
    };
  }

  SiteChatWidget.prototype.scheduleMount = function scheduleMount() {
    var self = this;
    if (documentRef.body) {
      this.mount();
      return;
    }

    this.readyListener = function onDomReady() {
      documentRef.removeEventListener("DOMContentLoaded", self.readyListener);
      self.readyListener = null;
      self.mount();
    };
    documentRef.addEventListener("DOMContentLoaded", this.readyListener);
  };

  SiteChatWidget.prototype.mount = function mount() {
    if (this.destroyed || this.mounted) {
      return;
    }

    var target = this.config.container || documentRef.body;
    if (!target || !isElement(target)) {
      return;
    }

    this.mounted = true;
    this.host = documentRef.createElement("div");
    this.host.setAttribute("data-sitechat-widget", "");
    this.host.style.setProperty("--sc-accent", this.config.accentColor);

    this.root = this.host.attachShadow({ mode: "open" });
    this.appendStylesheet();
    this.buildInterface();
    target.appendChild(this.host);

    this.render();
    var shouldFocusOnMount = this.openWhenMounted;
    this.setPanelVisibility(Boolean(this.config.container), shouldFocusOnMount);
    this.bindEvents();

    if (this.config.container && !this.state.error) {
      this.focusInput(false);
    }
  };

  SiteChatWidget.prototype.appendStylesheet = function appendStylesheet() {
    var stylesheet = documentRef.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = this.config.stylesheetUrl;
    this.root.appendChild(stylesheet);
  };

  SiteChatWidget.prototype.buildInterface = function buildInterface() {
    var isInline = Boolean(this.config.container);
    var shell = createElement("section", "sc-widget " + (isInline ? "sc-inline" : "sc-floating sc-" + this.config.position));
    var launcher = createElement("button", "sc-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open " + this.config.botName + " chat");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", this.id + "-panel");
    launcher.appendChild(createLauncherIcon());
    launcher.appendChild(createElement("span", "sc-launcher-label", "Chat"));

    var panel = createElement("section", "sc-panel");
    panel.id = this.id + "-panel";
    panel.setAttribute("role", isInline ? "region" : "dialog");
    panel.setAttribute("aria-modal", isInline ? "false" : "false");
    panel.setAttribute("aria-labelledby", this.id + "-title");

    var header = createElement("header", "sc-header");
    var identity = createElement("div", "sc-identity");
    var mark = createElement("span", "sc-mark");
    mark.setAttribute("aria-hidden", "true");
    mark.appendChild(createMarkIcon());
    var headingGroup = createElement("div", "sc-heading-group");
    var title = createElement("h2", "sc-title", this.config.botName);
    title.id = this.id + "-title";
    var availability = createElement("p", "sc-availability", "Typically replies in a moment");
    headingGroup.appendChild(title);
    headingGroup.appendChild(availability);
    identity.appendChild(mark);
    identity.appendChild(headingGroup);

    var headerActions = createElement("div", "sc-header-actions");
    var clearButton = createElement("button", "sc-icon-button sc-clear", "Clear");
    clearButton.type = "button";
    clearButton.setAttribute("aria-label", "Clear conversation");
    var closeButton = createElement("button", "sc-icon-button sc-close");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close chat");
    closeButton.appendChild(createCloseIcon());
    headerActions.appendChild(clearButton);
    if (!isInline) {
      headerActions.appendChild(closeButton);
    }
    header.appendChild(identity);
    header.appendChild(headerActions);

    var status = createElement("div", "sc-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    var conversation = createElement("div", "sc-conversation");
    conversation.setAttribute("role", "log");
    conversation.setAttribute("aria-live", "polite");
    conversation.setAttribute("aria-relevant", "additions text");
    conversation.setAttribute("aria-label", this.config.botName + " conversation");

    var suggestionList = createElement("div", "sc-suggestions");
    suggestionList.setAttribute("aria-label", "Suggested questions");

    var composer = createElement("form", "sc-composer");
    composer.setAttribute("novalidate", "");
    var inputLabel = createElement("label", "sc-sr-only", "Message " + this.config.botName);
    inputLabel.htmlFor = this.id + "-input";
    var input = createElement("textarea", "sc-input");
    input.id = this.id + "-input";
    input.name = "message";
    input.rows = 1;
    input.maxLength = 2000;
    input.placeholder = "Ask a question...";
    input.setAttribute("aria-describedby", this.id + "-privacy");
    input.setAttribute("enterkeyhint", "send");
    var sendButton = createElement("button", "sc-send", "Send");
    sendButton.type = "submit";
    sendButton.setAttribute("aria-label", "Send message");
    composer.appendChild(inputLabel);
    composer.appendChild(input);
    composer.appendChild(sendButton);

    var footer = createElement("footer", "sc-footer");
    var privacy = createElement("p", "sc-privacy", "Do not submit sensitive information.");
    privacy.id = this.id + "-privacy";
    footer.appendChild(privacy);

    panel.appendChild(header);
    panel.appendChild(status);
    panel.appendChild(conversation);
    panel.appendChild(suggestionList);
    panel.appendChild(composer);
    panel.appendChild(footer);

    if (!isInline) {
      shell.appendChild(launcher);
    }
    shell.appendChild(panel);
    this.root.appendChild(shell);

    this.elements = {
      shell: shell,
      launcher: launcher,
      panel: panel,
      closeButton: closeButton,
      clearButton: clearButton,
      status: status,
      conversation: conversation,
      suggestions: suggestionList,
      composer: composer,
      input: input,
      sendButton: sendButton
    };
  };

  SiteChatWidget.prototype.bindEvents = function bindEvents() {
    var self = this;
    this.onLauncherClick = function onLauncherClick() {
      self.open();
    };
    this.onCloseClick = function onCloseClick() {
      self.close();
    };
    this.onClearClick = function onClearClick() {
      self.clearConversation();
    };
    this.onSubmit = function onSubmit(event) {
      event.preventDefault();
      self.submitCurrentInput();
    };
    this.onInputKeyDown = function onInputKeyDown(event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        self.submitCurrentInput();
      }
    };
    this.onDocumentKeyDown = function onDocumentKeyDown(event) {
      if (event.key === "Escape" && !self.config.container && self.isOpen()) {
        event.preventDefault();
        self.close();
      }
    };

    if (!this.config.container) {
      this.elements.launcher.addEventListener("click", this.onLauncherClick);
      this.elements.closeButton.addEventListener("click", this.onCloseClick);
      documentRef.addEventListener("keydown", this.onDocumentKeyDown);
    }
    this.elements.clearButton.addEventListener("click", this.onClearClick);
    this.elements.composer.addEventListener("submit", this.onSubmit);
    this.elements.input.addEventListener("keydown", this.onInputKeyDown);
  };

  SiteChatWidget.prototype.render = function render() {
    if (!this.mounted || this.destroyed) {
      return;
    }

    this.renderMessages();
    this.renderSuggestions();
    this.renderStatus();
    this.updateControls();
  };

  SiteChatWidget.prototype.renderMessages = function renderMessages() {
    var fragment = documentRef.createDocumentFragment();
    for (var index = 0; index < this.state.messages.length; index += 1) {
      var message = this.state.messages[index];
      var row = createElement("div", "sc-message sc-message-" + message.role + (message.failed ? " sc-message-failed" : ""));
      row.setAttribute("data-role", message.role);
      var role = createElement("span", "sc-message-role", message.role === "assistant" ? this.config.botName : "You");
      var bubble = createElement("p", "sc-message-bubble", message.content);
      row.appendChild(role);
      row.appendChild(bubble);
      if (message.failed) {
        row.appendChild(createElement("span", "sc-message-note", "Not sent"));
      }
      fragment.appendChild(row);
    }

    if (this.state.pending) {
      var typingRow = createElement("div", "sc-message sc-message-assistant sc-typing");
      typingRow.setAttribute("aria-label", this.config.botName + " is typing");
      typingRow.appendChild(createElement("span", "sc-message-role", this.config.botName));
      var typingBubble = createElement("div", "sc-typing-bubble");
      typingBubble.setAttribute("aria-hidden", "true");
      for (var dot = 0; dot < 3; dot += 1) {
        typingBubble.appendChild(createElement("span", "sc-typing-dot"));
      }
      typingRow.appendChild(typingBubble);
      fragment.appendChild(typingRow);
    }

    this.elements.conversation.replaceChildren(fragment);
    this.scrollConversationToEnd();
  };

  SiteChatWidget.prototype.renderSuggestions = function renderSuggestions() {
    var self = this;
    var fragment = documentRef.createDocumentFragment();
    var showSuggestions = !this.state.pending && !this.state.failedTurnId && this.state.messages.length === 1;

    if (showSuggestions) {
      this.config.suggestedQuestions.forEach(function appendQuestion(question) {
        var button = createElement("button", "sc-suggestion", question);
        button.type = "button";
        button.addEventListener("click", function sendSuggestion() {
          if (self.state.pending || self.destroyed) {
            return;
          }
          self.elements.input.value = question;
          self.submitCurrentInput();
        });
        fragment.appendChild(button);
      });
    }

    this.elements.suggestions.replaceChildren(fragment);
    this.elements.suggestions.hidden = !showSuggestions || this.config.suggestedQuestions.length === 0;
  };

  SiteChatWidget.prototype.renderStatus = function renderStatus() {
    var message = this.state.error || this.state.status;
    this.elements.status.textContent = message;
    this.elements.status.hidden = !message;
    this.elements.status.classList.toggle("sc-status-error", Boolean(this.state.error));
  };

  SiteChatWidget.prototype.updateControls = function updateControls() {
    var blocked = this.state.pending || Boolean(this.config.configurationError);
    this.elements.input.disabled = blocked;
    this.elements.sendButton.disabled = blocked;
    this.elements.sendButton.textContent = this.state.failedTurnId ? "Retry" : "Send";
    this.elements.clearButton.disabled = this.state.pending && this.state.messages.length <= 1;
  };

  SiteChatWidget.prototype.submitCurrentInput = function submitCurrentInput() {
    if (this.destroyed || this.state.pending || this.config.configurationError) {
      return;
    }

    var content = cleanText(this.elements.input.value, 2000);
    if (!content) {
      this.elements.input.focus();
      return;
    }

    var userMessage;
    if (this.state.failedTurnId) {
      userMessage = this.findMessage(this.state.failedTurnId);
      if (!userMessage || userMessage.role !== "user") {
        this.state.failedTurnId = null;
        userMessage = null;
      }
    }

    if (userMessage) {
      userMessage.content = content;
      userMessage.failed = false;
    } else {
      userMessage = {
        id: this.id + "-message-" + String(Date.now()) + "-" + String(this.state.messages.length),
        role: "user",
        content: content,
        failed: false
      };
      this.state.messages.push(userMessage);
    }

    this.state.failedTurnId = null;
    this.state.error = "";
    this.state.status = this.config.botName + " is typing…";
    this.elements.input.value = "";
    this.beginRequest(userMessage);
  };

  SiteChatWidget.prototype.beginRequest = function beginRequest(userMessage) {
    var self = this;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var request = {
      controller: controller,
      timedOut: false,
      timer: null,
      userMessage: userMessage
    };

    this.request = request;
    this.state.pending = true;
    this.render();

    if (controller) {
      request.timer = global.setTimeout(function abortSlowRequest() {
        request.timedOut = true;
        controller.abort();
      }, 40000);
    }

    var requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        siteId: this.config.siteId,
        messages: this.buildOutboundMessages()
      })
    };
    if (controller) {
      requestOptions.signal = controller.signal;
    }

    Promise.resolve()
      .then(function callChatEndpoint() {
        return global.fetch(self.config.endpoint, requestOptions);
      })
      .then(function readChatResponse(response) {
        return readJson(response).then(function handleResponse(payload) {
          if (!response.ok) {
            throw new SiteChatRequestError(errorMessageFromResponse(response, payload));
          }
          if (!payload || typeof payload.reply !== "string" || !cleanText(payload.reply, 8000)) {
            throw new SiteChatRequestError("The chat service returned an unexpected response. Please try again.");
          }
          return cleanText(payload.reply, 8000);
        });
      })
      .then(function receiveReply(reply) {
        if (!self.isCurrentRequest(request) || self.destroyed) {
          return;
        }
        self.completeRequest(request);
        self.state.messages.push({
          id: self.id + "-reply-" + String(Date.now()),
          role: "assistant",
          content: reply,
          failed: false
        });
        self.state.status = "";
        self.render();
      })
      .catch(function handleRequestFailure(error) {
        if (!self.isCurrentRequest(request) || self.destroyed) {
          return;
        }
        self.completeRequest(request);

        if (request.controller && request.controller.signal.aborted && !request.timedOut) {
          return;
        }

        userMessage.failed = true;
        self.state.failedTurnId = userMessage.id;
        self.state.status = "";
        self.state.error = request.timedOut
          ? "The chat service took too long to respond. Please retry your message."
          : userFacingError(error);
        self.elements.input.value = userMessage.content;
        self.render();
        self.focusInput(false);
      });
  };

  SiteChatWidget.prototype.buildOutboundMessages = function buildOutboundMessages() {
    var messages = [];
    for (var index = 0; index < this.state.messages.length; index += 1) {
      var message = this.state.messages[index];
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }
      var content = cleanText(message.content, 2000);
      if (content) {
        messages.push({ role: message.role, content: content });
      }
    }

    // Preserve complete turns only: a sent context always starts with a user message and ends with one.
    while (messages.length > 20) {
      discardOldestTurn(messages);
    }
    while (messages.length && messages[0].role !== "user") {
      messages.shift();
    }
    while (messageCharacterCount(messages) > 12000 && messages.length > 1) {
      discardOldestTurn(messages);
    }
    while (messages.length && messages[0].role !== "user") {
      messages.shift();
    }

    if (messages.length && messages[messages.length - 1].role !== "user") {
      for (var lastUser = messages.length - 1; lastUser >= 0; lastUser -= 1) {
        if (messages[lastUser].role === "user") {
          messages = messages.slice(0, lastUser + 1);
          break;
        }
      }
    }
    return messages;
  };

  SiteChatWidget.prototype.completeRequest = function completeRequest(request) {
    if (request.timer) {
      global.clearTimeout(request.timer);
    }
    if (this.request === request) {
      this.request = null;
      this.state.pending = false;
    }
  };

  SiteChatWidget.prototype.isCurrentRequest = function isCurrentRequest(request) {
    return this.request === request;
  };

  SiteChatWidget.prototype.findMessage = function findMessage(id) {
    for (var index = 0; index < this.state.messages.length; index += 1) {
      if (this.state.messages[index].id === id) {
        return this.state.messages[index];
      }
    }
    return null;
  };

  SiteChatWidget.prototype.clearConversation = function clearConversation() {
    if (this.destroyed) {
      return;
    }
    this.abortActiveRequest();
    this.state.messages = [
      {
        id: this.id + "-welcome-" + String(Date.now()),
        role: "assistant",
        content: this.config.welcomeMessage,
        failed: false
      }
    ];
    this.state.pending = false;
    this.state.failedTurnId = null;
    this.state.status = "";
    this.state.error = this.config.configurationError || "";
    this.elements.input.value = "";
    this.render();
    this.focusInput(false);
  };

  SiteChatWidget.prototype.abortActiveRequest = function abortActiveRequest() {
    if (!this.request) {
      return;
    }
    var request = this.request;
    this.completeRequest(request);
    if (request.controller) {
      request.controller.abort();
    }
  };

  SiteChatWidget.prototype.open = function open() {
    if (this.destroyed) {
      return;
    }
    if (!this.mounted) {
      this.openWhenMounted = true;
      return;
    }
    this.setPanelVisibility(true, true);
  };

  SiteChatWidget.prototype.close = function close() {
    if (this.destroyed || this.config.container || !this.mounted) {
      return;
    }
    this.setPanelVisibility(false, false);
    this.elements.launcher.focus();
  };

  SiteChatWidget.prototype.isOpen = function isOpen() {
    return this.mounted && !this.elements.panel.hidden;
  };

  SiteChatWidget.prototype.setPanelVisibility = function setPanelVisibility(isVisible, focusInput) {
    if (!this.mounted) {
      return;
    }
    var visible = this.config.container ? true : Boolean(isVisible || this.openWhenMounted);
    this.openWhenMounted = false;
    this.elements.panel.hidden = !visible;
    if (!this.config.container) {
      this.elements.launcher.setAttribute("aria-expanded", String(visible));
    }
    if (visible && focusInput && !this.state.error) {
      this.focusInput(true);
    }
  };

  SiteChatWidget.prototype.focusInput = function focusInput(shouldSelect) {
    if (!this.mounted || this.elements.input.disabled) {
      return;
    }
    this.elements.input.focus();
    if (shouldSelect && this.elements.input.value) {
      this.elements.input.select();
    }
  };

  SiteChatWidget.prototype.scrollConversationToEnd = function scrollConversationToEnd() {
    var conversation = this.elements.conversation;
    global.setTimeout(function afterRender() {
      conversation.scrollTop = conversation.scrollHeight;
    }, 0);
  };

  SiteChatWidget.prototype.destroy = function destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.abortActiveRequest();

    if (this.readyListener) {
      documentRef.removeEventListener("DOMContentLoaded", this.readyListener);
      this.readyListener = null;
    }

    if (this.mounted) {
      if (!this.config.container) {
        this.elements.launcher.removeEventListener("click", this.onLauncherClick);
        this.elements.closeButton.removeEventListener("click", this.onCloseClick);
        documentRef.removeEventListener("keydown", this.onDocumentKeyDown);
      }
      this.elements.clearButton.removeEventListener("click", this.onClearClick);
      this.elements.composer.removeEventListener("submit", this.onSubmit);
      this.elements.input.removeEventListener("keydown", this.onInputKeyDown);
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
    }

    if (activeInstance === this) {
      activeInstance = null;
    }
  };

  function discardOldestTurn(messages) {
    if (!messages.length) {
      return;
    }
    messages.shift();
    while (messages.length && messages[0].role === "assistant") {
      messages.shift();
    }
  }

  function messageCharacterCount(messages) {
    var total = 0;
    for (var index = 0; index < messages.length; index += 1) {
      total += messages[index].content.length;
    }
    return total;
  }

  function readJson(response) {
    return response
      .json()
      .catch(function noJsonBody() {
        return null;
      });
  }

  function errorMessageFromResponse(response, payload) {
    if (payload && payload.error && typeof payload.error.message === "string") {
      return sanitizeServerMessage(payload.error.message);
    }
    if (payload && typeof payload.message === "string") {
      return sanitizeServerMessage(payload.message);
    }
    if (response.status === 429) {
      return "Too many messages were sent. Please wait a moment and try again.";
    }
    if (response.status === 413) {
      return "Your message is too long. Please shorten it and try again.";
    }
    if (response.status >= 500) {
      return "The chat service is temporarily unavailable. Please try again.";
    }
    return "We could not send that message. Please try again.";
  }

  function sanitizeServerMessage(value) {
    var message = cleanText(String(value).replace(/\s+/g, " "), 280);
    return message || "We could not send that message. Please try again.";
  }

  function userFacingError(error) {
    if (error && error.name === "SiteChatRequestError") {
      return sanitizeServerMessage(error.message);
    }
    if (error && typeof error.message === "string" && error.message && error.message !== "Failed to fetch") {
      return sanitizeServerMessage(error.message);
    }
    return "We could not reach the chat service. Check your connection and try again.";
  }

  function SiteChatRequestError(message) {
    this.name = "SiteChatRequestError";
    this.message = message;
  }
  SiteChatRequestError.prototype = Object.create(Error.prototype);

  function createElement(tagName, className, text) {
    var element = documentRef.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof text === "string") {
      element.textContent = text;
    }
    return element;
  }

  function createSvgElement(name) {
    return documentRef.createElementNS("http://www.w3.org/2000/svg", name);
  }

  function createLauncherIcon() {
    var svg = createSvgElement("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = createSvgElement("path");
    path.setAttribute("d", "M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v6.5A2.75 2.75 0 0 1 16.25 15H11l-3.85 3.1A.75.75 0 0 1 6 17.52V15.1A2.75 2.75 0 0 1 5 12.25v-6.5Z");
    svg.appendChild(path);
    return svg;
  }

  function createMarkIcon() {
    var svg = createSvgElement("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = createSvgElement("path");
    path.setAttribute("d", "M6.5 5.5h11v8h-5.1L8.5 16.6v-3.1h-2V5.5Z");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function createCloseIcon() {
    var svg = createSvgElement("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = createSvgElement("path");
    path.setAttribute("d", "m7 7 10 10M17 7 7 17");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    return svg;
  }
  // Prototype assignments must finish before a script-tag include creates its first instance.
  autoInitialize(installedScript);
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
