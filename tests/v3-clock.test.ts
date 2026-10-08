import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioTransport } from '../src/audio-v3/audio-transport';
import { ClockTrace, type ClockObservation } from '../src/audio-v3/clock-trace';
import { SyntheticClockSource } from '../src/audio-v3/synthetic-clock';
import { VisualTimeGate } from '../src/audio-v3/visual-time-gate';

function harness(duration = 180) {
  let wallMs = 0, native = 0, pauses = 0;
  const requests: number[] = [];
  const transport = new AudioTransport(duration, () => wallMs);
  transport.attach({ play() {}, pause() { pauses++; }, seekToTime(value) { requests.push(value); }, readTime() { return native; } });
  return { transport, requests, get pauses() { return pauses; }, set native(value: number) { native = value; }, advance(ms: number) { wallMs += ms; } };
}

test('native playback stays monotonic without integrating frame intervals; pause, resume and buffering freeze', () => {
  const h = harness(); h.transport.play();
  for (let index = 0; index < 200; index++) {
    const position = index * 0.017; h.native = position; h.advance(17);
    assert.equal(h.transport.currentTime(), position);
  }
  h.advance(5000); assert.equal(h.transport.currentTime(), 199 * 0.017, 'No visual advancement during a native stall');
  h.transport.pause(); h.native = 40; h.advance(10000); assert.equal(h.transport.currentTime(), 199 * 0.017);
  h.native = 3.4; h.transport.play(); assert.equal(h.transport.currentTime(), 3.4);
  h.transport.setBuffering(true); h.native = 70; h.advance(20000); assert.equal(h.transport.currentTime(), 3.4);
  h.native = 3.42; h.transport.setBuffering(false); assert.equal(h.transport.currentTime(), 3.42);
});

test('rapid repeated seeks reject stale native and intermediate positions, then accept only the latest target', () => {
  const h = harness(); h.transport.play(); h.native = 100; h.transport.currentTime();
  h.transport.seek(10); h.transport.seek(50);
  assert.equal(h.transport.currentTime(), 50, 'Old source100 must not acknowledge latest50');
  h.native = 10; h.advance(20); assert.equal(h.transport.currentTime(), 50, 'Intermediate10 must not acknowledge latest50');
  h.native = 50.025; h.advance(20); assert.equal(h.transport.currentTime(), 50.025);
  assert.equal(h.transport.clockState().seekPending, false);
  h.transport.seek(120); h.native = 50.04; assert.equal(h.transport.currentTime(), 120);
  h.advance(120); h.native = 120.09; assert.equal(h.transport.currentTime(), 120.09);
  h.transport.seek(20); h.native = 119.9; assert.equal(h.transport.currentTime(), 20, 'Small old-clock correction must not release backward gate');
  h.native = 20.015; assert.equal(h.transport.currentTime(), 20.015);
});

test('paused and buffered seek waits do not enlarge acknowledgment window or exhaust timeout', () => {
  const h = harness(); h.transport.play(); h.native = 100; h.transport.currentTime();
  h.transport.seek(10); h.transport.pause(); h.advance(20000); h.transport.play();
  assert.equal(h.transport.currentTime(), 10); assert.equal(h.transport.clockState().seekPending, true);
  h.transport.setBuffering(true); h.advance(20000); h.transport.setBuffering(false);
  assert.equal(h.transport.currentTime(), 10); assert.equal(h.transport.clockState().seekWaitMs, 0);
  h.native = 10.01; assert.equal(h.transport.currentTime(), 10.01);
});

test('delayed native observation allows real elapsed playback and failed seek times out without revealing stale image', () => {
  const h = harness(); h.transport.play(); h.transport.seek(40); h.advance(800); h.native = 40.75;
  assert.equal(h.transport.currentTime(), 40.75);
  h.transport.seek(5); h.native = 90; h.advance(5000);
  assert.throws(() => h.transport.currentTime(), /did not finish seeking/);
  assert.equal(h.transport.clockState().position, 5);
  h.transport.seek(12); h.native = 12; assert.equal(h.transport.currentTime(), 12, 'A new seek replaces the failed wait');
});

