import { getViteConfig } from "astro/config";

export default getViteConfig(
	{
		test: {
			include: ["src/**/*.test.ts"],
		},
	} as Parameters<typeof getViteConfig>[0],
	{
		site: "https://natsukium.com",
	},
);
