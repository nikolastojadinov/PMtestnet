import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global startup error capture to diagnose blank screen in Pi Browser (iOS)
// This runs before React renders, so we can display a visible overlay
// even if the app fails during initial load.
if (typeof window !== "undefined") {
	(function setupStartupErrorOverlay() {
		const w = window as any;
		const OVERLAY_ID = "pm-startup-error-overlay";

		function ensureOverlay(): HTMLDivElement {
			let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
			if (!el) {
				el = document.createElement("div");
				el.id = OVERLAY_ID;
				el.setAttribute("role", "alert");
				el.style.position = "fixed";
				el.style.inset = "0";
				el.style.background = "rgba(0,0,0,0.9)";
				el.style.color = "#ffb4b4";
				el.style.zIndex = "999999";
				el.style.display = "flex";
				el.style.alignItems = "center";
				el.style.justifyContent = "center";
				el.style.padding = "24px";
				el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
				el.style.fontSize = "14px";
				el.style.textAlign = "left";
				el.style.whiteSpace = "pre-wrap";
				document.documentElement.appendChild(el);
			}
			return el;
		}

		function show(msg: string) {
			try {
				const el = ensureOverlay();
				el.innerHTML = "";
				const box = document.createElement("div");
				box.style.maxWidth = "900px";
				box.style.width = "100%";
				box.style.border = "1px solid rgba(239,68,68,0.6)";
				box.style.background = "#1a0000";
				box.style.borderRadius = "8px";
				box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.6)";
				box.style.padding = "16px";

				const title = document.createElement("div");
				title.textContent = "App failed to load";
				title.style.color = "#fecaca";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";

				const hint = document.createElement("div");
				hint.textContent = "A runtime error happened during startup. Details:";
				hint.style.color = "#fca5a5";
				hint.style.marginBottom = "8px";

				const pre = document.createElement("pre");
				pre.textContent = String(msg || "Unknown error");
				pre.style.margin = "0";
				pre.style.color = "#fca5a5";

				box.appendChild(title);
				box.appendChild(hint);
				box.appendChild(pre);
				el.appendChild(box);
			} catch (e) {
				// as a last resort, use alert (not ideal but ensures visibility)
				try { alert("App failed to load: " + (msg || "Unknown error")); } catch {}
			}
		}

		// keep the latest message available to the app once it mounts
		w.__pmLastError = null;

		window.addEventListener("error", (event: ErrorEvent) => {
			const detail = event?.error instanceof Error
				? (event.error.stack || event.error.message)
				: (event?.message || String(event));
			w.__pmLastError = detail;
			if (import.meta.env.DEV) console.error("Startup error:", detail, event);
			show(detail);
		});

		window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
			const reason = event?.reason instanceof Error
				? (event.reason.stack || event.reason.message)
				: String(event?.reason ?? "Unhandled promise rejection");
			w.__pmLastError = reason;
			if (import.meta.env.DEV) console.error("Unhandled rejection:", reason, event);
			show(reason);
		});
	})();
}

// Mark when React actually mounts to disable watchdog overlay
if (typeof window !== 'undefined') {
	try { (window as any).__appMounted = true; } catch {}
}
createRoot(document.getElementById("root")!).render(<App />);
