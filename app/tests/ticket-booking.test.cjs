const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/services/ticketBooking.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });

const { bookingUrl, ticketBookingsFor } = exported;
const ride = (network) => ({ kind: 'metro', network });
const walk = { kind: 'transfer', network: null };

test('completes old API and offline booking lists in travel order', () => {
  const noida = { network: 'nmrc', phone: '+919599030188', url: 'https://wa.me/919599030188?text=Hi' };
  const plan = {
    source: 'combined',
    networks: ['nmrc', 'dmrc', 'ncrtc'],
    legs: [ride('nmrc'), walk, ride('dmrc'), walk, ride('ncrtc'), ride('ncrtc')],
    fare: { breakdown: [] },
    bookings: [noida],
  };
  const bookings = ticketBookingsFor(plan);

  assert.deepEqual(Array.from(bookings, (item) => item.network), ['nmrc', 'dmrc', 'ncrtc']);
  assert.equal(bookings[0], noida);
  assert.equal(bookingUrl(bookings[1], 'android'), 'https://wa.me/919650855800?text=Hi');
  assert.match(bookingUrl(bookings[2], 'android'), /id=com\.ncrtc$/);
  assert.match(bookingUrl(bookings[2], 'ios'), /id6448940583$/);
  assert.equal(bookingUrl(bookings[2], 'web'), 'https://namobharat.ncrtc.in/');
});

test('a walking handover does not add a ticket for an operator the passenger never rides', () => {
  const plan = {
    source: 'combined',
    networks: ['nmrc', 'dmrc', 'ncrtc'],
    legs: [walk, ride('dmrc'), walk, ride('ncrtc')],
    fare: { breakdown: [] },
  };

  assert.deepEqual(Array.from(ticketBookingsFor(plan), (item) => item.network), ['dmrc', 'ncrtc']);
  assert.equal(ticketBookingsFor({ ...plan, legs: [walk] }).length, 0);
});
