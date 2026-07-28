"""Links between the Delhi Metro and Noida Metro networks.

The two operators run separate networks with separate ticketing, connected at
one point: Noida Sector 52 on the DMRC Blue Line and Noida Sector 51, the Aqua
Line terminus, are adjacent stations joined by a foot-overbridge. Interchanging
means leaving one system, walking across, and buying a second ticket.

This module is the single place that knowledge lives, so `services.planner` can
stitch a journey across both networks.
"""

from __future__ import annotations

from dataclasses import dataclass

from schemas.planner import MetroNetwork


@dataclass(frozen=True, slots=True)
class NetworkInterchange:
    """A walking connection between a DMRC station and an NMRC station."""

    dmrc_code: str
    dmrc_name: str
    nmrc_code: str
    nmrc_name: str
    walk_minutes: int
    walk_metres: int
    note: str

    def code_for(self, network: MetroNetwork) -> str:
        """Return the station code on one side of the interchange."""

        return self.dmrc_code if network is MetroNetwork.DMRC else self.nmrc_code

    def name_for(self, network: MetroNetwork) -> str:
        """Return the station name on one side of the interchange."""

        return self.dmrc_name if network is MetroNetwork.DMRC else self.nmrc_name


SECTOR_52_51 = NetworkInterchange(
    dmrc_code="SFTN",
    dmrc_name="SECTOR - 52 NOIDA",
    nmrc_code="NM01",
    nmrc_name="Noida Sector 51",
    walk_minutes=6,
    walk_metres=300,
    note=(
        "Leave the Delhi Metro at Noida Sector 52 and walk across the "
        "foot-overbridge to the Noida Metro Aqua Line at Noida Sector 51. The "
        "two networks are ticketed separately, so buy a new ticket here."
    ),
)

INTERCHANGES: tuple[NetworkInterchange, ...] = (SECTOR_52_51,)


def find_interchange(
    from_network: MetroNetwork,
    to_network: MetroNetwork,
) -> NetworkInterchange | None:
    """Return the interchange linking two different networks.

    Returns `None` for a same-network pair, and for any future network pair
    with no published walking connection.
    """

    if from_network is to_network:
        return None

    networks = {from_network, to_network}
    for interchange in INTERCHANGES:
        if networks == {MetroNetwork.DMRC, MetroNetwork.NMRC}:
            return interchange
    return None