test('end-of-track remains frozen and replay requests zero; invalid clocks still pause native source', () => {
  const h = harness(10); h.transport.play(); h.native = 9.9; h.transport.currentTime();
  h.transport.ended(); h.native = 0; assert.equal(h.transport.currentTime(), 10); assert.equal(h.transport.playing, false);
  h.transport.play(); assert.equal(h.requests.at(-1), 0); assert.equal(h.transport.currentTime(), 0);
  h.native = NaN; assert.throws(() => h.transport.pause(), /clock/); assert.equal(h.pauses, 1); assert.equal(h.transport.playing, false);
  assert.throws(() => h.transport.seek(Infinity), /Invalid playback/);
});

test('synthetic diagnostic clock anchors pause and seek directly without accumulated frame drift', () => {
  let now = 0; const source = new SyntheticClockSource(30, () => now);
  source.play(); now = 1234; assert.equal(source.readTime(), 1.234);
  source.pause(); now = 10000; assert.equal(source.readTime(), 1.234);
  source.seekToTime(20); source.play(); now = 10200; assert.equal(source.readTime(), 20.2);
  source.seekToTime(4); now = 10400; assert.equal(source.readTime(), 4.2);
  now = 50000; assert.equal(source.readTime(), 30);
});

const observation = (wallMs: number, nativePosition: number, patch: Partial<ClockObservation> = {}): ClockObservation => ({
  wallMs, rafMs: wallMs, nativePosition, position: nativePosition, renderedTime: nativePosition, mode: 'D', playing: true, buffering: false,
  seekId: 0, seekTarget: null, seekPending: false, seekWaitMs: 0, nativeReadMs: 0.04, expectedSceneIndex: 0, committedSceneIndex: 0, sceneCommitPending: false, ...patch,
});
test('bounded trace distinguishes seeks/buffering from unexplained corrections and scene commit lag', () => {
  const trace = new ClockTrace(4);
  trace.record(observation(0, 10));
  assert.deepEqual(trace.record(observation(16, 10.016)).flags, []);
  const backward = trace.record(observation(32, 9));
  assert.ok(backward.flags.includes('unexpected_native_backward')); assert.ok(backward.flags.includes('unexpected_render_backward'));
  const seeking = trace.record(observation(48, 9, { renderedTime: 20, seekId: 1, seekPending: true, seekTarget: 20 }));
  assert.ok(seeking.flags.includes('explicit_seek')); assert.ok(!seeking.flags.includes('unexpected_native_forward'));
  const acknowledged = trace.record(observation(64, 20, { seekId: 1, expectedSceneIndex: 1 }));
  assert.ok(acknowledged.flags.includes('seek_acknowledged')); assert.ok(acknowledged.flags.includes('seek_scene_commit_lag'));
  assert.equal(trace.snapshot().length, 4); assert.equal(trace.snapshot()[0]!.wallMs, 16);
  assert.equal(trace.summary().maxNativeRenderErrorMs, 0);
  trace.clear(); trace.record(observation(0, 1, { buffering: true }));
  assert.deepEqual(trace.record(observation(16, 1, { buffering: true })).flags, []);
  assert.ok(trace.record(observation(32, 1.1, { buffering: true })).flags.includes('held_time_changed'));
  const resumed = trace.record(observation(48, 2));
  assert.ok(resumed.flags.includes('buffering_end')); assert.ok(!resumed.flags.includes('unexpected_native_forward'));
  assert.ok(trace.record(observation(64, 4)).flags.includes('unexpected_native_forward'));
  trace.clear(); trace.record(observation(0, 1, { playing: false, seekId: 1, renderedTime: 1, sceneCommitPending: true }));
  assert.ok(!trace.record(observation(16, 1, { playing: false, seekId: 1, renderedTime: 20 })).flags.includes('held_time_changed'), 'A seek image released by its scene commit is an explained transition');
});

test('far visual seek publishes after matching scene commit; latest mounted seek cancels queued scene destination', () => {
  const gate = new VisualTimeGate();
  assert.deepEqual(gate.offer(80, 4, false), { publishTime: null, requestScene: 4 });
  assert.equal(gate.commit(1), null, 'An older React commit cannot release a later destination');
  assert.equal(gate.commit(4), 80); assert.equal(gate.waitingForCommit, false);
  gate.reset(); gate.offer(80, 4, false);
  assert.deepEqual(gate.offer(2, 0, true), { publishTime: 2, requestScene: 0 }, 'Cancel queued4 even though committed scene is already0');
  assert.equal(gate.commit(0), null); assert.equal(gate.waitingForCommit, false);
  assert.deepEqual(gate.offer(5, 1, true), { publishTime: 5, requestScene: 1 }, 'Pre-mounted incoming scene needs no held time');
});
