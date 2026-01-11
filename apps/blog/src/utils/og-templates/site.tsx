import { SITE } from "@config";
import satori from "satori";
import type { SiteOgOptions } from "../generateOgImages";
import loadGoogleFonts, { type FontOptions } from "../loadGoogleFont";
import {
	DocumentIcon,
	MetadataItem,
	ProfileSection,
	TagIcon,
	UserIcon,
} from "./components";

export default async ({ postCount, topTags }: SiteOgOptions) => {
	const tagsText = topTags
		.slice(0, 3)
		.map((tag) => `#${tag}`)
		.join("  ");
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
							{SITE.author}/
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
							{SITE.title}
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
						{SITE.desc}
					</p>
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						fontSize: 20,
						color: "#656d76",
						gap: "24px",
					}}
				>
					<MetadataItem icon={<UserIcon />} text={SITE.author} />
					<MetadataItem icon={<DocumentIcon />} text={`${postCount} posts`} />
					{topTags.length > 0 && (
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
				`${SITE.author}/${SITE.title}${SITE.desc}${postCount} posts${tagsText}#${new URL(SITE.website).hostname}`,
			)) as FontOptions[],
		},
	);
};
