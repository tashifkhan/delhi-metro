"""Walking links between stations on separately ticketed networks."""

from dataclasses import dataclass

from core.catalog import get_catalog
from schemas.planner import MetroNetwork


@dataclass(frozen=True, slots=True)
class NetworkInterchange:
    dmrc_code: str
    dmrc_name: str
    other_network: MetroNetwork
    other_code: str
    other_name: str
    walk_minutes: int
    walk_metres: int | None
    note: str

    def code_for(self, network: MetroNetwork) -> str:
        return self.dmrc_code if network is MetroNetwork.DMRC else self.other_code

    def name_for(self, network: MetroNetwork) -> str:
        return self.dmrc_name if network is MetroNetwork.DMRC else self.other_name

    def other_side(self, network: MetroNetwork) -> MetroNetwork:
        return self.other_network if network is MetroNetwork.DMRC else MetroNetwork.DMRC


SECTOR_52_51 = NetworkInterchange(
    dmrc_code="SFTN",
    dmrc_name="SECTOR - 52 NOIDA",
    other_network=MetroNetwork.NMRC,
    other_code="NM01",
    other_name="Noida Sector 51",
    walk_minutes=6,
    walk_metres=300,
    note=(
        "Leave the Delhi Metro at Noida Sector 52 and walk across the "
        "foot-overbridge to the Noida Metro Aqua Line at Noida Sector 51. The "
        "two networks are ticketed separately, so buy a new ticket here."
    ),
)


def _ncrtc_link(
    slug: str,
    ncrtc_code: str,
    name: str,
    minutes: int,
    note: str,
) -> NetworkInterchange:
    station = get_catalog().by_slug[slug]
    return NetworkInterchange(
        dmrc_code=station.legacy_code,
        dmrc_name=station.name,
        other_network=MetroNetwork.NCRTC,
        other_code=ncrtc_code,
        other_name=name,
        walk_minutes=minutes,
        walk_metres=None,
        note=note,
    )


# Initial walk-time estimates. Distances are unknown for the NCRTC connections.
INTERCHANGES = (
    SECTOR_52_51,
    _ncrtc_link(
        "sarai-kale-khan-nizamuddin",
        "Z00",
        "Sarai Kale Khan",
        10,
        "Follow signs between Sarai Kale Khan–Nizamuddin and Namo Bharat.",
    ),
    _ncrtc_link(
        "new-ashok-nagar",
        "A01",
        "New Ashok Nagar",
        8,
        "Follow signs between the Delhi Metro and Namo Bharat stations.",
    ),
    _ncrtc_link(
        "anand-vihar-isbt",
        "A02",
        "Anand Vihar",
        10,
        "Use the foot-overbridge at Delhi Metro gate 3.",
    ),
    _ncrtc_link(
        "shaheed-sthal-new-bus-adda",
        "A04",
        "Ghaziabad",
        5,
        "Use Delhi Metro gate 3 to walk between Shaheed Sthal and Ghaziabad.",
    ),
)


def find_interchanges(
    from_network: MetroNetwork,
    to_network: MetroNetwork,
) -> tuple[NetworkInterchange, ...]:
    return tuple(
        link
        for link in INTERCHANGES
        if {from_network, to_network} == {MetroNetwork.DMRC, link.other_network}
    )


def find_interchange(
    from_network: MetroNetwork,
    to_network: MetroNetwork,
) -> NetworkInterchange | None:
    """Return the first direct link for callers that only need one."""

    return next(iter(find_interchanges(from_network, to_network)), None)
