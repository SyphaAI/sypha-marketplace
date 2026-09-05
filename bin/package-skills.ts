#!/usr/bin/env npx tsx
/**
 * Package every skill directory into a .tar.gz archive for the "skills-latest"
 * GitHub Release.
 *
 * generate-skill-marketplace.ts emits `content: <CONTENT_BASE_URL>/<id>.tar.gz`
 * for every skill, pointing at a release asset that must exist with exactly
 * this name. This script builds those assets; it does not publish them.
 *
 * Usage: npx tsx bin/package-skills.ts [skill-name ...]
 *
 * With no arguments, packages ALL skills. With arguments, packages only the
 * named skills. Output goes to dist/skills-latest/<id>.tar.gz.
 *
 * To publish (requires gh CLI authenticated with push access to the repo):
 *   gh release create skills-latest dist/skills-latest/*.tar.gz \
 *     --title "Skills (latest)" \
 *     --notes "Packaged skill archives consumed by content: URLs in skills/marketplace.yaml."
 *
 * Re-running this script and re-running `gh release create` with the same tag
 * will fail if the release already exists — use `gh release upload
 * skills-latest dist/skills-latest/*.tar.gz --clobber` to update an existing
 * release instead.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

import { repoPathFromBin, listVisibleDirectories } from "./marketplace-generator-utils.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const skillsDir = repoPathFromBin("skills");
const outputDir = path.join(__dirname, "..", "dist", "skills-latest");

const requestedNames = process.argv.slice(2);
const allSkillIds = listVisibleDirectories(skillsDir);
const skillIds = requestedNames.length > 0 ? requestedNames : allSkillIds;

for (const id of skillIds) {
	if (!allSkillIds.includes(id)) {
		throw new Error(`Unknown skill: ${id}`);
	}
}

fs.mkdirSync(outputDir, { recursive: true });

let packaged = 0;
for (const id of skillIds) {
	const skillDir = path.join(skillsDir, id);
	const skillMdPath = path.join(skillDir, "SKILL.md");
	if (!fs.existsSync(skillMdPath)) {
		throw new Error(`${id}: missing SKILL.md — refusing to package an incomplete skill`);
	}

	const archivePath = path.join(outputDir, `${id}.tar.gz`);

	// Flat archive (no wrapper directory) — files land at the tar root, matching
	// what the extension's SimpleInstaller.installSkillArchive expects by default
	// (it also auto-detects a wrapper directory and strips it, so either shape
	// would work, but flat is what the rest of this toolchain assumes).
	execFileSync(
		"tar",
		[
			"-czf",
			archivePath,
			// Exclude local review/patch-control files that shouldn't ship to end
			// users — same files bin/update-skills.ts treats as maintained controls.
			"--exclude=local.patch",
			"--exclude=local.remove",
			"--exclude=.DS_Store",
			"-C",
			skillDir,
			".",
		],
		{ stdio: "inherit" },
	)

	console.log(`Packaged: ${id} -> ${path.relative(process.cwd(), archivePath)}`)
	packaged++
}

console.log(`\nPackaged ${packaged} skill${packaged === 1 ? "" : "s"} into ${path.relative(process.cwd(), outputDir)}`)
console.log("Not published — see this file's header comment for the gh release command.")
