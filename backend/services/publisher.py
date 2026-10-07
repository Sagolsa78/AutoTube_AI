import logging
from typing import Protocol

from backend.models.models import PlatformConnection, Publication

log = logging.getLogger(__name__)


class PublishingProvider(Protocol):
    """
    Protocol defining the interface for platform-specific publishers.
    """

    async def validate_connection(self, connection: PlatformConnection) -> bool:
        """Returns True if the connection is healthy and authorized."""
        ...

    async def publish(
        self, publication: Publication, connection: PlatformConnection, video_path: str
    ) -> str:
        """
        Publishes a video to the platform.
        Returns the platform-specific remote media ID on success.
        """
        ...

    async def get_status(
        self, publication: Publication, connection: PlatformConnection
    ) -> str:
        """Returns the current status on the platform side."""
        ...

    async def delete(
        self, publication: Publication, connection: PlatformConnection
    ) -> bool:
        """Deletes the publication from the platform."""
        ...


class YouTubeProvider:
    async def validate_connection(self, connection: PlatformConnection) -> bool:
        # TODO: Implement true validation against the provider
        return True

    async def publish(
        self, publication: Publication, connection: PlatformConnection, video_path: str
    ) -> str:
        from integrations.youtube.uploader import upload_video

        return await upload_video(publication, connection, video_path)

    async def get_status(
        self, publication: Publication, connection: PlatformConnection
    ) -> str:
        return "PUBLISHED"

    async def delete(
        self, publication: Publication, connection: PlatformConnection
    ) -> bool:
        return True


class TikTokProvider:
    async def validate_connection(self, connection: PlatformConnection) -> bool:
        return True

    async def publish(
        self, publication: Publication, connection: PlatformConnection, video_path: str
    ) -> str:
        from integrations.tiktok.uploader import upload_video

        return await upload_video(publication, connection, video_path)

    async def get_status(
        self, publication: Publication, connection: PlatformConnection
    ) -> str:
        return "PUBLISHED"

    async def delete(
        self, publication: Publication, connection: PlatformConnection
    ) -> bool:
        return True


class InstagramProvider:
    async def validate_connection(self, connection: PlatformConnection) -> bool:
        return True

    async def publish(
        self, publication: Publication, connection: PlatformConnection, video_path: str
    ) -> str:
        from integrations.instagram.uploader import upload_video

        return await upload_video(publication, connection, video_path)

    async def get_status(
        self, publication: Publication, connection: PlatformConnection
    ) -> str:
        return "PUBLISHED"

    async def delete(
        self, publication: Publication, connection: PlatformConnection
    ) -> bool:
        return True


class FacebookProvider:
    async def validate_connection(self, connection: PlatformConnection) -> bool:
        return True

    async def publish(
        self, publication: Publication, connection: PlatformConnection, video_path: str
    ) -> str:
        from integrations.facebook.uploader import upload_video

        return await upload_video(publication, connection, video_path)

    async def get_status(
        self, publication: Publication, connection: PlatformConnection
    ) -> str:
        return "PUBLISHED"

    async def delete(
        self, publication: Publication, connection: PlatformConnection
    ) -> bool:
        return True


class ProviderFactory:
    """Factory to return the correct PublishingProvider instance."""

    _providers = {
        "youtube": YouTubeProvider(),
        "tiktok": TikTokProvider(),
        "instagram": InstagramProvider(),
        "facebook": FacebookProvider(),
    }

    @classmethod
    def get_provider(cls, platform: str) -> PublishingProvider:
        provider = cls._providers.get(platform.lower())
        if not provider:
            raise ValueError(f"Unsupported publishing platform: {platform}")
        return provider


def get_publisher(platform: str) -> PublishingProvider:
    return ProviderFactory.get_provider(platform)
