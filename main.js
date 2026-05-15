const { MarkdownView, Plugin } = require("obsidian");

const RETURN_MODE_CLASS = "scroll-return-mode";
const VISIBLE_CLASS = "visible";
const MOBILE_QUERY = "(max-width: 700px), (max-device-width: 700px)";

module.exports = class EditorScrollReturn extends Plugin {
  async onload() {
    this.savedByScroller = new WeakMap();
    this.currentScroller = null;
    this.removeScrollerListener = null;
    this.mobileQuery = window.matchMedia(MOBILE_QUERY);

    this.createControls();

    this.boundRefresh = () => this.refresh();
    this.boundToggle = () => this.scrollToggle();
    this.boundScrollerScroll = () => this.updateVisibility();

    this.zoneEl.addEventListener("click", this.boundToggle);

    this.registerEvent(this.app.workspace.on("active-leaf-change", this.boundRefresh));
    this.registerEvent(this.app.workspace.on("layout-change", this.boundRefresh));
    this.registerEvent(this.app.workspace.on("file-open", this.boundRefresh));
    this.registerDomEvent(window, "resize", this.boundRefresh);

    if (this.mobileQuery.addEventListener) {
      this.mobileQuery.addEventListener("change", this.boundRefresh);
      this.register(() => this.mobileQuery.removeEventListener("change", this.boundRefresh));
    }

    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  onunload() {
    this.detachScroller();
    this.zoneEl?.remove();
  }

  createControls() {
    this.zoneEl = document.body.createDiv({
      cls: "editor-scroll-return-zone",
      attr: { "aria-hidden": "true" }
    });
  }

  refresh() {
    const scroller = this.getActiveSourceScroller();
    if (scroller !== this.currentScroller) {
      this.attachScroller(scroller);
      this.setReturnMode(false);
    }

    const enabled = Boolean(scroller);
    this.zoneEl.toggleClass("is-enabled", enabled && !this.isMobile());
    this.updateVisibility();
  }

  getActiveSourceScroller() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode?.() !== "source") return null;
    return view.contentEl.querySelector(".markdown-source-view .cm-scroller");
  }

  attachScroller(scroller) {
    this.detachScroller();
    this.currentScroller = scroller;
    if (!scroller) return;

    scroller.addEventListener("scroll", this.boundScrollerScroll, { passive: true });
    this.removeScrollerListener = () => {
      scroller.removeEventListener("scroll", this.boundScrollerScroll);
    };
  }

  detachScroller() {
    if (this.removeScrollerListener) this.removeScrollerListener();
    this.removeScrollerListener = null;
    this.currentScroller = null;
  }

  scrollToggle() {
    const scroller = this.getActiveSourceScroller();
    if (!scroller) return;
    if (scroller !== this.currentScroller) this.attachScroller(scroller);

    const state = this.getState(scroller);
    if (state.savedTop !== null) {
      const safeZone = scroller.clientHeight * 0.1;
      if (scroller.scrollTop <= safeZone) {
        const target = state.savedTop;
        state.savedTop = null;
        this.setReturnMode(false);
        this.scrollTo(scroller, target);
      } else {
        state.savedTop = scroller.scrollTop;
        this.scrollTo(scroller, 0);
      }
    } else {
      state.savedTop = scroller.scrollTop;
      this.setReturnMode(true);
      this.scrollTo(scroller, 0);
    }

    this.updateVisibility();
  }

  getState(scroller) {
    let state = this.savedByScroller.get(scroller);
    if (!state) {
      state = { savedTop: null };
      this.savedByScroller.set(scroller, state);
    }
    return state;
  }

  scrollTo(scroller, top) {
    scroller.scrollTo({ top, behavior: "smooth" });
  }

  setReturnMode(on) {
    this.zoneEl.toggleClass(RETURN_MODE_CLASS, on);
  }

  updateVisibility() {
    const scroller = this.currentScroller;
    const state = scroller ? this.getState(scroller) : null;

    this.zoneEl.toggleClass(VISIBLE_CLASS, Boolean(scroller && !this.isMobile()));
    this.setReturnMode(Boolean(state && state.savedTop !== null));
  }

  isMobile() {
    return this.mobileQuery.matches;
  }
};
