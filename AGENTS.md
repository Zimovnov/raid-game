# AGENTS.md — RAID GAME

> Standing instructions for Codex and other AI development agents. This document defines the project's long-term vision, visual identity, development principles, and quality standards. It is **not** a specification for one particular release, engine, or code layout. Follow it when planning, implementing, testing, and shipping changes.

## 1. Project vision and identity

**RAID GAME** is an evolving, first-person tactical extraction shooter focused on believable combat, exploration, looting, survival, equipment preparation, and extraction. The goal is a deep, tense, atmospheric game rather than a simplified arcade shooter.

- **Escape from Tarkov is the primary gameplay reference:** raid tension, risk and reward, equipment preparation, detailed weapons, medical systems, sound, ballistics, and interacting game systems.
- **Gray Zone Warfare is another major reference:** a believable world, the scale and organization of locations, tactical movement, environmental interactions, and enemy behavior.
- Other useful references include **S.T.A.L.K.E.R., Ground Branch, Ready or Not, Squad, Arma, and Insurgency: Sandstorm** when their design approaches fit a particular problem.
- Learn from mechanics and design principles, **not** by copying other games' maps, missions, interfaces, models, audio, text, logos, or other distinctive content.
- The game must develop **its own identity**. References inform the direction; they do not replace original design.
- **Realism is the goal, not an excuse for poor usability.** Favor plausible causes and consequences while preserving readable feedback, fair rules, meaningful decisions, and enjoyable play.
- Some existing code and archives may use the name **REID**. Treat that as part of the project's history; do not rename products, identifiers, or paths without an explicit request.

## 2. Repository layout, documentation, and version history

- The main project directory is **`raid-game/`**. Place this file at **`raid-game/AGENTS.md`**.
- The **`Versions/`** directory contains different historical versions of the game, potentially including source code, builds, snapshots, and reference material.
- Before making changes, **identify the active development copy** from the user's instructions, repository structure, and project documentation. Never assume a familiar-looking folder inside `Versions/` is the active project.
- Do not delete, overwrite, rename, or clean up historical versions without explicit approval. They exist for comparison and recovery.
- Create a numbered snapshot or release in `Versions/` **when a release is requested**; include meaningful change notes, known limitations, and reproducible build instructions. Do not duplicate the entire project for every small edit.
- Do not rename `raid-game/` or restructure `Versions/` on your own initiative.
- Do not tie this file to a fixed release, engine, framework, directory listing, or feature inventory. Investigate the actual active implementation before assuming its structure.

### Existing-project source of truth

When these files are present in the active project, read them **before changing gameplay or architecture**:

1. `docs/ORIGINAL_SPEC_RU.md` — the authoritative full product brief for the existing implementation. Preserve its intended scope unless the user explicitly changes it.
2. `IMPLEMENTATION_STATUS.md` — what is already implemented, incomplete, or intentionally deferred.
3. `TEST_REPORT.md` — known results, limitations, and the actual coverage of prior verification.

If one of these files is missing, do not invent its contents or block unrelated work; inspect the available documentation and report the gap when relevant. User instructions for the current task take priority when they explicitly revise earlier requirements.

## 3. Visual direction: detailed low-poly 3D

The game's defining art direction is **low-poly 3D with believable proportions, recognizable silhouettes, convincing textures, materials, lighting, and atmosphere**. Low-poly is an artistic and performance choice, **not** permission to leave the world as untextured cubes or gray-box placeholders.

- Maintain a consistent visual language across environments, weapons, characters, equipment, props, effects, and UI. Avoid random mixtures of photorealistic, cartoon, and incompatible styles.
- **Use textures deliberately.** Wood, concrete, steel, plastic, fabric, dirt, asphalt, corrosion, wear, and other surfaces should have suitable material detail. Flat colors are acceptable when artistically justified, not as a default final result.
- Where supported, use a practical PBR-style material workflow: base color, roughness, metallic response, and normal maps. Otherwise achieve comparable readability within the current renderer's capabilities.
- Verify UVs, texture scale, tiling, seams, filtering, and distance-appropriate texture resolution.
- Keep objects immediately recognizable: firearms and attachments, magazines, armor, backpacks, containers, doors, buildings, vehicles, vegetation, and terrain.
- Spend geometry on important silhouettes and close-up first-person details; represent smaller surface details with textures when appropriate.
- Improve lighting, shadows, weather, sky, fog, visibility distance, and environmental storytelling without sacrificing combat readability.
- Make spaces believable: buildings have a purpose, roads connect useful places, and loot or props have sensible locations.
- **Animate meaningful actions:** walking, sprinting, crouching, jumping, aiming down sights, recoil, weapon switching, reloading, healing, impacts, and environmental interactions. Shared animation foundations are fine, but distinct weapons/actions should not feel identical when differences matter.
- Use muzzle flashes, ejected casings, dust, bullet impacts, smoke, and other feedback with restraint. Effects should clarify events, not hide targets.
- Prefer **one polished, integrated object** with correct materials and animation over many unfinished decorative assets.

