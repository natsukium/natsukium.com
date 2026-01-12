(() => {
	const STORAGE_KEY = "theme";
	const DEFAULT_THEME =
		document.documentElement.dataset.defaultTheme || "base16-nord";

	function getStoredTheme() {
		try {
			return localStorage.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function setStoredTheme(theme) {
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// localStorage unavailable (private browsing, etc.)
		}
	}

	function applyTheme(theme) {
		const root = document.documentElement;
		// Remove all base16-* classes using classList API
		const toRemove = Array.from(root.classList).filter((c) =>
			c.startsWith("base16-"),
		);
		if (toRemove.length > 0) {
			root.classList.remove(...toRemove);
		}
		root.classList.add(theme);
		setStoredTheme(theme);

		// Update meta theme-color
		const body = document.body;
		if (body) {
			const computedStyles = window.getComputedStyle(body);
			const bgColor = computedStyles.backgroundColor;
			document
				.querySelector("meta[name='theme-color']")
				?.setAttribute("content", bgColor);
		}
	}

	// Apply theme immediately to prevent FOUC
	const theme = getStoredTheme() || DEFAULT_THEME;
	applyTheme(theme);

	// Expose for theme picker
	window.applyTheme = applyTheme;
	window.getStoredTheme = getStoredTheme;
	window.DEFAULT_THEME = DEFAULT_THEME;

	// Handle Astro View Transitions
	document.addEventListener("astro:after-swap", () => {
		applyTheme(getStoredTheme() || DEFAULT_THEME);
	});
})();
