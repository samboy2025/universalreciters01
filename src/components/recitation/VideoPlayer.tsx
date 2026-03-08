import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Lock, Clock, Eye, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface VideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  views: number;
  unlock_fee: number;
  arabic_text: string;
  video_url: string;
}

interface VideoPlayerProps {
  onSelectVideo: (video: VideoItem) => void;
}

const VideoPlayer = ({ onSelectVideo }: VideoPlayerProps) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, duration, views, unlock_fee, arabic_text, video_url")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        setVideos(data);
        setSelectedVideo(data[0]);
        onSelectVideo(data[0]);
      }
      setLoading(false);
    };
    fetchVideos();
  }, []);

  const isUnlocked = (video: VideoItem) =>
    video.unlock_fee === 0 || (profile?.money_balance || 0) >= video.unlock_fee;

  const handleVideoSelect = (video: VideoItem) => {
    if (!isUnlocked(video)) return;
    setSelectedVideo(video);
    onSelectVideo(video);
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          Recitation Videos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Video Player */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {selectedVideo ? (
            isPlaying ? (
              <video
                src={selectedVideo.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center bg-primary/5">
                  <div className="text-center">
                    <div className="font-arabic text-2xl text-primary mb-2">
                      {selectedVideo.title}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center hover:bg-foreground/5 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-glow">
                    <Play className="w-8 h-8 text-primary-foreground ml-1" />
                  </div>
                </button>
              </>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No videos available yet
            </div>
          )}
        </div>

        {/* Video List */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {videos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No videos uploaded yet. Admin can add videos.
            </p>
          )}
          {videos.map((video) => {
            const unlocked = isUnlocked(video);
            return (
              <button
                key={video.id}
                onClick={() => handleVideoSelect(video)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedVideo?.id === video.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                } ${!unlocked && "opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {unlocked ? (
                      <Play className="w-5 h-5 text-primary" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {video.title}
                      </h4>
                      {unlocked && (
                        <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {(video.views || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {!unlocked && (
                    <Badge variant="secondary" className="text-xs">
                      ₦{video.unlock_fee}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPlayer;
