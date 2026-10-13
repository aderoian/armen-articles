---
title: 'Gildenkrieg Simulation Devlog, Part 2: Fixed Ticks, Physics, and Replication'
description: 'How Gildenkrieg advances one authoritative simulation, bridges ECS state to physics, replicates component fragments per connection, and interpolates remote players.'
publishedAt: 2026-08-04
updatedAt: 2026-08-04T23:44:54Z
category: game-development
tags: [gildenkrieg, devlog, gamedev, c++, physics, networking]
draft: false
series: gildenkrieg-simulation-devlog
seriesOrder: 2
---

In [Part 1](/articles/gildenkrieg-simulation-devlog-part-1), I described how Gildenkrieg gives an entity a stable network identity without confusing that identity with an EnTT handle. I also introduced deferred spawn and despawn barriers, versioned recipes, and the three roles an entity can play: authority, autonomous proxy, or simulated proxy.

This part starts once an entity is alive.

The server needs to accept input, move physics forward, copy the result back into the ECS, and tell each client what changed. The client then has to turn a slightly irregular stream of snapshots into motion that looks continuous.

The heart of that path is a fixed-step simulation shared by the server and client.

## Why fixed steps matter

A game's render frame rate is not a stable clock. One frame might take 8 milliseconds, the next 14, and a busy frame 30. If physics and movement consume those varying frame durations directly, the results become harder to reproduce and much harder to compare across a server and client.

Gildenkrieg's simulation advances with a constant delta: 60 ticks per second by default. Rendering can happen more or less often, but gameplay sees the same step size each time.

```cpp title="C++-style pseudocode"
const double fixed_dt = 1.0 / 60.0;

while (server_is_running) {
    Time start = now();

    drain_network_events();
    authoritative_world.tick_fixed(fixed_dt);
    gather_and_send_replication();

    sleep_for_remaining_budget(start, fixed_dt);
}
```

This does not make the simulation magically deterministic. Gildenkrieg uses floating-point physics, and I have not proven bitwise-identical results across platforms. What the fixed step provides is a stable cadence and a shared meaning for "tick 8,421." That is enough to make history, snapshots, interpolation, and replay much more manageable.

The current server loop uses a fixed delay rather than an accumulator with catch-up ticks. If a tick runs over budget, the server logs it and continues with the same fixed delta. That keeps each physics step predictable, although sustained overload would make simulation time fall behind wall-clock time. It is a tradeoff I want to measure before making the timing policy more elaborate.

## A simulation world with explicit phases

`FSimulationWorld` owns the EnTT registry, stable entity index, simulation clock, input queue, structural command buffers, and an ordered system pipeline. Physics, replication, prediction, interpolation, and entity definitions are attached services supplied by the host.

That means the dedicated server can attach physics and replication without carrying client-only presentation systems. The client can attach those same services plus prediction and interpolation.

Each tick follows a fixed phase order:

```text
commit pre-simulation structure
    -> input
    -> pre-physics
    -> physics
    -> post-physics
    -> gameplay
    -> prediction history
    -> replication cleanup
    -> commit post-simulation structure
    -> advance the clock
```

Systems can be registered inside the injectable phases, but code cannot casually reorder the structural barriers or clock advance.

In simplified C++-style pseudocode:

```cpp title="C++-style pseudocode"
void SimulationWorld::tick_fixed() {
    commit_spawns_and_mark_despawns();

    pipeline.run(Input, tick);
    pipeline.run(PrePhysics, tick);
    pipeline.run(Physics, tick);
    pipeline.run(PostPhysics, tick);
    pipeline.run(Gameplay, tick);
    pipeline.run(History, tick);
    pipeline.run(Replication, tick);

    finalize_despawns();
    clock.advance();
}
```

The order is deliberately boring. That is a compliment. Input always becomes a movement request before physics steps. Physics always becomes ECS state before replication gathers. A despawn never destroys storage halfway through a view.

## Input becomes a physics request

The current movement command is small: two movement axes, jump, and sprint. It arrives in a typed envelope containing the target network reference, client tick, and input sequence.

After ownership validation, the server places the envelope into the world's fixed-capacity input queue. During the Input phase, the command is decoded into a temporary component:

```cpp title="C++-style pseudocode"
struct CharacterMoveInput {
    float move_x;
    float move_y;
    bool wants_jump;
    bool wants_sprint;
};

for (InputEnvelope command : input_queue) {
    Entity e = world.resolve(command.target);

    if (!e || registry.has<PendingDespawn>(e))
        continue;

    CharacterMoveInput move = decode_character_move(command.payload);
    registry.emplace_or_replace(e, move);
}
```

The movement system converts that intent into a desired horizontal velocity. It clamps diagonal movement to the configured walk or sprint speed and sends acceleration, air acceleration, gravity, jump impulse, and delta time to the character controller.

