---
title: 'Gildenkrieg Simulation Devlog, Part 3: Client Prediction and Reconciliation'
description: 'How Gildenkrieg applies local input immediately, records rollback history, reconciles authoritative corrections, replays shared movement systems, and smooths visible errors.'
publishedAt: 2026-08-04
updatedAt: 2026-08-04T20:52:10Z
category: game-development
tags: [gildenkrieg, devlog, gamedev, c++, networking, prediction]
draft: false
series: gildenkrieg-simulation-devlog
seriesOrder: 3
---

A multiplayer server should decide where a player truly is. A responsive game cannot wait for that decision before reacting to every key press.

At 60 milliseconds of round-trip latency, a purely authoritative client would feel each input only after several simulation ticks. At 120 milliseconds, the delay becomes unmistakable. The server would be correct, but the controls would feel disconnected from the player.

Client prediction is the compromise: the server remains authoritative, while the owning client immediately simulates the input it just sent. When authoritative state arrives later, the client compares it with what it predicted, corrects any meaningful error, and replays the inputs the server had not yet processed.

That final sentence sounds tidy. Building it requires clear answers to several difficult questions:

- Which client entity is allowed to predict?
- Which exact input produced a saved state?
- What state must be restored beyond position?
- How does replay avoid becoming a second movement implementation?
- How large must an error be before correction is worth showing?
- How can the simulation be corrected without snapping the rendered player?

This final part describes how Gildenkrieg’s current prediction architecture answers those questions—and the one missing server acknowledgement that still prevents the full rewind-and-replay path from being the normal live behavior.

## Three copies, three responsibilities

As described in the earlier parts, the same Player archetype takes one of three roles:

- The server’s **Authority** consumes validated commands and produces the official physics state.
- The owning client’s **AutonomousProxy** consumes the same local command immediately and records prediction history.
- Everyone else sees a **SimulatedProxy** sampled from remote interpolation history.

Only the autonomous proxy gets the `PredictedEntity` component. That makes prediction participation explicit in the ECS instead of being inferred from whichever object the camera happens to follow.

```cpp title="C++-style pseudocode"
if (spawn.owner_connection == client.local_connection) {
    role = AutonomousProxy;
    registry.add(entity, PredictedEntity{character_prediction_profile});
    registry.add(entity, InputSequenceState{});
} else {
    role = SimulatedProxy;
    registry.add(entity, InterpolatedEntity{});
}
```

The server still decides the truth. "Autonomous" means the client is allowed to estimate its own immediate result, not that it owns authority over the networked state.

## Send once, simulate now

Every local fixed tick, the client samples input and allocates a monotonically increasing 32-bit input sequence. It creates one logical movement command, queues that command into its local simulation, and sends the same input to the server.

```cpp title="C++-style pseudocode"
void client_fixed_tick() {
    CharacterMoveInput input = sample_keyboard();
    uint32 sequence = next_input_sequence++;

    InputEnvelope command = make_character_move_command(
        controlled_network_ref,
        local_simulation_tick,
        sequence,
        input
    );

    client_world.queue_input(command);       // Predict locally.
    network.send_unsequenced(command);       // Ask the authority.
    client_world.tick_fixed();
}
```

The local path does not use approximate "client movement." It uses the shared `gk_game` input, movement, and physics systems also registered by the server.

That shared pipeline is one of the most valuable choices in the architecture. If prediction used a simplified equation while authority used a character controller, the two sides would disagree even under perfect network conditions. Shared code cannot eliminate floating-point, timing, or configuration differences, but it removes an entire category of intentional mismatch.

## Input is a numbered contract

The movement body is currently only ten bytes: two 32-bit movement axes plus jump and sprint flags. Its envelope also carries the target network reference, client tick, command type, and input sequence.

The server never trusts a source connection copied from the wire. It stamps the connection from the authenticated session and verifies that the session controls the target entity.

```cpp title="C++-style pseudocode"
bool accept_input(Session session, WireInput wire) {
    InputEnvelope command = decode(wire);
    command.source_connection = session.connection_id;

    if (command.target != session.controlled_entity)
        return false;

    if (registry.get<Ownership>(resolve(command.target)).owning_connection
        != session.connection_id)
        return false;

    return authoritative_world.queue_input(command);
}
```

The input sequence is more than a serial number. It is the join between three pieces of time:

1. the command the client sent;
2. the predicted state recorded after applying it;
3. the server’s acknowledgement of the last command included in an authoritative snapshot.

Without that join, the client can receive a correct server transform but cannot know which later local inputs need to be replayed on top of it.

## Saving enough history to go backward

After the local physics step and readback, the History phase captures a prediction frame for each predicted entity. Histories are stored outside EnTT in fixed-capacity rings keyed by stable network ID.

The default history holds 64 frames—roughly one second at 60 Hz. Each frame contains:

- local simulation tick;
- input sequence;
- prediction island ID;
- encoded rollback state;
- input type and payload.

The default rollback state includes simulation transform, linear and angular motion, and character-controller runtime values such as grounded state and vertical velocity.

