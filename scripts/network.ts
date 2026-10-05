import net from 'node:net';

// Node 22 gives each address only 250 ms to connect, which is shorter than the round trip to
// Neon from far-away regions, so every attempt aborts with ETIMEDOUT. Give it room.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
