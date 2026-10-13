---
title: 'Devlog: Building Gildenkrieg’s Networking Foundation'
description: 'A look at the decisions, tradeoffs, and lessons behind building a serious networking layer for Gildenkrieg.'
publishedAt: 2026-07-26
updatedAt: 2026-09-11T03:44:20Z
category: game-development
tags: [gildenkrieg, devlog, gamedev, networking, c, c++]
draft: false
featured: true
---

"Make the client talk to the server" sounds like a small task.

At first, it almost is. Open a connection, send a few bytes, receive a few bytes, and celebrate when "hello" appears on another computer.

Then the real questions begin.

What happens when a message arrives in pieces? What if an old movement update arrives after a newer one? What if a player disconnects while the server is still preparing a reply? What if hundreds of messages arrive during the same frame? Who is allowed to touch the connection, and from which thread?

That is how a networking experiment turns into engine infrastructure.

For **[Gildenkrieg](https://www.armenderoian.dev/gildenkrieg)**, my space-centered strategy game, I wanted a foundation that could eventually support more than a successful local connection. It needed to be predictable, understandable, and flexible enough for different kinds of game traffic.

That work became `gk_network`.

This devlog is not an API tour or a list of repository features. It is a look at how I approached building a networking library of this size, why several of its systems exist, and what I learned while turning "send some bytes" into something the rest of a game can depend on.

## Starting with the game's needs

Gildenkrieg will not send only one kind of information.

Some messages are important and should arrive in order: joining a session, changing a fleet's orders, transferring ownership, or completing a transaction. Other messages may become useless almost immediately. If the game has already received a ship's newest position, waiting for an older position update can do more harm than good.

That is why the library supports both TCP and UDP.

TCP is the careful courier. It keeps data ordered and makes sure it arrives, but it treats everything as one continuous stream. The receiver has to work out where each message begins and ends.

UDP is closer to sending individual notes. It is a better fit for time-sensitive traffic, but raw UDP does not promise delivery or order. I use ENet on top of UDP to provide practical game-oriented options such as reliable packets, channels, and sequencing.

The goal was never to hide the difference between these transports. They behave differently for good reasons. The goal was to let the game describe a message once and then choose the delivery method that fits it.

In C-style pseudocode, I wanted gameplay code to feel roughly like this:

```c title="C-style pseudocode"
struct FleetOrder {
    FleetId fleet;
    StarSystemId destination;
};

register_message(FLEET_ORDER, encode_fleet_order, handle_fleet_order);

FleetOrder order = {
    .fleet = selected_fleet,
    .destination = target_system
};

send_message(server, FLEET_ORDER, &order, RELIABLE);
```

The interesting work should be defining and handling `FleetOrder`, not rebuilding packet framing every time the transport changes.

## Giving every message a common shape

TCP delivers a stream of bytes, not a stream of neatly separated game messages. One message might arrive across several reads. Several messages might arrive together.

To solve that, every registered message in `gk_network` gets a small envelope. The envelope says how large the message is and what kind of message it contains. The remaining bytes are the actual game data.

Conceptually, it looks like this:

```c title="C-style pseudocode"
struct NetworkMessage {
    unsigned int body_size;
    unsigned int message_type;
    byte payload[body_size];
};
```

The message type acts like a label. A fleet order has one label, a chat message another, and a lobby update another. When a complete message arrives, the library looks up the matching handler and passes the decoded data to the game.

The same envelope is used over TCP and UDP. TCP uses the size to rebuild messages from its byte stream. UDP already preserves packet boundaries, but keeping the same format means both transports can share registration, encoding, validation, and handling code.

This became the central idea of the library: **share the game protocol, not the transport behavior**.

It is a small distinction, but it kept the abstraction honest. TCP still behaves like TCP. UDP still behaves like UDP. The game simply does not need two separate definitions of "fleet order."

## Keeping networking away from the game loop

Networking happens on its own schedule. Data may arrive while the game is rendering, updating AI, loading assets, or waiting for player input.

Letting every part of the game reach directly into the networking backend would make the code difficult to reason about. It would also invite several threads to change the same connection at once.

For the UDP side, I chose a dedicated service thread. Game systems place requests into a queue. The service thread owns ENet, processes those requests, receives new traffic, and places incoming events into another queue. The game decides when to poll and handle those events.

The flow can be described in C-style pseudocode:

```c title="C-style pseudocode"
// Called by gameplay code.
queue_network_command(SEND_MESSAGE, message);

// Runs on the networking thread.
while (network_is_running) {
    process_queued_commands();
    service_incoming_traffic();
    queue_events_for_the_game();
}

// Called at a controlled point in the game loop.
while (poll_network_event(&event)) {
    handle_event(event);
    release_event(event);
}
```

This arrangement gives each side a clear responsibility.

The networking thread owns the backend. Gameplay code owns gameplay decisions. Queues carry work between them.

That separation matters because message handlers may change game state. I would rather run those handlers at a known point in the game loop than have a network thread interrupt the game at an arbitrary moment.

TCP currently uses callbacks from its host thread, so the two transports do not present an identical threading model. That is another example of preserving real behavior rather than forcing everything behind one misleading interface.

## Protecting players from stale messages

One of the most subtle problems appeared around disconnected players.

Imagine that player A occupies connection slot 12. The game queues a message for that slot. Before the network thread sends it, player A disconnects. Player B connects and happens to reuse slot 12.

If the library remembers only the slot number, the delayed message could be sent to the wrong player.

The solution is a generation-based peer handle:

```c title="C-style pseudocode"
struct PeerHandle {
    unsigned int slot;
    unsigned int generation;
};

bool peer_is_current(PeerHandle peer) {
    return connections[peer.slot].generation == peer.generation;
}
```

Whenever a slot is reused, its generation changes. A queued command is valid only when both the slot and generation still match.

This is similar to the way many game engines protect entity handles. An entity ID should not silently begin referring to a completely different object after the original entity is destroyed. A connection deserves the same protection.

It is a small structure, but it prevents a class of bugs that would otherwise be rare, confusing, and potentially disastrous in a multiplayer game.

## Choosing predictable memory use

Messages also need somewhere to live while they move between the game and networking threads.

The easiest option would be to allocate new memory for every packet. That is convenient, but it makes memory use depend directly on traffic. A sudden burst can create many allocations, more contention, and unpredictable pauses.

I chose a fixed packet-buffer pool instead.

At startup, the pool creates a known number of reusable buffers. Sending or receiving a message temporarily checks out one of those buffers. When the work is finished, the buffer returns to the pool.

```c title="C-style pseudocode"
PacketPool pool = create_packet_pool(
    buffer_count,
    bytes_per_buffer
);

PacketBuffer *buffer = reserve_buffer(&pool);

if (buffer == NULL) {
    record_network_pressure();
    decide_whether_to_drop_or_retry();
}

encode_message(buffer, message);
queue_for_network_thread(buffer);

// The final owner returns it when the send or receive is complete.
return_buffer(&pool, buffer);
```

The important part is not only avoiding allocations. It is making overload visible.

The pool can run out. A queue can fill. That is intentional. Instead of allowing memory use to grow without a clear limit, the library reports the pressure and lets the game choose what to do.

A disposable position update might be dropped. An important command might be retried. A consistently full queue might mean the game is not polling often enough or that the pool needs to be resized.

Predictability always comes with a tradeoff. A fixed pool requires more planning than unlimited allocation, but game engines already live on budgets: frame time, memory, bandwidth, and latency. Networking should be budgeted too.

## Why the core is C

The library is built around a C API, with an optional C++ wrapper.

C makes a useful foundation for engine code. The rules are visible, the data crossing the boundary is straightforward, and the library is not tied to one style of C++ application architecture.

That does not mean every C++ caller should manually clean up every resource. The wrapper adds move-only owners and automatic cleanup while keeping the underlying network behavior the same.

In C++-style pseudocode, the experience becomes:

```cpp title="C++-style pseudocode"
NetworkLibrary network;
PacketPool packets{pool_settings};
MessageRegistry messages;

messages.bind<FleetOrder>(FLEET_ORDER, on_fleet_order);

UdpClient client{
    server_address,
    packets,
    messages
};

client.connect();
client.send(FleetOrder{fleet, destination}, Reliable);

for (NetworkEvent event : client.poll_events()) {
    game.handle(event);
} // Resources are released automatically.
```

The C++ layer is there to improve ownership and ergonomics, not to create a second networking system. Both languages use the same packet format and the same underlying transports.

This split also taught me an important lesson: a wrapper cannot fix an unclear ownership rule underneath it. The C layer has to define who owns a buffer, event, host, or peer before C++ can safely automate that ownership.

## Building the library changed the library

The design did not appear fully formed.

Early versions exposed more backend details. As threading and queueing became more important, the UDP host became opaque. Peer references gained generations after I considered what slot reuse could do to delayed commands. Packet buffers moved toward clearer cross-thread ownership. Serialization helpers changed as more types of message data were needed.

Some older interfaces still exist mainly for compatibility, and some examples have fallen behind newer decisions. That is a familiar stage in engine development: the architecture has moved forward, but every trail left by the earlier design has not yet been cleaned up.

The core library builds and the major pieces are in place, but I do not consider the project finished or production-ready. There are still ownership rules to tighten, thread-safety boundaries to document, old examples to update, and tests to make more reliable.

That work is not separate from building the networking library. It is the work.

A prototype proves that two machines can exchange data. A dependable engine system has to prove what happens when data is late, incomplete, duplicated, oversized, queued during a disconnect, or produced faster than the game can consume it.

## What I learned

The first lesson was to avoid chasing a perfectly uniform interface. TCP and UDP are different tools. A useful abstraction lets them share message definitions without erasing the reasons to choose one over the other.

The second lesson was that ownership is as important as data. Knowing where a packet is matters less than knowing who must release it and which thread is allowed to use it.

The third lesson was to design failure paths early. Full queues, exhausted buffers, stale peer handles, malformed messages, and disconnects are not unusual edge cases in a networked game. They are normal conditions that deserve ordinary code paths.

The fourth lesson was that observability changes how a bounded system feels. "The message disappeared" is a mystery. "The outgoing queue reached capacity and dropped a nonessential update" is a problem that can be measured and solved.

Most of all, I learned that infrastructure earns trust through its contracts. Features are exciting, but the rest of Gildenkrieg needs to know exactly what the networking layer promises and what it does not.

## Where it goes next

The next phase is about strengthening the foundation rather than expanding it in every direction.

I want to finish aligning the examples with the current design, tighten connection and buffer ownership, improve automated client/server testing, and make the supported threading rules unmistakable. Fuzz testing the message parser is also a natural next step.

After that, the focus can move upward into Gildenkrieg itself: session handshakes, families of gameplay messages, and the systems that decide which information should be reliable, time-sensitive, private, or broadcast.

`gk_network` began with a basic goal: let the client talk to the server.

The more useful goal is now much clearer:

**Build a networking foundation that the rest of Gildenkrieg can trust, even when the network is doing everything networks eventually do.**
