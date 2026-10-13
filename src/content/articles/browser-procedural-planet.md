---
title: 'Devlog: Growing a Tiny Procedural Planet in the Browser'
description: 'How I built the seeded planet generator and layered Three.js renderer behind my personal website without textures, height maps, or 3D models.'
publishedAt: 2026-08-02
updatedAt: 2026-09-11T03:44:27Z
category: graphics
tags: [devlog, procedural-generation, threejs, svelte, webgl]
draft: false
featured: true
---

The planet behind my personal website started as a visual idea: a small, colorful world turning quietly behind the page, somewhere between a globe, a strategy-game map, and a low-poly diorama.

The obvious way to build it would have been to find a planet model, wrap it in a texture, add a transparent cloud image, and call it finished.

I went in the opposite direction.

The planet has no downloaded model, height map, terrain texture, cloud texture, or ocean image. The browser starts with an icosphere and a number. From those two things, it invents continents, mountain ranges, climate, biomes, lakes, rivers, forests, settlements, clouds, atmosphere, and tiny aircraft.

That made the project much more interesting than “put a globe in the background." It became an exercise in procedural generation, mesh topology, shaders, performance, and the small deceptions that make a stylized world feel coherent.

This is how the generator and renderer work, why I made some of their stranger choices, and what I learned from fitting a tiny world into a normal website.

## The goal: a world, not a sphere

A sphere is easy. A world needs relationships.

Mountains should rise out of continents rather than appear as evenly scattered bumps. Snow should prefer cold places and high elevations. Forests should grow where the climate supports them. Rivers should go downhill. Foam should follow the coastline instead of glowing around the whole silhouette. A lighthouse should make more sense beside water than in a desert.

I also wanted every visit to have the chance to reveal a different planet. The result needed to feel varied without becoming a pile of unrelated random decisions.

The generator therefore has a simple contract:

```ts
const planet = generatePlanet({
    seed: 241947231,
    detail: 54,
    seaLevel: 0.51,
    objectDensity: 1,
    clouds: true,
    aircraftCount: 5
});

scene.add(planet.group);
```

A seed acts like the planet's DNA. With the same complete set of inputs, the generator reproduces the same geography and decoration. Without a supplied seed, it creates a random unsigned 32-bit value with `crypto.getRandomValues`.

Internally, related systems receive their own derived seeds:

```ts
export function createTerrainNoise(seed: number): TerrainNoiseSet {
    return {
        height: createNoise3D(seed),
        moisture: createNoise3D(seed ^ 0x9e3779b9),
        temperature: createNoise3D(seed ^ 0x85ebca6b),
        mountain: createNoise3D(seed ^ 0xc2b2ae35)
    };
}
```

The XOR constants give height, moisture, temperature, and mountains independent noise fields while keeping the entire result reproducible. Clouds, object placement, and aircraft routes use the same idea.

One small wrinkle is that the website also randomizes sea level separately. A seed reproduces the generator, but recreating the exact planet seen on the site requires both the seed and the same sea level. That is a useful reminder that determinism applies to all inputs, not only the one named `seed`.

## Sampling noise without a seam

Most procedural terrain starts with noise: a function that turns a position into a smoothly changing value.

On a flat map, it is natural to sample noise with horizontal and vertical coordinates. On a sphere, that introduces an awkward boundary where longitude wraps from one side of the map to the other. It also squeezes the coordinates together at the poles.

The planet avoids that entire problem by never flattening its terrain.

Every point on the base sphere already has a normalized three-dimensional direction, `(x, y, z)`. I sample the noise directly at that direction. Neighboring points on the sphere remain neighboring points in the noise field, including across the date-line-like boundary that would exist in a texture.

The noise implementation begins with a seeded permutation table and builds several kinds of terrain signal:

- Fractional Brownian motion, or fBm, adds broad and fine octaves together.
- Ridged fBm folds values around zero to create sharper crests and valleys.
- Domain warping bends the sampling coordinates before the final terrain lookup.

In simplified form, the warp looks like this:

```ts
const wx = nx + fbm3(noise.height, nx * scale, ny * scale, nz * scale) * warp;
const wy = ny + fbm3(noise.height, nx * scale + 20, ny * scale, nz * scale) * warp;
const wz = nz + fbm3(noise.height, nx * scale, ny * scale + 20, nz * scale) * warp;

const base = fbm3(noise.height, wx * frequency, wy * frequency, wz * frequency);
```

Those offsets keep the three warped axes from receiving identical distortion. The result is less like smooth computer-generated blobs and more like coastlines and ridge systems that have been pushed around by some invisible geological history.

The final elevation combines broad continentalness, detailed base relief, ridged mountains, and valley carving:

$$
\begin{aligned}
\text{elevation} =\; & 0.28 \times \text{base terrain} \\
+\; & 0.52 \times \text{continentalness} \\
+\; & 0.32 \times \text{mountains} \\
-\; & \text{carved valleys}
\end{aligned}
$$

