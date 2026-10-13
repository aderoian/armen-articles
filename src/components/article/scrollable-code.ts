/**
 * Expressive Code makes overflowing code blocks focusable, but measures before
 * web fonts finish loading, so blocks that only overflow with the final font
 * stay unreachable by keyboard. Re-measure once fonts are ready and whenever a
 * block resizes.
 */
function update(pre: HTMLElement): void {
	if (pre.scrollWidth > pre.clientWidth) pre.setAttribute('tabindex', '0');
	else pre.removeAttribute('tabindex');
}

export function watchScrollableCode(root: ParentNode = document): void {
	const blocks = [...root.querySelectorAll<HTMLElement>('.expressive-code pre')];
	if (blocks.length === 0) return;
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) update(entry.target as HTMLElement);
	});
	for (const pre of blocks) observer.observe(pre);
	void document.fonts.ready.then(() => blocks.forEach(update));
}
