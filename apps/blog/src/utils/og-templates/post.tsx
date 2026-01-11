import type { CollectionEntry } from "astro:content";
import { SITE } from "@config";
import satori from "satori";
import loadGoogleFonts, { type FontOptions } from "../loadGoogleFont";
import {
	CalendarIcon,
	ClockIcon,
	DocumentIcon,
	MetadataItem,
	ProfileSection,
	TagIcon,
	UserIcon,
} from "./components";

const formatDate = (date: Date): string => {
	return date.toISOString().split("T")[0];
};

const calcReadingTime = (charCount: number): string => {
	const charsPerMinute = 500;
	const minutes = Math.ceil(charCount / charsPerMinute);
	return `${minutes} min`;
};

export default async (post: CollectionEntry<"blog">) => {
	const tags = post.data.tags.slice(0, 3);
	const tagsText = tags.map((tag) => `#${tag}`).join("  ");
	const dateText = formatDate(post.data.pubDatetime);
	const charCount = post.body?.length ?? 0;
	const readingTime = calcReadingTime(charCount);

	return satori(
		<div
			style={{
				background: "#ffffff",
				width: "100%",
				height: "100%",
				display: "flex",
				padding: "72px",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					flex: 1,
					height: "100%",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							height: "230px",
						}}
					>
						<p
							style={{
								fontSize: 40,
								color: "#656d76",
								marginBottom: "4px",
							}}
						>
							{SITE.title}/
						</p>

						<p
							style={{
								fontSize: 48,
								fontWeight: "bold",
								color: "#1f2328",
								lineHeight: 1.3,
								overflow: "hidden",
							}}
						>
							{post.data.title}
						</p>
					</div>

					<p
						style={{
							fontSize: 24,
							color: "#656d76",
							marginTop: "16px",
							lineHeight: 1.6,
							maxHeight: "120px",
							overflow: "hidden",
						}}
					>
						{post.data.description}
					</p>
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						flexWrap: "wrap",
						fontSize: 20,
						color: "#656d76",
						gap: "24px",
					}}
				>
					<MetadataItem icon={<UserIcon />} text={SITE.author} />
					<MetadataItem icon={<CalendarIcon />} text={dateText} />
					<MetadataItem
						icon={<DocumentIcon />}
						text={`${charCount.toLocaleString()} chars`}
					/>
					<MetadataItem icon={<ClockIcon />} text={readingTime} />
					{tags.length > 0 && (
						<MetadataItem icon={<TagIcon />} text={tagsText} />
					)}
				</div>
			</div>

			<ProfileSection />
		</div>,
		{
			width: 1200,
			height: 630,
			embedFont: true,
			fonts: (await loadGoogleFonts(
				`${SITE.title}/${post.data.title}${post.data.description}${SITE.author}${tagsText}${dateText}#${charCount.toLocaleString()} chars${readingTime}${new URL(SITE.website).hostname}`,
			)) as FontOptions[],
		},
	);
};
