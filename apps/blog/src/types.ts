import type socialIcons from "@assets/socialIcons";

export type Site = {
	website: string;
	author: string;
	profile: string;
	desc: string;
	title: string;
	ogImage?: string;
	/** Default base16 theme slug (e.g., "base16-nord") */
	defaultTheme: string;
	postPerIndex: number;
	postPerPage: number;
	scheduledPostMargin: number;
	showArchives?: boolean;
	editPost?: {
		url?: URL["href"];
		text?: string;
		appendFilePath?: boolean;
	};
};

export type Theme = {
	name: string;
	slug: string;
	variant: "dark" | "light";
	colors: string[];
};

export type SocialObjects = {
	name: keyof typeof socialIcons;
	href: string;
	active: boolean;
	linkTitle: string;
}[];
