import type { Heading, Root, Text } from "mdast";
import type { Plugin } from "unified";

/**
 * A remark plugin that adds visual heading markers (##, ###, etc.) to the rendered heading text.
 *
 * This plugin traverses the markdown AST and prepends hash symbols to heading text content,
 * making the markdown syntax visible in the rendered output.
 *
 * @example
 * Input:  ## Second Level Heading
 * Output: <h2>## Second Level Heading</h2>
 *
 * @example
 * Input:  ### Third Level Heading
 * Output: <h3>### Third Level Heading</h3>
 */
const remarkHeadingMarkers: Plugin<[], Root> = () => {
	return (tree) => {
		visitNode(tree);
	};
};

/**
 * Recursively visits all nodes in the AST tree and processes heading nodes.
 *
 * This function traverses the AST without using external dependencies like unist-util-visit.
 * When it encounters a heading node, it adds the appropriate number of hash symbols
 * to the beginning of the first text node.
 *
 * @param node - The AST node to visit
 */
function visitNode(node: Root | Heading | Text | any): void {
	if (node.type === "heading") {
		addMarkerToHeading(node as Heading);
	}

	// Recursively visit children if they exist
	if (node.children && Array.isArray(node.children)) {
		for (const child of node.children) {
			visitNode(child);
		}
	}
}

/**
 * Adds hash symbol markers to the beginning of a heading's text content.
 *
 * The number of hash symbols matches the heading depth (e.g., h2 = ##, h3 = ###).
 * Only modifies the first text node found in the heading's children.
 *
 * @param heading - The heading node to modify
 */
function addMarkerToHeading(heading: Heading): void {
	// Generate the marker based on heading depth (1-6)
	const marker = "#".repeat(heading.depth) + " ";

	// Find the first text node in the heading's children
	const firstTextNode = findFirstTextNode(heading.children);

	if (firstTextNode) {
		// Prepend the marker to the text content
		firstTextNode.value = marker + firstTextNode.value;
	}
}

/**
 * Finds the first text node in an array of AST nodes.
 *
 * Recursively searches through the node tree to find a text node,
 * which is where we'll add the heading marker.
 *
 * @param nodes - Array of AST nodes to search
 * @returns The first text node found, or undefined if none exists
 */
function findFirstTextNode(nodes: any[]): Text | undefined {
	for (const node of nodes) {
		if (node.type === "text") {
			return node as Text;
		}

		// Recursively search in children
		if (node.children && Array.isArray(node.children)) {
			const textNode = findFirstTextNode(node.children);
			if (textNode) {
				return textNode;
			}
		}
	}

	return undefined;
}

export default remarkHeadingMarkers;
