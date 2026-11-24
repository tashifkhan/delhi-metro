import type { AppBooking, MetroNetwork, PlannedJourney, TicketBooking, WhatsAppBooking } from '../types';

/**
 * Official booking links mirrored from `api/services/booking.py`.
 *
 * Fresh plans carry these links from the API. Plans saved earlier, and any
 * API deploy that predates the booking field, don't, so the app keeps its own
 * copy instead of hiding the booking cards. Keep both lists in step.
 */
const WHATSAPP: Record<'dmrc' | 'nmrc', { phone: string; label: string; note: string }> = {
  dmrc: {
    phone: '919650855800',
    label: 'Delhi Metro',
    note: 'Opens WhatsApp with Hi ready to send. The bot asks for the stations again.',
  },
  nmrc: {
    phone: '919599030188',
    label: 'Noida Metro',
    note: 'Opens WhatsApp with Hi ready to send. Tap Book Now, then pick the stations again.',
  },
};

const NCRTC: AppBooking = {
  channel: 'app',
  network: 'ncrtc',
  label: 'Namo Bharat Connect',
  url: 'https://namobharat.ncrtc.in/',
  android_url: 'https://play.google.com/store/apps/details?id=com.ncrtc',
  ios_url: 'https://apps.apple.com/in/app/namo-bharat-connect/id6448940583',
  note: 'Choose your stations in Namo Bharat Connect, or buy your ticket at the station.',
};

function whatsappBooking(network: 'dmrc' | 'nmrc'): WhatsAppBooking {
  const { phone, label, note } = WHATSAPP[network];
  return {
    network,
    label,
    phone: `+${phone}`,
    url: `https://wa.me/${phone}?text=${encodeURIComponent('Hi')}`,
    note,
  };
}

type BookingJourney = Pick<PlannedJourney, 'source' | 'networks' | 'legs' | 'fare' | 'bookings' | 'booking_options'>;

function riddenNetworks(plan: BookingJourney): MetroNetwork[] {
  const rides = plan.legs.filter((leg) => leg.kind !== 'transfer');
  if (plan.legs.length && rides.length === 0) return [];

  const legNetworks = rides.map((leg) => leg.network).filter((network) => network !== null && network !== undefined);
  if (legNetworks.length && legNetworks.length === rides.length) return legNetworks;
  if (plan.fare.breakdown.length) return plan.fare.breakdown.map((fare) => fare.network);
  if (plan.networks?.length) return plan.networks;
  return [plan.source === 'ncrtc' || plan.source === 'nmrc' ? plan.source : 'dmrc'];
}

/** Complete the per-operator list for live, cached and offline journeys. */
export function ticketBookingsFor(plan: BookingJourney): TicketBooking[] {
  const provided = new Map<MetroNetwork, TicketBooking>(
    [...(plan.bookings ?? []), ...(plan.booking_options ?? [])].map((booking) => [booking.network, booking]),
  );
  return [...new Set(riddenNetworks(plan))].map(
    (network) => provided.get(network) ?? (network === 'ncrtc' ? NCRTC : whatsappBooking(network)),
  );
}

export function bookingUrl(booking: TicketBooking, platform: string): string {
  if ('channel' in booking) {
    if (platform === 'android') return booking.android_url;
    if (platform === 'ios') return booking.ios_url;
  }
  return booking.url;
}
