---
title: 'Gildenkrieg Simulation Devlog, Part 1: Entities That Survive the Network'
description: 'How Gildenkrieg uses EnTT, stable network identities, versioned entity recipes, and deferred lifecycle commands to build a multiplayer-ready entity API.'
publishedAt: 2026-08-04
updatedAt: 2026-09-11T03:44:32Z
category: game-development
tags: [gildenkrieg, devlog, gamedev, c++, ecs, networking]
draft: false
featured: true
series: gildenkrieg-simulation-devlog
seriesOrder: 1
---

In a single-player prototype, an entity can be whatever the current process says it is. A slot in an array is often enough. The player, the physics body, and the thing being rendered can all point at that slot and agree that it means "the same object."

Multiplayer makes that agreement temporary.

The server and every client have their own memory, their own entity storage, and their own moment at which an object appears or disappears. A local entity handle that makes perfect sense on the server is meaningless on a client. A delayed packet might even refer to an earlier incarnation of an object whose numeric ID has since been reused.

That led me to a useful rule while building Gildenkrieg's new simulation layer:

> An entity needs a local identity for speed, a network identity for agreement, and a presentation state for what the player actually sees.

This first part of the series is about the first two pieces: the entity API, the ECS beneath it, and the lifecycle rules that let entities safely enter and leave a networked simulation.

## Why an ECS fit the problem

