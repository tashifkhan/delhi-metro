import type { MetroNetwork, WhatsAppBooking } from '../types';

/**
 * The operators' WhatsApp ticket bots, mirrored from `api/services/booking.py`.
 *
 * Fresh plans carry these links from the API. Plans saved earlier, and any
 * API deploy that predates the booking field, don't, so the app keeps its own
 * copy instead of hiding the booking cards. Keep both lists in step.
 */
const CHANNELS: Record<MetroNetwork, { phone: string; label: string; note: string }> = {
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

export function whatsappBooking(network: MetroNetwork): WhatsAppBooking {
  const { phone, label, note } = CHANNELS[network];
  return {
    network,
    label,
    phone: `+${phone}`,
    url: `https://wa.me/${phone}?text=${encodeURIComponent('Hi')}`,
    note,
  };
}

/** One link per network, in travel order, with duplicates dropped. */
export function bookingsFor(networks: MetroNetwork[]): WhatsAppBooking[] {
  return [...new Set(networks)].filter((n) => n in CHANNELS).map(whatsappBooking);
}
