import { j as jsxDevRuntimeExports } from "./router-BVmsU_2r.js";
import { g as useStravaLogin } from "./index-DVW_SsYI.js";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
const page = "_page_18d4e_1";
const card = "_card_18d4e_10";
const header = "_header_18d4e_20";
const title = "_title_18d4e_25";
const subtitle = "_subtitle_18d4e_33";
const panel = "_panel_18d4e_39";
const panelTitle = "_panelTitle_18d4e_47";
const panelText = "_panelText_18d4e_54";
const button = "_button_18d4e_61";
const footer = "_footer_18d4e_88";
const styles = {
  page,
  card,
  header,
  title,
  subtitle,
  panel,
  panelTitle,
  panelText,
  button,
  footer
};
function LoginPage() {
  const { mutate: login, isPending } = useStravaLogin();
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.page, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.card, children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.header, children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { className: styles.title, children: "Secund.io" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
        lineNumber: 11,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.subtitle, children: "Track your Strava activities" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
        lineNumber: 12,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
      lineNumber: 10,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.panel, children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { className: styles.panelTitle, children: "Get Started" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
        lineNumber: 16,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.panelText, children: "Connect your Strava account to view and track your activities." }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
        lineNumber: 17,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        "button",
        {
          onClick: () => login(),
          disabled: isPending,
          className: styles.button,
          children: isPending ? "Redirecting..." : "Connect with Strava"
        },
        void 0,
        false,
        {
          fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
          lineNumber: 21,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
      lineNumber: 15,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.footer, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: "By connecting, you agree to our terms of service and privacy policy." }, void 0, false, {
      fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
      lineNumber: 31,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
      lineNumber: 30,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
    lineNumber: 9,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/wmarchant/Secund.io/src/components/LoginPage/index.tsx",
    lineNumber: 8,
    columnNumber: 5
  }, this);
}
const SplitComponent = LoginPage;
export {
  SplitComponent as component
};
