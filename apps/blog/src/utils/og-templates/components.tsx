import { SITE } from "@config";

const ICON_STYLE = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 20,
	height: 20,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "#656d76",
	"stroke-width": 2,
	"stroke-linecap": "round" as const,
	"stroke-linejoin": "round" as const,
	"aria-hidden": true,
	role: "presentation",
};

export const UserIcon = () => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: OG image generation, not rendered in DOM
	<svg {...ICON_STYLE}>
		<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
);

export const DocumentIcon = () => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: OG image generation, not rendered in DOM
	<svg {...ICON_STYLE}>
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		<polyline points="14 2 14 8 20 8" />
		<line x1="16" y1="13" x2="8" y2="13" />
		<line x1="16" y1="17" x2="8" y2="17" />
	</svg>
);

export const CalendarIcon = () => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: OG image generation, not rendered in DOM
	<svg {...ICON_STYLE}>
		<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
		<line x1="16" y1="2" x2="16" y2="6" />
		<line x1="8" y1="2" x2="8" y2="6" />
		<line x1="3" y1="10" x2="21" y2="10" />
	</svg>
);

export const ClockIcon = () => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: OG image generation, not rendered in DOM
	<svg {...ICON_STYLE}>
		<circle cx="12" cy="12" r="10" />
		<polyline points="12 6 12 12 16 14" />
	</svg>
);

export const TagIcon = () => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: OG image generation, not rendered in DOM
	<svg {...ICON_STYLE}>
		<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
		<line x1="7" y1="7" x2="7.01" y2="7" />
	</svg>
);

type MetadataItemProps = {
	icon: JSX.Element;
	text: string;
};

export const MetadataItem = ({ icon, text }: MetadataItemProps) => (
	<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
		{icon}
		{text}
	</span>
);

export const ProfileSection = () => (
	<div
		style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "space-between",
			marginLeft: "48px",
			height: "100%",
		}}
	>
		<img
			src={`https://github.com/${SITE.author}.png`}
			alt="Author profile"
			width={230}
			height={230}
			style={{
				borderRadius: "16px",
			}}
		/>
		<span
			style={{
				fontSize: 22,
				color: "#656d76",
				fontWeight: "bold",
			}}
		>
			{new URL(SITE.website).hostname}
		</span>
	</div>
);
