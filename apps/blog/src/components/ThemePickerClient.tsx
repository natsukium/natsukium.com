import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme } from "../types";

declare global {
	interface Window {
		applyTheme: (theme: string) => void;
		getStoredTheme: () => string | null;
		DEFAULT_THEME: string;
	}
}

interface Props {
	themes: Theme[];
}

export default function ThemePickerClient({ themes }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const [currentTheme, setCurrentTheme] = useState<string>("");
	const [searchQuery, setSearchQuery] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const filteredThemes = themes.filter(
		(t) =>
			t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.slug.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// Sort: by variant (dark first), then by name
	const sortedThemes = [...filteredThemes].sort((a, b) => {
		if (a.variant !== b.variant) {
			return a.variant === "dark" ? -1 : 1;
		}
		return a.name.localeCompare(b.name);
	});

	useEffect(() => {
		const stored = window.getStoredTheme?.() || window.DEFAULT_THEME;
		setCurrentTheme(stored);
	}, []);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			// Focus search input when dropdown opens
			requestAnimationFrame(() => {
				searchInputRef.current?.focus();
				// Scroll to current theme
				const currentItem = dropdownRef.current?.querySelector(
					`[data-theme="${currentTheme}"]`,
				);
				currentItem?.scrollIntoView({ block: "center" });
			});
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, currentTheme]);

	// Reset focused index when search changes
	useEffect(() => {
		setFocusedIndex(-1);
	}, [searchQuery]);

	const handleThemeSelect = useCallback((slug: string) => {
		window.applyTheme?.(slug);
		setCurrentTheme(slug);
		setIsOpen(false);
		setSearchQuery("");
		setFocusedIndex(-1);
	}, []);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (!isOpen) return;

			switch (event.key) {
				case "Escape":
					event.preventDefault();
					setIsOpen(false);
					setSearchQuery("");
					setFocusedIndex(-1);
					break;
				case "ArrowDown":
					event.preventDefault();
					setFocusedIndex((prev) =>
						prev < sortedThemes.length - 1 ? prev + 1 : 0,
					);
					break;
				case "ArrowUp":
					event.preventDefault();
					setFocusedIndex((prev) =>
						prev > 0 ? prev - 1 : sortedThemes.length - 1,
					);
					break;
				case "Enter":
					event.preventDefault();
					if (focusedIndex >= 0 && focusedIndex < sortedThemes.length) {
						handleThemeSelect(sortedThemes[focusedIndex].slug);
					}
					break;
			}
		},
		[isOpen, sortedThemes, focusedIndex, handleThemeSelect],
	);

	// Scroll focused item into view
	useEffect(() => {
		if (focusedIndex >= 0 && listRef.current) {
			const items = listRef.current.querySelectorAll("[role='option']");
			items[focusedIndex]?.scrollIntoView({ block: "nearest" });
		}
	}, [focusedIndex]);

	const currentThemeData = themes.find((t) => t.slug === currentTheme);

	return (
		<div
			className="relative"
			ref={dropdownRef}
			onKeyDown={handleKeyDown}
			role="combobox"
			aria-expanded={isOpen}
			aria-controls="theme-listbox"
			tabIndex={-1}
		>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="focus-outline flex items-center gap-1 p-3 sm:p-1"
				aria-label="Select theme"
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				title={currentThemeData?.name}
			>
				{currentThemeData && (
					<div className="flex">
						{currentThemeData.colors.slice(0, 8).map((color, i) => (
							<div
								key={`${currentThemeData.slug}-btn-${i}`}
								className="h-4 w-2 first:rounded-l last:rounded-r sm:h-3 sm:w-1.5"
								style={{ backgroundColor: color }}
							/>
						))}
					</div>
				)}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fillRule="evenodd"
						d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
						clipRule="evenodd"
					/>
				</svg>
			</button>

			{isOpen && (
				<div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-300 bg-100 shadow-lg">
					<div className="p-2">
						<input
							ref={searchInputRef}
							type="text"
							placeholder="Search themes..."
							className="w-full rounded border border-300 bg-100 px-3 py-1.5 text-sm text-600 placeholder:text-400 focus:border-blue focus:outline-none"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							aria-label="Search themes"
							aria-controls="theme-listbox"
							aria-activedescendant={
								focusedIndex >= 0
									? `theme-option-${sortedThemes[focusedIndex]?.slug}`
									: undefined
							}
						/>
					</div>
					<div
						ref={listRef}
						id="theme-listbox"
						role="listbox"
						className="max-h-80 overflow-y-auto p-2 pt-0"
						aria-label="Available themes"
					>
						{sortedThemes.map((theme, index) => (
							<div
								key={theme.slug}
								id={`theme-option-${theme.slug}`}
								role="option"
								data-theme={theme.slug}
								aria-selected={currentTheme === theme.slug}
								tabIndex={-1}
								className={`cursor-pointer rounded ${
									index === focusedIndex ? "ring-2 ring-blue" : ""
								}`}
							>
								<button
									type="button"
									onClick={() => handleThemeSelect(theme.slug)}
									onMouseEnter={() => setFocusedIndex(index)}
									className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-200 ${
										currentTheme === theme.slug ? "bg-200" : ""
									}`}
									title={theme.name}
									tabIndex={-1}
								>
									<div className="flex shrink-0 flex-col gap-0.5">
										<div className="flex">
											{theme.colors.slice(0, 8).map((color, i) => (
												<div
													key={`${theme.slug}-top-${i}`}
													className="h-2.5 w-2.5 first:rounded-tl last:rounded-tr"
													style={{ backgroundColor: color }}
												/>
											))}
										</div>
										<div className="flex">
											{theme.colors.slice(8, 16).map((color, i) => (
												<div
													key={`${theme.slug}-bot-${i}`}
													className="h-2.5 w-2.5 first:rounded-bl last:rounded-br"
													style={{ backgroundColor: color }}
												/>
											))}
										</div>
									</div>
									<span className="truncate text-600">{theme.name}</span>
									<span className="ml-auto shrink-0 text-xs text-400">
										{theme.variant}
									</span>
								</button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