This is not plate tectonics. It is an authored recipe for a particular visual result. The important part is that each term has a job: continents decide where large land masses belong, base terrain breaks up their surfaces, mountain masks group peaks into ranges, and valleys cut back into those ranges.

The seed also changes several frequencies and the strength of the domain warp. Two worlds can therefore differ not only in where their features appear, but in the scale and character of those features.

## One planet, two versions of the mesh

The base geometry is an icosphere: an icosahedron whose triangular faces have been subdivided and pushed onto a sphere.

I use a non-indexed version of that mesh for rendering. Each triangle owns its three corners, even when the adjacent triangle has corners at the exact same position. That makes flat shading and per-face color straightforward. It is the source of the crisp, faceted look.

It is also terrible for algorithms that need to know which surface points are neighbors.

A river cannot walk downhill across the planet if every triangle believes it is disconnected from the triangles beside it. A slope calculation cannot compare adjacent heights. A flood fill cannot spread through a lake basin.

The solution was to keep the render mesh and reconstruct a second, logical version of it.

```ts
for (let i = 0; i < vertexCount; i++) {
    const direction = normalize(position[i]);
    const key = quantize(direction, 1e-5);

    let unique = keyToUnique.get(key);
    if (unique === undefined) {
        unique = uniqueToVertices.length;
        keyToUnique.set(key, unique);
        uniqueToVertices.push([]);
        uniqueDirections.push(direction);
    }

    vertexToUnique[i] = unique;
    uniqueToVertices[unique].push(i);
}

for (const triangle of triangles) {
    connect(triangle.a, triangle.b);
    connect(triangle.b, triangle.c);
    connect(triangle.c, triangle.a);
}
```

This “welding" pass groups duplicated render corners that point in the same quantized direction. It also builds a graph containing each logical point's neighbors.

The two representations then coexist:

- The non-indexed render mesh keeps independent triangles for flat shading.
- The welded graph provides continuous topology for terrain sampling and surface algorithms.

Production detail produces about 60,500 terrain triangles and 181,500 render corners, but only 30,252 unique surface directions. Sampling expensive multi-octave noise once per unique direction avoids doing the same work roughly six times at commonly shared corners. The resulting displaced position is copied back to every matching render corner.

This became my favorite part of the design. The planet can look deliberately faceted without forcing all of its geography algorithms to think in disconnected triangles.

## Turning elevation into climate

Height alone does not make an interesting map. If every decision follows the same elevation field, the world quickly becomes predictable: vegetation, snow, and color all repeat the same shapes.

The generator samples moisture and temperature independently.

Moisture begins as its own fBm field. Mountains dry it out slightly, while continentalness gives it a small boost. This is not a wind or rainfall simulation, but it stops forests and deserts from simply tracing the height map.

Temperature combines latitude, its own noise, and an elevation lapse rate:

```ts
const latitude = Math.abs(ny);

let temperature =
    1
    - latitude * 0.78
    + remappedTemperatureNoise * 0.22;

temperature -= elevation * 0.42;
temperature = clamp(temperature, 0, 1);
```

In everyday terms: the poles are colder than the equator, local variation keeps the climate from forming perfect horizontal stripes, and high ground is colder than nearby lowlands.

Elevation, moisture, temperature, mountain strength, and slope feed a rule-based classifier with 17 labels. They include deep and shallow ocean, lakes, rivers, beaches, deserts, savannas, grasslands, forests, rainforests, taiga, tundra, rock, mountains, alpine terrain, snow, and glaciers.

The ordering of those rules matters. Water is handled before beaches, high cold ground before lowland vegetation, and steep rock before ordinary climate biomes. The rules are simple enough to tune, but together they create readable regional structure.

They also do more than choose colors. Biomes later decide where trees, cacti, boulders, ice formations, settlements, and coastal objects are allowed to appear. Geography becomes a shared source of truth for both generation and rendering.

## Giving water somewhere to go

Once the welded graph existed, lakes and rivers became graph problems.

For lakes, the generator searches for low points above sea level. From each candidate, it performs a bounded breadth-first flood fill up to a small randomized water level. A basin is accepted only if it is large enough, stays within a size budget, and does not spill into the ocean.

Rivers begin from shuffled points in a suitable elevation band. At each step, a river chooses the lowest neighboring vertex. A path is kept only if it reaches the ocean or a lake and is long enough to read visually.

The core of the downhill walk is intentionally uncomplicated:

```ts
let current = source;

for (let step = 0; step < maxSteps; step++) {
    path.push(current);

    if (height[current] < seaLevel || lakeVertices.has(current)) {
        reachedWater = true;
        break;
    }

    const next = lowestNeighborBelow(current);
    if (next === undefined) break;
    current = next;
}
```