## 4. Free assets, licensing, and provenance

Agents **may independently search for, download, import, modify, and optimize suitable free 3D assets, textures, materials, animations, and sounds** using available tools. Routine lawful downloads do not need separate approval, provided all of these rules are met:

1. Use resources with **clear rights** for the intended use, including modification, redistribution in game builds, and potential commercial use. **Free to download does not mean free to redistribute.**
2. Prefer **CC0/public domain** or equivalently permissive resources. **CC BY** resources are acceptable with correct attribution. Avoid **NC** assets in a potentially commercial game, and avoid **ND** assets when modification is needed, unless separate permission is obtained.
3. Record **asset title, creator, source URL, license, required attribution, and modifications**. Maintain the existing **`public/asset-manifest.json`** provenance registry for imported assets; create or update it when appropriate in the active project. Keep a human-readable companion such as **`docs/ASSET_CREDITS.md`** when useful. Include legally required notices and license texts.
4. Permitted operations, subject to the license, include retopology, mesh simplification, UV editing, LOD creation, material changes, texturing, resizing, animation, and format conversion.
5. Choose formats compatible with the existing asset pipeline (for example, glTF/GLB or PNG/WebP **if supported**). Do not introduce a new engine just to use one asset.
6. Check polygon counts, material count, draw calls, texture sizes, download weight, memory usage, and FPS impact. Import optimized runtime assets, not unnecessarily huge source packages.
7. **Never use ripped commercial-game content**, leaked resources, unauthorized brand materials, or files with unclear provenance. Do not add or distribute font files as game assets.
8. If a resource or license cannot be verified, create an original/procedural alternative or clearly explain the blocker. Never claim an asset was downloaded or integrated if it was not.
9. New assets must be **used in the actual game**, not merely copied into the repository. Validate paths, loading, scale, UVs, materials, lighting, collisions, animations, and first-person appearance.

Possible places to research include **Poly Haven, Kenney, Quaternius, and OpenGameArt**. Verify each asset's individual license; the website's reputation is not sufficient.

## 5. Authentic naming and believable worldbuilding

- Prefer **realistic, accurate names** for weapon systems, calibers, ammunition types, attachments, protective equipment, medical supplies, materials, and tactical actions. Do not leave generic placeholders such as "Gun 3" or "Super Ammo" in shipping content.
- Validate the **consistency of in-game designations and relationships**: weapon/ammunition categories, magazine or mount compatibility, approximate dimensions and mass, armor categories, and medical item purpose. Do not present invented balancing numbers as verified real-world specifications.
- Use a consistent localization convention. Established Russian terminology may coexist with correct original model designations where appropriate.
- Invented brands or terms are welcome when they are internally consistent and plausible within the game's own world.
- Real names do not grant rights to logos, promotional artwork, or brand identity. Use neutral presentation when necessary; do not fabricate branded compatibility claims.
- Keep factions, traders, characters, locations, quests, and dialogue grounded and internally consistent.
- Research for authenticity must remain **game-design research**; do not add real-world weapon-manufacturing instructions or other manufacturing guides to the project.

## 6. Gameplay philosophy and development priorities

**Every new mechanic should create meaningful choices, understandable risks, and consequences.** Prefer depth and interaction between systems over accumulating disconnected items, menus, and gimmicks.

Develop the following areas as appropriate to the user's task and the game's current maturity; **this is a direction, not a request to build all of them at once**:

