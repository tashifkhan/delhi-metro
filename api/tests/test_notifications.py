from __future__ import annotations

import unittest

from pydantic import TypeAdapter

from schemas.notification import PassengerNotification

_notification_adapter = TypeAdapter(list[PassengerNotification])


def _notification(**overrides: object) -> dict[str, object]:
    """Build a DMRC-shaped notification, with the fields that drift overridable."""

    payload: dict[str, object] = {
        "id": 557,
        "title": "DELHI METRO TO RESUME SERVICES EARLY",
        "notification_type": {
            "name": "Notices",
            "image": {
                "title": "notification.png",
                "file": "/media/original_images/notification.png",
            },
        },
        "image": {
            "title": "notification (1).png",
            "file": "/media/original_images/notification_1.png",
        },
        "video_url": "",
        "link_to": "outside_page_url",
        "link_to_file": None,
        "link_to_internal_page": None,
        "link_to_outside_url": None,
        "date": "2026-11-16",
    }
    payload.update(overrides)
    return payload


class PassengerNotificationParsingTests(unittest.TestCase):
    def test_attachment_object_is_flattened_to_its_file_path(self) -> None:
        payload = [
            _notification(
                link_to_file={
                    "title": "(NOTIFICATION).pdf",
                    "file": "/media/documents/NOTIFICATION.pdf",
                }
            )
        ]

        notifications = _notification_adapter.validate_python(payload)

        self.assertEqual(
            notifications[0].link_to_file,
            "/media/documents/NOTIFICATION.pdf",
        )
        # The published contract stays a string, so clients need no change.
        self.assertEqual(
            notifications[0].model_dump()["link_to_file"],
            "/media/documents/NOTIFICATION.pdf",
        )

    def test_plain_attachment_path_is_kept(self) -> None:
        payload = [_notification(link_to_file="/media/documents/NOTIFICATION.pdf")]

        notifications = _notification_adapter.validate_python(payload)

        self.assertEqual(
            notifications[0].link_to_file,
            "/media/documents/NOTIFICATION.pdf",
        )

    def test_missing_attachment_stays_null(self) -> None:
        notifications = _notification_adapter.validate_python([_notification()])

        self.assertIsNone(notifications[0].link_to_file)


if __name__ == "__main__":
    unittest.main()