This is not a global watershed solver, erosion model, or physically accurate water cycle. Lakes are local bounded fills, and rivers are strict downhill walks. Those limitations are acceptable at the scale of a decorative world. The goal is to make the geography legible, not to predict a real drainage basin.

The important architectural result is that water features are not painted on afterward. They follow the same surface graph used to calculate terrain.

## Rendering the illusion in layers

The generator does not return one magical planet material. It assembles a stack of specialized layers:

```mermaid title="The planet's render layers, from the surface outward"
flowchart LR
    accTitle: Planet render layers
    accDescr: Six layers stacked from the inside out: displaced terrain, then ocean, lakes, and rivers, then instanced props and aircraft, then inner atmospheric haze, then the procedural cloud shell, and finally the outer atmospheric halo.
    A["Displaced terrain"] --> B["Ocean, lakes, and rivers"]
    B --> C["Instanced props and aircraft"]
    C --> D["Inner atmospheric haze"]
    D --> E["Procedural cloud shell"]
    E --> F["Outer atmospheric halo"]
```

The terrain is a flat-shaded Lambert mesh with baked vertex colors. Ocean terrain is pushed inward, below the base radius. A separate smooth, transparent sphere sits at sea level, hiding the inset ocean floor while letting land rise through it.

That one arrangement provides several useful illusions at once. There is visible water depth, a clean sea surface, and no need to cut coastlines into separate meshes.

Lakes and rivers use lifted overlays extracted from terrain faces. Their underlay colors are deliberately brighter than a realistic lake bottom; otherwise transparent edges form dark rings against the terrain.

Clouds live on another shell outside the highest measured terrain. Their GLSL shader generates patches from object-space 3D noise, so there is no cloud texture and no UV seam. Time drifts the sampling domain, and the shell rotates slightly relative to the land.

The atmosphere uses two shells. The inner shell provides haze over the surface, while the outer back-faced shell creates a halo around the limb. Neither performs physically accurate atmospheric ray marching. They use view and light directions to approximate Rayleigh-like blue light and a warmer forward-scattering glow.

That is a recurring theme in this project: several small, focused approximations can create a richer result than one complicated effect trying to do everything.

## Making foam belong to the coastline

The ocean shader was one place where the CPU-generated geography needed to reach the GPU.

A common shortcut is to use a Fresnel term, the angle between the surface and the camera to brighten the rim of a sphere. That is useful for making water shinier at glancing angles, but it does not know where the land is. It creates a halo, not a coastline.

During generation, I sample the terrain elevation at the ocean sphere's directions and bake a shoreline proximity value into a custom vertex attribute called `aCoast`. The shader receives the result as `vCoast` and combines it with a moving pulse:

```glsl
float foamPulse = 0.55 + 0.45 * sin(
    local.x * uFoamNoiseScale
    + local.z * uFoamNoiseScale * 0.7
    + uTime * uFoamSpeed
);

float coastFoam =
    pow(clamp(vCoast, 0.0, 1.0), uFoamWidth * 0.85)
    * uOceanFoam;

float foamMask = clamp(
    coastFoam * foamPulse * uFoamStrength,
    0.0,
    0.88
);

color = mix(color, uFoamColor, foamMask);
```

The CPU decides _where_ foam belongs. The GPU decides how it moves and looks from frame to frame.

This split is both visually convincing and inexpensive. The shader does not need to rediscover the shoreline every frame, and the baked mask stays attached to the actual procedural coast as the planet rotates.

## Making the planet feel inhabited

The generator can scatter natural and human-made objects across the surface: different tree types, shrubs, cacti, boulders, ice spires, driftwood, settlements, communications towers, lighthouses, offshore platforms, and ships.

Each kind has placement rules. A cactus checks for a dry biome. A lighthouse wants a coast. Trees care about climate and slope. Candidates are also compared using angular distance on the sphere so separate object types do not unknowingly pile onto the same tiny patch.

The objects themselves are small low-poly constructions made from Three.js primitives. All objects of the same kind share a geometry and material through `InstancedMesh`. Instead of asking the GPU to draw hundreds of individual trees one by one, the renderer can submit a tree type as a batch with a different transformation matrix for every instance.

The five default aircraft use the same technique. Each follows a deterministic great-circle route: the spherical equivalent of flying in a straight direction around the globe. Their transforms are calculated from the seed and elapsed time, keeping them tangent to the planet and pointed along their routes.

These details are tiny on screen. That is exactly why they work. A recognizable tree line, lighthouse, ship, or moving plane suggests a scale and a history that the terrain alone cannot provide.

## Making a generator behave like a website feature

Procedural graphics can be impressive and still be a bad website citizen.

The page content should appear before a decorative background consumes time generating 30,000 terrain samples. Server-side rendering should not attempt to create a WebGL context. A hidden tab should not keep rendering. A user who requests reduced motion should not receive a spinning planet anyway.

