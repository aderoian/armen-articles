// Loaded synchronously in <head> so the saved or system theme is applied before
// first paint (no flash). Kept as an external file so pages need no inline script.
(function () {
	var root = document.documentElement;
	try {
		var stored = localStorage.getItem('theme');
		var theme =
			stored === 'light' || stored === 'dark'
				? stored
				: window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light';
		root.dataset.theme = theme;
	} catch {
		root.dataset.theme = 'light';
	}
})();
