import { createFileRoute } from "@tanstack/react-router";
import { ChannelView } from "@/features/messages/ChannelView";

export const Route = createFileRoute("/app/c/$channelId")({
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = Route.useParams();
  return <ChannelView channelId={channelId} />;
}