The input component is ephemeral. Once consumed, it is removed. Persistent player state remains in the transform, motion, controller runtime, and physics binding.

## Keeping physics handles local

The physics engine has its own bodies and character-controller handles. Those handles are meaningful only inside one process and one physics world, so they must never become network identity.

The ECS stores an opaque runtime binding:

```cpp title="C++-style pseudocode"
struct PhysicsBinding {
    uint64 slot_and_generation;
    PhysicsObjectKind kind;
};

// Not serialized. Not sent to clients. Not used as an entity ID.
```

`FPhysicsRuntime` resolves that binding to the actual `gk_physics` body or controller. The generation protects against a stale local binding after a runtime slot is reused. This is the same safety principle used for network epochs, applied at a different boundary.

Bindings are lazy. During PrePhysics, an eligible character without a binding receives a controller. On the authoritative server, an eligible dynamic Prop receives a rigid body. The client does not create authoritative dynamic bodies for interpolated Props.

After physics steps, PostPhysics reads the pose and velocity back into ECS components:

```cpp title="C++-style pseudocode"
void read_physics_back(Entity e) {
    PhysicsState state = physics.read(registry.get<PhysicsBinding>(e));

    if (!nearly_equal(state.pose, registry.get<Transform>(e))) {
        registry.replace<Transform>(e, state.pose);
        replication.mark_dirty<Transform>(e);
    }

    if (!nearly_equal(state.motion, registry.get<Motion>(e))) {
        registry.replace<Motion>(e, state.motion);
        replication.mark_dirty<Motion>(e);
    }
}
```

This is where authoritative movement becomes network-visible state. The physics result is the truth; the dirty mask records which fragments are worth considering for replication.

## Replication is made of fragments

Sending a memory dump of an ECS component is tempting and fragile. Padding, endianness, compiler layout, component changes, and pointers all make raw memory a poor protocol.

Gildenkrieg instead defines stable replication fragments. The first schema contains:

| Wire ID | Fragment        | Contents                         |
| ------: | --------------- | -------------------------------- |
|       0 | Transform       | Position and rotation            |
|       1 | Motion          | Linear and angular velocity      |
|       2 | Health          | Current and maximum health       |
|       3 | Player identity | Player and owning connection IDs |

An archetype chooses separate spawn and update masks. A Player spawn needs Transform, Motion, Health, and Player Identity. Its routine movement update currently needs only Transform and Motion.

```cpp title="C++-style pseudocode"
const FragmentMask player_spawn =
    bit(Transform) | bit(Motion) | bit(Health) | bit(PlayerIdentity);

const FragmentMask player_update =
    bit(Transform) | bit(Motion);
```

A fragment descriptor knows how to detect its component, encode it, apply it, and remove it. The replication runtime remains type-erased at the wire boundary while gameplay code can mark C++ component types dirty.

One terminology detail matters: the current update writer sends the full value of every dirty fragment. "Dirty" means "include the current Transform," not "encode a mathematical delta against a baseline." Delta compression is future work.

## Structure is reliable; motion is disposable

Not every replication record deserves the same delivery policy.

A Spawn or Despawn changes the client's world structure. Losing it can leave an object missing forever or alive forever, so structural records travel reliably.

A movement Update ages quickly. If tick 500 is lost and tick 501 arrives, retransmitting 500 is usually a waste. Updates use the unsequenced snapshot channel.

The rule looks like this:

```cpp title="C++-style pseudocode"
Delivery delivery_for(ReplicationRecord record) {
    switch (record.kind) {
        case Spawn:
        case Despawn:
        case RemoveComponent:
        case AuthorityTransfer:
        case BaselineReset:
            return Reliable;

        case Update:
            return Unsequenced;
    }
}
```

That separation avoids head-of-line blocking between two different kinds of truth: "this entity exists" and "this was its newest known position."

## What each connection knows

Replication state belongs to a connection, not only to an entity.

Client A might have known about a Prop for ten seconds. Client B may have just connected and need a complete spawn. Client C might eventually be outside the Prop's interest area. A single `was_sent` flag on the entity cannot represent those different views.

Each connection therefore tracks:

- known network IDs and epochs;
- the last spawn and update ticks;
- sent fragment masks;
- packet and input acknowledgement fields;
- interest settings;
- priority, throttling, and dormancy state;
- packet record budgets.

Gathering replication is conceptually two passes:

```cpp title="C++-style pseudocode"
for (Entity e : authoritative_live_entities) {
    remember_as_live(e);

    if (connection.is_interested(e) || connection.owns(e))
        candidates.push(e);
}

sort_by_replication_priority(candidates);

for (Entity e : candidates) {
    if (!connection.knows(network_ref(e)))
        reliable.push(make_full_spawn(e));
    else if (has_eligible_dirty_fragments(e))
        unreliable.push(make_update(e));
}

for (NetworkEntityRef known : connection.known_entities) {
    if (!authoritative_live_set.contains(known))
        reliable.push(make_despawn(known));
}
```