- **Weapons and gunplay:** believable trajectories and impacts, recoil, weapon handling, ammunition differences, cover, material penetration, fire modes, chamber state, magazines, sighting, and attachment customization.
- **Survival and medical gameplay:** injuries, bleeding, limb trauma, pain, treatment, stamina, exhaustion, hydration, carried weight, and other states **when they affect tactical decisions**.
- **Equipment choices:** trade-offs among protection, mobility, carry capacity, ammunition, weapon setup, medical items, cost, and availability.
- **Raids and extraction:** preparation, meaningful danger, valuable exploration, interesting loot, clear extraction conditions, death/extraction consequences, and reasons to return.
- **Environments:** coherent layouts, varied combat ranges, verticality, cover, flank routes, landmarks, buildings with purpose, and atmospheric events.
- **Enemy AI:** constrained vision/hearing, responses to noise and evidence, investigation, pursuit, target loss, cover, flanking, cooperation, and differences in training. **No omniscient wall vision.**
- **Progression and economy:** traders, quests, item access, prices, scarcity, wear, and risk/reward balance without pointless grind or trivial wealth accumulation.
- **Sound:** surface-dependent footsteps, distance, indoor/outdoor acoustics, suppression, echoes, positional cues, and equipment interaction. Audio should provide usable tactical information.
- **Player feedback:** responsive controls, readable HUD and prompts, coherent stash/gunsmith interfaces, understandable state changes, and polished transitions.

### When realism conflicts with playability

1. Research the real behavior or how credible genre references represent it.
2. Identify the **decision, tension, or risk** it adds to the player experience.
3. Implement the best approximation compatible with the active engine, performance budget, and project scope.
4. Avoid complexity for its own sake. Even a punishing game should make failure understandable.
5. Tune by tests and observable play, rather than choosing arbitrary values solely because they sound realistic.

## 7. Agent autonomy and working method

- **Continue the existing game.** Do not replace it with a new game, a mockup, or a landing page. Do not rewrite it from scratch or switch engines without a compelling reason and explicit approval.
- Inspect the active code, documentation, previous versions, feature status, and reported problems **before** proposing a replacement implementation. Do not duplicate functionality that already exists.
- For broad requests such as "continue development" or "add mechanics," independently prioritize and **finish coherent improvements**. Consider impact on the gameplay loop, regression risk, implementation cost, and dependencies.
- For substantial changes, make a brief plan. Fix serious bugs and finish broken existing systems before adding large amounts of new content.
- Research game mechanics, weapon terminology, equipment, tactics, level design, AI, and suitable art references as needed. Distinguish verified facts from gameplay approximations.
- You may create original meshes, materials, textures, animations, effects, and sounds, or integrate legally suitable third-party resources. Avoid primitive placeholders when a better practical solution exists.
- Preserve existing gameplay, content, saves, and unfinished work. Never destroy other contributors' uncommitted changes or perform destructive Git operations, version-folder cleanup, publishing, or external service actions without approval.
- Prefer maintainable, incremental changes. Do not expand a one-file task into an unrelated architectural rewrite.
- Do not introduce unnecessary dependencies, paid services, secrets, or new recurring costs without justification and approval.

## 8. Architecture and simulation invariants

The engine and filenames may change over time, but **separation of responsibilities and consistency of game state must survive**:

- Keep **domain rules, game simulation, presentation/rendering, networking, and persistence** clearly separated. Share authoritative rule definitions and validation rather than duplicating competing implementations.
- Treat current weapon state as an authoritative model. Where the existing implementation uses **shared virtual weapon layouts**, preserve and reuse that model and its validation.
- **Do not introduce a second ammunition counter on a firearm** for rounds already represented in detachable magazines or other inventory entities. Chamber state and ammunition ownership must remain consistent with the active weapon model.
- **Preserve stable item IDs**, ownership, item provenance, inventory transfers, and the relationship between equipment and stored items. No accidental item duplication or disappearance.
- Preserve **pre-raid escrow** and **idempotent raid-result transactions** wherever implemented. Death, extraction, disconnects, retries, and persistence failures must not create contradictory outcomes or double payouts.
- Any save-schema change requires **backups and either backward compatibility or a clearly defined safe migration**. Never silently wipe a player's progress.
- If the project has multiplayer or co-op, protect authoritative game state. Do not trust a client to dictate arbitrary damage, loot awards, or raid outcomes. Validate synchronization, disconnects, repeated packets, and retries.
- Avoid shared mutable state that leaks between raids. Reset temporary action, camera, input, AI, and presentation state at appropriate lifecycle boundaries.
- Never disable tests, suppress errors, or bypass validation merely to make a build appear green.

## 9. Definition of done for a mechanic or feature