```cpp title="C++-style pseudocode"
struct PredictionFrame {
    Tick local_tick;
    uint32 input_sequence;
    PredictionIsland island;

    Bytes rollback_state;   // Transform, motion, controller runtime.
    CommandType input_type;
    Bytes input_payload;
};

history[network_id].push(capture_frame(entity, command));
```

Position alone is not enough. Imagine correcting a character to the right location but leaving the controller convinced it is falling when the server says it is grounded. The next replayed jump or gravity step would immediately diverge again.

The rollback schema is descriptor-based, so more component state can be registered as prediction grows. As with replication fragments, the goal is to make the required state explicit rather than serialize the entire registry.

## Receiving an authoritative correction

When a replication update targets a predicted entity, transform and motion are not blindly written into the ECS. The prediction runtime turns the update into a correction containing:

- the stable entity reference;
- authoritative server tick;
- last processed input sequence;
- authoritative transform and/or motion.

It then searches history for the frame with the acknowledged input sequence.

```cpp title="C++-style pseudocode"
ReconcileResult reconcile(Correction correction) {
    Entity e = world.resolve(correction.entity);
    PredictionFrame* frame = history.find(correction.last_processed_input);

    if (frame == null)
        return hard_apply_without_replay(e, correction);

    if (within_tolerance(frame->rollback_state, correction)) {
        history.discard_through(correction.last_processed_input);
        return InTolerance;
    }

    return rewind_and_replay(e, frame, correction);
}
```

This produces three useful outcomes.

### 1. No matching history

The saved frame may already have fallen out of the ring, or the acknowledgement may not correspond to any local command. The safest fallback is to apply the authoritative ECS state and restore physics from it.

This corrects truth, but it cannot accurately replay the missing relationship between past and current input.

### 2. Prediction was close enough

Tiny differences are inevitable and often invisible. Correcting every microscopic mismatch would create more jitter than accuracy.

The default character profile currently accepts a prediction when:

- position error is at most 0.05 units;
- quaternion error `1 - abs(dot)` is at most 0.02;
- linear and angular velocity errors are each at most 0.5 in vector magnitude.

If the saved frame is within tolerance, the client simply discards frames through the acknowledged input and keeps its current predicted result.

### 3. Prediction was meaningfully wrong

The client restores the authoritative state, teleports the character controller to match the corrected ECS pose, discards acknowledged frames, and replays the remaining commands.

## Replaying the real simulation pipeline

The replay path does not call a special `predict_position()` helper. It runs the same registered phases needed to produce movement:

```text
apply authoritative ECS transform and motion
    -> restore character physics from ECS
    -> discard acknowledged history
    -> for each still-unacknowledged input:
        queue saved input
        run Input
        run PrePhysics
        run Physics
        run PostPhysics
        capture a corrected history frame
```

In pseudocode:

```cpp title="C++-style pseudocode"
void rewind_and_replay(Entity e, Correction correction) {
    Transform visually_old_pose = registry.get<SimulationTransform>(e);

    apply_authoritative_components(e, correction);
    physics.teleport_from_ecs(e);

    history.discard_through(correction.last_processed_input);

    for (PredictionFrame saved : history.remaining_frames()) {
        world.queue_input(decode(saved.input_payload));

        pipeline.run(Input, ReplayMode);
        pipeline.run(PrePhysics, ReplayMode);
        pipeline.run(Physics, ReplayMode);
        pipeline.run(PostPhysics, ReplayMode);

        saved.rollback_state = capture_rollback_state(e);
    }

    install_visual_correction(visually_old_pose,
                              registry.get<SimulationTransform>(e));
}
```

Structural barriers, ordinary gameplay, replication, automatic history capture, and clock advance are skipped during replay. The replay is reconstructing the movement path inside one client tick, not pretending several new global ticks have elapsed.

This design also keeps the simulation/presentation distinction intact. By the end of replay, collision and gameplay state are corrected immediately.

## Correct the truth, soften the picture

An out-of-tolerance correction may move the simulation by a visible distance. Leaving the predicted pose untouched would be dishonest; snapping the rendered model can look terrible.

Gildenkrieg separates those concerns with a presentation smoothing offset.

After replay, the simulation transform stays at the corrected result. The presentation layer begins with an offset that keeps the model near the pose it occupied before correction, then decays that offset over 0.15 seconds.

```cpp title="C++-style pseudocode"
void install_visual_correction(Transform before, Transform corrected) {
    PresentationSmoothing smoothing;
    smoothing.position_offset = before.position - corrected.position;
    smoothing.remaining_seconds = 0.15;

    registry.emplace_or_replace(player, smoothing);
}

void sample_local_presentation(float frame_dt) {
    Transform simulation = registry.get<SimulationTransform>(player);
    PresentationSmoothing& smoothing = registry.get<PresentationSmoothing>(player);

    presentation.position = simulation.position + smoothing.position_offset;
    smoothing.position_offset *= decay(frame_dt, smoothing.remaining_seconds);
}
```

The visual error fades; it never feeds back into the character controller. Position corrections are smoothed today. Rotation-offset infrastructure exists, but rotational corrections currently appear immediately.

This is the same principle used for remote interpolation in [Part 2](/articles/gildenkrieg-simulation-devlog-part-2): **presentation is allowed to be aesthetically late, but simulation must be logically current**.