Dirty masks are cleared only after the server gathers every joined connection. Otherwise, the first client could consume a change before later clients see it.

The runtime already has an interest allowlist, owner-always-relevant behavior, update throttling, priority sorting, and basic dormancy. The current server intentionally uses the simple policy: replicate all entities, with default priority and no dormancy. Spatial interest production is a later layer, not something I want to claim is already live.

## Applying packets without trusting arrival order

The client applies structural records idempotently.

- A duplicate same-epoch spawn refreshes the existing entity.
- An older epoch is ignored.
- A newer spawn epoch supersedes the old incarnation.
- A despawn creates a temporary tombstone even if the spawn has not arrived yet.
- A delayed spawn at the same or older epoch cannot pass that tombstone.

Updates for entities that do not yet exist are currently discarded. A bounded update-before-spawn buffer is still future work.

For simulated proxies, each accepted update also becomes an interpolation sample. This is important because the unsequenced channel may deliver tick 102 before tick 101.

## Interpolation: deliberately seeing the past

If the renderer displays only the most recently received remote position, network jitter becomes visible as stutter. If it tries to guess the present from one packet, every delay spike becomes an extrapolation problem.

Gildenkrieg renders remote players a few simulation ticks behind the latest estimated server time. That intentional delay gives the client a good chance of holding two snapshots around the render moment.

```cpp title="C++-style pseudocode"
double render_server_tick = estimated_server_tick - interpolation_delay;

Snapshot a = latest_sample_at_or_before(render_server_tick);
Snapshot b = earliest_sample_after(render_server_tick);

float alpha = inverse_lerp(a.tick, b.tick, render_server_tick);

presentation.position = lerp(a.position, b.position, alpha);
presentation.rotation = nlerp_shortest_arc(a.rotation, b.rotation, alpha);
```

Interpolation history lives outside EnTT in fixed-capacity, tick-ordered buffers. The entity carries only a lightweight buffer handle. A sample arriving out of order is inserted by state tick; a second sample for the same tick replaces the first.

If render time moves slightly beyond the newest sample, the client can extrapolate position using linear velocity for at most one tick. After that, it freezes the presentation pose and reports a stalled status. Bounded extrapolation makes the failure mode visible and finite.

The diagnostic client uses a three-tick interpolation delay. Its server-time estimate is intentionally simple: take the maximum observed packet tick, then advance it once per local fixed step. It is not yet a full clock-synchronization system with drift correction and adaptive buffering.

## Simulation state is not presentation state

The remote snapshot updates `SimulationTransform`, but rendering reads `PresentationTransform`.

That separation is not cosmetic. If interpolation wrote back into the gameplay transform, visual smoothing would affect collision queries and future simulation. The rendered pose is allowed to be slightly behind because it exists to look coherent; the simulation pose exists to represent the newest authoritative state the client knows.

```cpp title="C++-style pseudocode"
Transform pose_for_rendering(Entity e) {
    if (registry.has<PresentationTransform>(e))
        return registry.get<PresentationTransform>(e);

    return registry.get<SimulationTransform>(e);
}
```

This same boundary becomes useful again in Part 3. A local predicted player needs immediate simulation, but a reconciliation correction should not necessarily produce an immediate visual snap.

## What works today, and what remains policy

The implemented path is already substantial: fixed phases, shared physics systems, authoritative readback, fragment encoding, per-connection known state, reliable structure, unsequenced updates, epoch checks, tombstones, and tick-ordered interpolation are connected through the server and diagnostic client.

There are also deliberate boundaries I do not want to hide:

- The server currently gathers replication every simulation tick even though a separate snapshot-rate setting exists.
- Updates contain full fragment values rather than compressed deltas.
- Record-count budgets are enforced, but byte-aware packet packing is not complete.
- Health is part of the Player and Prop spawn state but not their routine update masks.
- The live server replicates all entities; the interest API is not yet driven by a spatial system.
- Packet sequence fields exist, but the client does not yet reject every older packet at the replication-apply boundary.

Those are not reasons to blur the architecture. They are the next engineering work made visible by it.

At this point, a remote player can look smooth. The local player has a different problem: even perfect interpolation would make controls feel delayed because the client would wait for the server before moving.

In [Part 3](/articles/gildenkrieg-simulation-devlog-part-3), I will cover the autonomous-proxy path: send input and simulate it immediately, save rollback history, compare the eventual authoritative result, restore physics, replay unacknowledged commands, and smooth the correction strictly in presentation space.