A feature is complete only when it covers the **whole player-facing experience**:

1. **Player scenario:** exactly what the player does, under which conditions, and why the mechanic matters.
2. **Rules and costs:** availability, timing, interruptions, consumed resources, effects, edge cases, and errors.
3. **Integration:** existing controls, systems, inventory, quests, saves, rendering, and networking where relevant.
4. **Presentation:** visible actions, appropriate animation, materials/effects, sound, and comprehensible feedback.
5. **Failure paths:** death, extraction, cancellation, insufficient resources, disconnect, retry, reloading a save, and repeated interactions where applicable.
6. **Verification:** suitable automated checks plus playable scenarios wherever an actual runtime is available.
7. **Documentation:** changes, dependencies, new assets and their licenses, limitations, and reproduction steps.

**Do not call a mechanic finished** if it only has a UI button, only works in a standalone demo, lacks essential animation/model integration, or fails the main gameplay scenario.

## 10. Performance, correctness, and world quality

- Prioritize **responsive input, predictable movement, solid collision, fair hit detection, and stable frame pacing**. Avoid effects that obstruct aiming or create needless input lag.
- Keep inventory, ammunition, currency, loot, quests, experience, and raid results consistent under errors and retries.
- Optimize polygon count, draw calls, textures, animation, AI, loading, and rendering for the actual target hardware. Provide scalable settings or graceful degradation where useful.
- Do not reduce the visual quality of important assets without evidence; equally, do not sacrifice FPS for barely noticeable decoration.
- When editing maps, preserve navigable paths, spawns, loot accessibility, functioning extraction zones, and ways out of geometry traps.
- When editing AI, check perception, obstacle handling, navigation, target loss, stuck behavior, and whether enemy hits are fair.
- When editing assets, verify their appearance **inside the running game**, not just in an isolated preview.

## 11. Testing, verification, and honest reporting

Before closing a task:

- Confirm the **active** project builds and starts following its current instructions.
- Run the checks actually provided by that project. For the existing REID toolchain, run **`npm run verify`** after changes **if the active project still exposes that script**. Run applicable tests, type checks, linting, and builds without inventing commands.
- Exercise the affected gameplay flow: combat, interactions, injuries, item transfer, death/extraction, saving/loading, repeated raids, or map transitions as appropriate.
- For models/textures/effects, inspect runtime scale, UVs, shading, animation, transparency, collision, distance appearance, and performance.
- For networking, test co-op state and reconnect/retry behavior in the available environment.
- **Be precise about verification scope:** browser gameplay, native GLES shader/frame rendering, protocol fixtures, and real RTC multiplayer sessions are **not interchangeable**. A shader screenshot or simulated network protocol does not prove that a real online raid works.
- Never modify or weaken **managed browser security policies** to force a test to run.
- Clearly label checks as **PASSED**, **FAILED**, **BLOCKED**, or **NOT RUN**. Do not report an untested browser feature, production environment, animation, or multiplayer scenario as verified.
- Fix underlying errors; do not game the test suite or hide broken behavior.

## 12. Archives, releases, and deliverables

- Preserve any **supplied input archive** unchanged. Work in a copy and produce a new output artifact rather than modifying the only original.
- When asked to deliver a full playable release archive, include **source code, the built `dist` output if the active toolchain uses it, launch instructions, and relevant documentation**. Do not claim a build exists unless it was actually generated and verified.
- Check that the output archive can be extracted, that its contents are complete, and, where practical, that it rebuilds from the included source.
- Record changed features, known limitations, new asset attributions, and any compatibility or save-migration considerations.
- Do not include secret credentials, unrelated files, unauthorized third-party materials, or font files in distribution packages.

## 13. Completion report and guiding principle

**Write the final user-facing development report in Russian**, even though this file is in English. Explain:

- What was implemented or fixed and the resulting player-visible behavior.
- Which external assets were used and where attribution/license records are stored.
- Which checks **actually passed**, failed, were blocked, or were not run.
- What remains unfinished or risky and how to reproduce or verify it.
- Whether a release was added to `Versions/`, but only when creating one was part of the task.

**The north star:** each update should make RAID GAME more coherent, tense, atmospheric, playable, and believable while respecting the work already done. Use modern development methods and high-quality lawful assets without losing the low-poly art direction or the game's own identity.

**One polished mechanic that changes how the game plays is better than ten unfinished mechanics and menus.**