Gildenkrieg uses [EnTT](https://github.com/skypjack/entt), a fast C++ entity-component-system library. EnTT gives the simulation a registry of small local entity handles and lets systems efficiently visit entities with a particular set of components.

The important word there is _local_.

An `entt::entity` is excellent for saying "find the transform attached to this entity in this registry." It is not a permanent save-game identifier, and it is not something I can send over the network. The server's entity 42 and the client's entity 42 do not have to refer to the same thing.

Instead of building a deep class hierarchy such as `NetworkedCharacter` inheriting from `Character`, inheriting from `PhysicsObject`, and so on, I compose an entity from data:

```cpp title="C++-style pseudocode"
Entity player = registry.create();

registry.add(player, NetworkIdentity{network_id, authority_epoch});
registry.add(player, Archetype{PLAYER_V1});
registry.add(player, SimulationRole::Authority);
registry.add(player, Transform{spawn_position, spawn_rotation});
registry.add(player, Motion{});
registry.add(player, Health{100, 100});
registry.add(player, Ownership{connection_id});
registry.add(player, CharacterController{capsule, movement_profile});
registry.add(player, Replicated{});
```

A Prop can share `Transform`, `Motion`, `Health`, and `Replicated` without pretending to be a kind of Player. A remote player can gain interpolation components without giving the authoritative server any need to know that rendering exists.

## One entity, several valid views

It helps to separate three meanings of "the entity":

1. **The local ECS entity** is an efficient handle into one EnTT registry.
2. **The network entity reference** is the shared name used in commands and packets.
3. **The presentation entity state** is the pose shown on screen, which may be interpolated or visually smoothed.

The second item is represented by an ID and an authority epoch:

```cpp title="C++-style pseudocode"
struct NetworkEntityId {
    uint64 value;            // Zero is invalid.
};

struct AuthorityEpoch {
    uint32 value;
};

struct NetworkEntityRef {
    NetworkEntityId id;
    AuthorityEpoch epoch;
};
```

The server allocates network IDs monotonically. The epoch identifies a particular incarnation or authority owner of that ID.

Why not use only a 64-bit ID? Imagine the client receives these packets in an unfortunate order:

```text {4}
spawn entity 81, epoch 3
despawn entity 81, epoch 3
spawn entity 81, epoch 4
late movement update for entity 81, epoch 3
```

Without the epoch, the final packet looks like a valid update for the new entity. With it, the client can see that the packet belongs to an older incarnation and ignore it.

The distinction also leaves room for future authority transfer or world-region migration. The entity's stable ID can remain recognizable while its authority epoch changes.

## Resolving a shared identity into local storage

Each simulation world owns an index from a network ID to the local EnTT entity and its current epoch. Every packet and input command uses a `NetworkEntityRef`; systems resolve that reference before touching components.

```cpp title="C++-style pseudocode" {7-8}
Entity resolve(NetworkEntityRef ref) {
    IndexedEntity current = network_index.find_by_id(ref.id);

    if (!current.exists)
        return null_entity;

    if (current.epoch != ref.epoch)
        return null_entity;       // Stale incarnation.

    return current.local_entity;
}
```

This small boundary prevents network identity from leaking into the rest of the simulation. Once a reference has been resolved, an EnTT view can do what it does best: iterate compact component storage with very little ceremony.

It also gives spawn processing a place to make an explicit decision. A same-ID, same-epoch spawn is a duplicate and can be treated idempotently. An older epoch is stale. A newer epoch supersedes the old incarnation.

Those cases are much easier to reason about when they are part of the entity API instead of being rediscovered by every packet handler.

## Archetypes are recipes, not rigid types

An ECS makes it easy to add arbitrary components. A network protocol needs more discipline. The server and client must agree on what a "Player version 1" means and how to construct it from bytes.

Gildenkrieg handles that with a runtime entity-definition registry. An archetype definition contains:

- a stable archetype ID;
- a schema version;
- a construction function;
- the replication fragments required at spawn;
- the fragments eligible for later updates.

In simplified form:

```cpp title="C++-style pseudocode"
struct EntityDefinition {
    ArchetypeId id;
    uint16 schema_version;

    bool (*construct)(SpawnBuilder&, SpawnContext, Bytes payload);

    FragmentId spawn_fragments[];
    FragmentId update_fragments[];
};

definitions.register_definition({
    .id = PLAYER,
    .schema_version = 1,
    .construct = construct_player_v1,
    .spawn_fragments = {Transform, Motion, Health, PlayerIdentity},
    .update_fragments = {Transform, Motion}
});
```

The built-in definitions currently cover Player and Prop.

A Player recipe decodes transform, motion, health, ownership, and character-controller settings. A Prop recipe decodes transform, motion, health, and rigid-body settings. The common world code creates identity, archetype, role, and lifetime components first; the recipe then adds only the archetype-specific composition.

Keeping common construction in the world matters. A recipe cannot accidentally invent a second identity policy or bypass lifecycle tracking. Networked spawns and local authoritative spawns travel through the same path.

The schema version is equally important. As the game evolves, a player spawn payload will gain fields or change representation. Versioned recipes make that evolution visible instead of hoping two builds interpret the same byte sequence in the same way.

## The same recipe can produce different simulation roles

The server and client share the Player recipe, but they do not give every copy of a Player the same job.

Gildenkrieg currently uses three simulation roles:

- **Authority**: the server-owned version that decides gameplay and physics state.
- **Autonomous proxy**: the locally controlled client version that predicts its own movement.
- **Simulated proxy**: a remote client version driven by authoritative snapshots.

The recipe adds role-specific components:

```cpp title="C++-style pseudocode"
void finish_player_recipe(Entity e, SimulationRole role) {
    switch (role) {
        case Authority:
            registry.add(e, Replicated{});
            registry.add(e, ReplicationPolicy{});
            break;

        case AutonomousProxy:
            registry.add(e, Predicted{});
            registry.add(e, InputSequenceState{});
            break;

        case SimulatedProxy:
            registry.add(e, Interpolated{});
            registry.add(e, InterpolationBufferHandle{});
            registry.add(e, PresentationTransform{});
            break;
    }
}
```

The presentation sampler creates an autonomous proxy's `PresentationTransform` lazily from its predicted simulation pose. Simulated proxies receive presentation state directly from their recipe because their visible pose depends on an interpolation buffer from the start.

This is one of my favorite consequences of composition. "Player" describes the object's data recipe. "Authority," "autonomous," and "simulated" describe its job in this world. I do not need three unrelated player classes with duplicated movement state.

## Why spawning is deferred

Creating or destroying an entity in the middle of an ECS system can invalidate the assumptions of the system currently iterating. It can also make frame behavior depend on which system happened to request the change first.

Gildenkrieg therefore treats structural changes as commands. Systems request a spawn or despawn; the simulation commits those requests at known barriers.

```cpp title="C++-style pseudocode"
world.queue_spawn(SpawnCommand{
    .network_ref = allocated_server_ref,
    .archetype = PLAYER,
    .role = Authority,
    .payload = encode(player_spawn_data)
});

// The entity does not appear halfway through an arbitrary system.
// It appears when the simulation reaches its pre-step barrier.
world.tick_fixed();
```

At the pre-simulation barrier, a spawn goes through a deliberate sequence:

```text
validate or allocate network reference
    -> reject duplicate or stale epochs
    -> create the local EnTT entity
    -> add common identity, role, and lifetime state
    -> run the versioned archetype recipe
    -> destroy the partial entity if construction fails
    -> mark the entity active
    -> insert it into the network index
```

This is a little more ceremony than calling `registry.create()` from anywhere. In exchange, every system knows when new structure becomes visible.

## Destruction needs two barriers

Despawn is more subtle than spawn because other systems may still be processing the entity during the current tick.

The simulation handles removal in two stages:

1. The entity is marked `PendingDespawn` at the pre-simulation barrier.
2. Physics, input, gameplay, and replication views exclude pending entities.
3. Runtime resources such as physics bindings are released.
4. The network index entry and local EnTT entity are destroyed at the post-simulation barrier.

In pseudocode:

```cpp title="C++-style pseudocode"
void request_despawn(NetworkEntityRef ref) {
    post_step_commands.push(DespawnCommand{ref});
}

void commit_pre_step() {
    for (DespawnCommand cmd : post_step_commands)
        registry.add(resolve(cmd.ref), PendingDespawn{});
}

void commit_post_step() {
    for (Entity e : registry.view<PendingDespawn>()) {
        physics.release_binding(e);
        network_index.remove(registry.get<NetworkIdentity>(e));
        registry.destroy(e);
    }
}
```

This makes iteration safe and gives replication a clean answer to "is the entity still alive?" A pending entity is absent from the authoritative live set, so clients that previously knew it receive a reliable despawn.

On the client, a despawn also leaves a short-lived tombstone. If a delayed spawn for the same or an older epoch appears afterward, the tombstone prevents that old object from being resurrected.

## What the entity API buys the rest of the engine

None of these pieces is visually impressive on its own. Stable IDs do not make a character move. Structural barriers do not draw a spaceship. A recipe registry is not a gameplay feature.

Together, however, they answer the awkward questions before physics and networking begin to depend on them:

- What identity is safe to transmit?
- How does a packet find the correct local entity?
- How do both hosts construct compatible component sets?
- How does a delayed packet fail safely?
- When can systems assume registry structure is stable?
- Which components belong only on the authority, the owner, or a remote proxy?

That foundation lets the next layer stay much simpler. The fixed-step simulation can operate on component capabilities. Physics can attach runtime-local bindings without putting engine handles on the wire. Replication can send stable fragments instead of serializing an entire EnTT registry.

In [Part 2](/articles/gildenkrieg-simulation-devlog-part-2), I will follow one of these entities through the fixed-step simulation, authoritative physics, fragment replication, and the interpolation that turns irregular network updates into smooth remote motion.
