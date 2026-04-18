import { u as useSearch, j as jsxDevRuntimeExports } from "./router-BVmsU_2r.js";
import { S as React, r as reactExports } from "../server.js";
import { h as useStravaCallback } from "./index-DVW_SsYI.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
const page = "_page_1luf7_1";
const card = "_card_1luf7_10";
const centered = "_centered_1luf7_19";
const errorTitle = "_errorTitle_1luf7_23";
const successTitle = "_successTitle_1luf7_24";
const message = "_message_1luf7_38";
const errorButton = "_errorButton_1luf7_44";
const successIcon = "_successIcon_1luf7_60";
const loadingState = "_loadingState_1luf7_67";
const spinner = "_spinner_1luf7_71";
const loadingText = "_loadingText_1luf7_81";
const styles = {
  page,
  card,
  centered,
  errorTitle,
  successTitle,
  message,
  errorButton,
  successIcon,
  loadingState,
  spinner,
  loadingText
};
function StatusLayout({
  children,
  centered: centered2 = false
}) {
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.page, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: `${styles.card} ${centered2 ? styles.centered : ""}`.trim(), children }, void 0, false, {
    fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
    lineNumber: 22,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
    lineNumber: 21,
    columnNumber: 5
  }, this);
}
function CallbackPage() {
  const search = useSearch({ from: "/auth/strava/callback" });
  const [status, setStatus] = React.useState("loading");
  const [errorMsg, setErrorMsg] = React.useState("");
  const hasCalledRef = React.useRef(false);
  const callbackMutation = useStravaCallback(search.code || "");
  reactExports.useEffect(() => {
    if (search.error) {
      setStatus("error");
      setErrorMsg(search.error_description || search.error);
      return;
    }
    if (search.code && !hasCalledRef.current) {
      hasCalledRef.current = true;
      setStatus("loading");
      callbackMutation.mutate(void 0, {
        onSuccess: () => {
          setStatus("success");
          setTimeout(() => {
            window.location.replace("/dashboard");
          }, 1500);
        },
        onError: (error) => {
          setStatus("error");
          setErrorMsg(error.message || "Authentication failed");
        }
      });
    }
  }, [search.code, search.error, search.error_description, callbackMutation]);
  if (search.error) {
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(StatusLayout, { children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { className: styles.errorTitle, children: "Authentication Failed" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 63,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.message, children: errorMsg }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 64,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("a", { href: "/", className: styles.errorButton, children: "Back to Login" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 65,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
      lineNumber: 62,
      columnNumber: 7
    }, this);
  }
  if (status === "success") {
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(StatusLayout, { centered: true, children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.successIcon, children: "✓" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 75,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { className: styles.successTitle, children: "Success!" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 76,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.message, children: "Your Strava account has been connected. Redirecting to dashboard..." }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 77,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
      lineNumber: 74,
      columnNumber: 7
    }, this);
  }
  if (status === "error") {
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(StatusLayout, { children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { className: styles.errorTitle, children: "Authentication Failed" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 87,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.message, children: errorMsg }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 88,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("a", { href: "/", className: styles.errorButton, children: "Back to Login" }, void 0, false, {
        fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
        lineNumber: 89,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
      lineNumber: 86,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.page, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.loadingState, children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: styles.spinner }, void 0, false, {
      fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
      lineNumber: 99,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: styles.loadingText, children: "Processing authentication..." }, void 0, false, {
      fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
      lineNumber: 100,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
    lineNumber: 98,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/wmarchant/Secund.io/src/components/CallbackPage/index.tsx",
    lineNumber: 97,
    columnNumber: 5
  }, this);
}
const SplitComponent = CallbackPage;
export {
  SplitComponent as component
};
