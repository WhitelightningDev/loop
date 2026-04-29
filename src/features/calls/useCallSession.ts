import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * WebRTC mesh call powered by Supabase Realtime broadcast for signaling.
 * - Each peer in the call opens an RTCPeerConnection to every other peer.
 * - Offers / answers / ICE candidates are broadcast over a per-call channel.
 * - Local media (audio/video/screen) is added as tracks; renegotiation
 *   happens automatically via `negotiationneeded`.
 */

export type CallKind = "voice" | "video";

export interface RemotePeer {
  userId: string;
  stream: MediaStream;
  videoEnabled: boolean;
}

interface SignalPayload {
  from: string;
  to?: string;
  kind: "hello" | "offer" | "answer" | "ice" | "bye";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export function useCallSession(opts: {
  callId: string | null;
  userId: string | null;
  kind: CallKind;
  enabled: boolean;
}) {
  const { callId, userId, kind, enabled } = opts;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(kind === "video");
  const [sharingScreen, setSharingScreen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  // ─── Acquire local media ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !callId || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: kind === "video" ? { width: 1280, height: 720 } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
      } catch (err: any) {
        setConnectionError(
          err?.message ?? "Could not access microphone/camera. Check permissions.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, callId, userId, kind]);

  // ─── Build a peer connection to a specific remote ──────────────────────
  const buildPeer = useCallback(
    (remoteId: string, isPolite: boolean) => {
      if (peersRef.current[remoteId]) return peersRef.current[remoteId];

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current[remoteId] = pc;

      // Add current local tracks
      if (localRef.current) {
        for (const track of localRef.current.getTracks()) {
          pc.addTrack(track, localRef.current);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current && userId) {
          void channelRef.current.send({
            type: "broadcast",
            event: "signal",
            payload: {
              from: userId,
              to: remoteId,
              kind: "ice",
              candidate: e.candidate.toJSON(),
            } satisfies SignalPayload,
          });
        }
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        setRemotes((prev) => {
          const existing = prev[remoteId];
          const videoEnabled = stream.getVideoTracks().some((t) => t.enabled);
          return {
            ...prev,
            [remoteId]: {
              userId: remoteId,
              stream,
              videoEnabled,
            },
          };
        });
      };

      pc.onnegotiationneeded = async () => {
        try {
          await pc.setLocalDescription();
          if (channelRef.current && userId && pc.localDescription) {
            void channelRef.current.send({
              type: "broadcast",
              event: "signal",
              payload: {
                from: userId,
                to: remoteId,
                kind: "offer",
                sdp: pc.localDescription,
              } satisfies SignalPayload,
            });
          }
        } catch (err) {
          console.error("Negotiation error", err);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          delete peersRef.current[remoteId];
          setRemotes((prev) => {
            const { [remoteId]: _, ...rest } = prev;
            return rest;
          });
        }
      };

      return pc;
    },
    [userId],
  );

  // ─── Join the signaling channel ────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !callId || !userId || !localStream) return;

    const ch = supabase.channel(`call:${callId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    channelRef.current = ch;

    ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const sig = payload as SignalPayload;
      if (!sig || sig.from === userId) return;
      if (sig.to && sig.to !== userId) return;

      const remoteId = sig.from;

      try {
        if (sig.kind === "hello") {
          // Existing peer initiates offer to newcomer (we offer if our id < theirs)
          if (userId < remoteId) {
            buildPeer(remoteId, false); // negotiationneeded fires
          } else {
            // Wait for their offer
            buildPeer(remoteId, true);
          }
        } else if (sig.kind === "offer" && sig.sdp) {
          const pc = buildPeer(remoteId, true);
          await pc.setRemoteDescription(sig.sdp);
          await pc.setLocalDescription();
          if (pc.localDescription) {
            void ch.send({
              type: "broadcast",
              event: "signal",
              payload: {
                from: userId,
                to: remoteId,
                kind: "answer",
                sdp: pc.localDescription,
              } satisfies SignalPayload,
            });
          }
        } else if (sig.kind === "answer" && sig.sdp) {
          const pc = peersRef.current[remoteId];
          if (pc) await pc.setRemoteDescription(sig.sdp);
        } else if (sig.kind === "ice" && sig.candidate) {
          const pc = peersRef.current[remoteId];
          if (pc) {
            try {
              await pc.addIceCandidate(sig.candidate);
            } catch (err) {
              console.warn("ICE add failed", err);
            }
          }
        } else if (sig.kind === "bye") {
          const pc = peersRef.current[remoteId];
          if (pc) pc.close();
          delete peersRef.current[remoteId];
          setRemotes((prev) => {
            const { [remoteId]: _, ...rest } = prev;
            return rest;
          });
        }
      } catch (err) {
        console.error("Signal handling error", err);
      }
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Announce ourselves so existing peers can offer to us
        await ch.send({
          type: "broadcast",
          event: "signal",
          payload: { from: userId, kind: "hello" } satisfies SignalPayload,
        });
      }
    });

    return () => {
      // Tell others we're leaving
      void ch.send({
        type: "broadcast",
        event: "signal",
        payload: { from: userId, kind: "bye" } satisfies SignalPayload,
      });
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      setRemotes({});
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [enabled, callId, userId, localStream, buildPeer]);

  // ─── Cleanup local media on unmount/disable ────────────────────────────
  useEffect(() => {
    return () => {
      localRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      screenRef.current = null;
    };
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localRef.current) return;
    const next = !muted;
    localRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(async () => {
    if (!localRef.current) return;
    const videoTracks = localRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const next = !cameraOn;
      videoTracks.forEach((t) => (t.enabled = next));
      setCameraOn(next);
      return;
    }
    // No video track yet — add one
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = cam.getVideoTracks()[0];
      localRef.current.addTrack(track);
      Object.values(peersRef.current).forEach((pc) => {
        pc.addTrack(track, localRef.current!);
      });
      setCameraOn(true);
      setLocalStream(new MediaStream(localRef.current.getTracks()));
    } catch (err: any) {
      setConnectionError(err?.message ?? "Could not start camera");
    }
  }, [cameraOn]);

  const toggleScreenShare = useCallback(async () => {
    if (sharingScreen) {
      // Stop screen, restore camera track on senders
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      const camTrack = localRef.current?.getVideoTracks()[0] ?? null;
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) void sender.replaceTrack(camTrack);
      });
      setSharingScreen(false);
      return;
    }
    try {
      const display = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack: MediaStreamTrack = display.getVideoTracks()[0];
      screenRef.current = display;
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          void sender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, display);
        }
      });
      screenTrack.onended = () => {
        setSharingScreen(false);
        const camTrack = localRef.current?.getVideoTracks()[0] ?? null;
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) void sender.replaceTrack(camTrack);
        });
      };
      setSharingScreen(true);
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        setConnectionError(err?.message ?? "Could not start screen share");
      }
    }
  }, [sharingScreen]);

  return {
    localStream,
    remotes: Object.values(remotes),
    muted,
    cameraOn,
    sharingScreen,
    connectionError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