The Svelte component handles those concerns around the graphics code.

The backdrop and the larger generator module are dynamically imported only in the browser. Generation waits for two animation frames, giving ordinary page content a chance to paint, and then uses idle time when the browser provides it:

```ts
requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        requestIdleCallback(
            () => void buildPlanet(),
            { timeout: 1200 }
        );
    });
});
```

There is a `setTimeout` fallback for browsers without `requestIdleCallback`. The renderer caps its device pixel ratio at 2, avoiding a large fragment-shader penalty on extremely dense displays.

A visibility listener pauses the clock and rendering when the tab is hidden. `prefers-reduced-motion` changes the behavior more fundamentally: the component generates one deterministic frame, displays it, and never starts the animation loop.

The canvas is decorative and non-interactive:

```svelte
<div
    class="planet-backdrop"
    aria-hidden="true"
></div>

<style>
    .planet-backdrop {
        pointer-events: none;
        position: fixed;
        inset: 0;
    }
</style>
```

Cleanup is as important as startup. When the component is destroyed, it cancels scheduled work, removes observers and listeners, disposes every geometry and material, disposes the renderer, and removes the canvas host.

The planet is meant to make the site feel alive, not to take ownership of it.

## What happens once per world and once per frame

A helpful performance boundary emerged during development.

Generation-time work includes:

- Sampling terrain and climate
- Building the welded neighbor graph
- Finding lakes and tracing rivers
- Displacing mesh vertices
- Classifying and coloring biomes
- Baking coastline and inland-water edge masks
- Selecting surface objects
- Creating cloud and aircraft parameters

Frame-time work is much smaller:

- Rotate the root planet group
- Update time and light uniforms for water, clouds, and atmosphere
- Recalculate five aircraft instance matrices
- Render the scene

The production terrain has about 60,500 triangles. That is not extremely “low poly" in the literal sense; low poly describes the faceted visual language. The resolution is high enough to support recognizable geography and tiny surface details, while instancing and baked data keep the recurring render work modest.

The subsystem currently has 38 tests covering deterministic generation, terrain bounds, biome rules, object placement, water layers, coast masks, cloud and atmosphere updates, aircraft routes, optional features, and performance at a substantial test detail.

The most expensive startup work still runs on the main thread. Deferring it protects the first paint, but it does not eliminate the possibility of a later hitch. Moving terrain generation into a Web Worker is one of the clearest future improvements.

## The useful cheats

The finished planet is deliberately not a simulation.

Its atmosphere does not integrate optical depth through real gases. Ocean “depth" color is partly based on viewing angle rather than the distance to the sea floor. Hydrology does not model erosion or global drainage. Clouds do not model weather. Aircraft cruise relative to the base sphere rather than measuring clearance over every mountain.

Those are not hidden failures. They are scope decisions.

A physically accurate system would consume much more development time and runtime cost, while many of its benefits would be invisible behind the text of a portfolio site. The renderer spends detail where the eye notices it: a convincing shoreline, a readable day side, a soft horizon, varied terrain, small signs of habitation, and motion at several different scales.

There are also a few engineering improvements I would like to make:

- Move generation to a worker so even deferred work cannot interrupt the main thread.
- Make the planet's rotation delta-time based; it is currently incremented once per rendered frame.
- Scale mesh detail and object count to device capability.
- Persist or expose seeds so an interesting world can be revisited and shared.
- Raise aircraft routes above the actual measured terrain peak.
- Add a debug view for elevation, moisture, temperature, slope, and biome fields.

The debug view is especially tempting. The renderer shows the finished illusion, but the hidden maps that produce it are just as interesting.

## What I learned

The first lesson was that procedural generation becomes more convincing when systems share information. Terrain affects climate. Climate affects biomes. Biomes affect objects. Terrain topology affects hydrology. Geography affects shader foam. Each step makes the next one look less arbitrary.

The second was that the best data structure for rendering may not be the best one for generation. Keeping a faceted render mesh and a welded logical graph solved both problems without forcing either to compromise.

The third was to separate facts from effects. The CPU can determine the stable fact that a point is near a coastline. The GPU can turn that fact into animated foam. Baking slow decisions and animating cheap presentation is a powerful pattern far beyond planets.

The fourth was that a web graphics feature includes everything around the shader: server-rendering boundaries, code splitting, first paint, high-DPI cost, reduced motion, tab visibility, resizing, and cleanup.

Most of all, I learned that a believable miniature world does not need one perfect simulation. It needs a collection of rules and illusions that agree with one another.

The planet begins as a subdivided icosahedron and a 32-bit seed. By the time it reaches the screen, that seed has become geography, climate, water, color, motion, and a few tiny signs of life.

That transformation, from number to world, is what made this backdrop worth building.
