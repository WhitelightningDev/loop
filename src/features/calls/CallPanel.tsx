import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, PhoneOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCallSession, type CallKind } from "./useCallSession";
import { useCallActions } from "./useCallActions";

interface MemberLite {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export function CallPanel({
  callId,
  channelId,
  kind,
  members,
  onClose,
}: {
  callId: string;
  channelId: string;
  kind: CallKind;
  members: MemberLite[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { leaveCall } = useCallActions();
  const {
    localStream,
    remotes,
    muted,
    cameraOn,
    sharingScreen,
    connectionError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCallSession({ callId, userId: user?.id ?? null, kind, enabled: true });

  const handleHangup = async () => {
    await leaveCall(callId, channelId);
    onClose();
  };

  const findMember = (id: string) => members.find((m) => m.id === id);
  const showVideoGrid = kind === "video" || sharingScreen || remotes.some((r) => r.videoEnabled);

  const tileCount = remotes.length + 1;
  const gridCols =
    tileCount <= 1 ? "grid-cols-1" :
    tileCount === 2 ? "grid-cols-2" :
    tileCount <= 4 ? "grid-cols-2" :
    "grid-cols-3";

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.13_0.012_265)] text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-sm font-medium">
            {kind === "video" ? "Video call" : "Voice call"} · {tileCount} {tileCount === 1 ? "person" : "people"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <Users className="h-3.5 w-3.5" />
          {tileCount} on call
        </div>
      </div>

      {/* Stage */}
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {connectionError && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/20 px-3 py-2 text-sm text-destructive-foreground">
            {connectionError}
          </div>
        )}

        {showVideoGrid ? (
          <div className={cn("grid h-full gap-3", gridCols)}>
            <VideoTile
              stream={localStream}
              member={user ? findMember(user.id) ?? { id: user.id, full_name: "You" } : undefined}
              isLocal
              muted={muted}
              videoOn={cameraOn || sharingScreen}
              label={sharingScreen ? "You · sharing screen" : "You"}
            />
            {remotes.map((r) => (
              <VideoTile
                key={r.userId}
                stream={r.stream}
                member={findMember(r.userId)}
                videoOn={r.stream.getVideoTracks().some((t) => t.enabled)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <AvatarTile member={user ? findMember(user.id) ?? { id: user.id, full_name: "You" } : undefined} speaking={!muted} />
              {remotes.map((r) => (
                <AvatarTile key={r.userId} member={findMember(r.userId)} speaking />
              ))}
            </div>
            <p className="text-sm text-white/60">
              {remotes.length === 0 ? "Waiting for others to join…" : "Connected"}
            </p>
          </div>
        )}

        {/* Hidden audio sinks for remote audio when no video grid */}
        {!showVideoGrid && remotes.map((r) => (
          <RemoteAudio key={`a-${r.userId}`} stream={r.stream} />
        ))}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <ControlButton onClick={toggleMute} active={!muted} label={muted ? "Unmute" : "Mute"}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </ControlButton>
          <ControlButton onClick={toggleCamera} active={cameraOn} label={cameraOn ? "Stop video" : "Start video"}>
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </ControlButton>
          <ControlButton
            onClick={toggleScreenShare}
            active={sharingScreen}
            label={sharingScreen ? "Stop sharing" : "Share screen"}
          >
            {sharingScreen ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          </ControlButton>
          <Button onClick={handleHangup} variant="destructive" size="sm" className="ml-2 gap-1.5">
            <PhoneOff className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  children, onClick, active, label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-destructive/80 text-destructive-foreground hover:bg-destructive",
      )}
    >
      {children}
    </button>
  );
}

function VideoTile({
  stream, member, isLocal = false, muted = false, videoOn, label,
}: {
  stream: MediaStream | null;
  member?: MemberLite;
  isLocal?: boolean;
  muted?: boolean;
  videoOn: boolean;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-lg">
      {videoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn("h-full w-full object-cover", isLocal && "scale-x-[-1]")}
        />
      ) : (
        <div className="flex h-full min-h-[180px] w-full items-center justify-center">
          <Avatar className="h-20 w-20 ring-2 ring-white/15">
            <AvatarImage src={member?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-white/10 text-lg text-white">
              {(member?.full_name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs">
        <span className="font-medium">{label ?? member?.full_name ?? "Member"}</span>
        {isLocal && muted && <MicOff className="h-3.5 w-3.5 text-destructive" />}
      </div>
    </div>
  );
}

function AvatarTile({ member, speaking }: { member?: MemberLite; speaking?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "rounded-full p-1 transition-shadow",
        speaking ? "ring-2 ring-success/60" : "ring-1 ring-white/10",
      )}>
        <Avatar className="h-20 w-20">
          <AvatarImage src={member?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-white/10 text-xl text-white">
            {(member?.full_name ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="text-sm font-medium">{member?.full_name ?? "Member"}</div>
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}
