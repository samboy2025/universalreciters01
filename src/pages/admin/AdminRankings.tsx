import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Save, Loader2, Users, TrendingUp, Target, Award, Star, Settings2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SettingConfig {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  icon: any;
  unit?: string;
  type?: "number" | "text";
}

const RANKING_SETTINGS: SettingConfig[] = [
  {
    key: "ranking_max_points",
    label: "Maximum Points (Top Rank)",
    description: "The total points required to reach the top position on the leaderboard",
    defaultValue: "10000",
    icon: Trophy,
    unit: "pts",
    type: "number",
  },
  {
    key: "points_per_recitation",
    label: "Points Per Recitation",
    description: "Points awarded to a user for each completed recitation session",
    defaultValue: "100",
    icon: Award,
    unit: "pts",
    type: "number",
  },
  {
    key: "min_accuracy_for_points",
    label: "Minimum Accuracy for Points",
    description: "Minimum recitation accuracy score (%) required to earn points",
    defaultValue: "60",
    icon: Target,
    unit: "%",
    type: "number",
  },
  {
    key: "bonus_multiplier_perfect",
    label: "Perfect Score Bonus Multiplier",
    description: "Points multiplier for achieving 100% accuracy (e.g. 2 = double points)",
    defaultValue: "2",
    icon: Star,
    unit: "×",
    type: "number",
  },
  {
    key: "leaderboard_display_count",
    label: "Leaderboard Display Count",
    description: "Number of top users to display on the leaderboard",
    defaultValue: "20",
    icon: Users,
    unit: "users",
    type: "number",
  },
];

interface TopUser {
  id: string;
  name: string;
  points: number;
  ward: string;
  lga: string;
  state: string;
}

const AdminRankings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .in("key", RANKING_SETTINGS.map(s => s.key));

    const map: Record<string, string> = {};
    RANKING_SETTINGS.forEach(s => { map[s.key] = s.defaultValue; });
    data?.forEach(row => { map[row.key] = row.value; });
    setSettings(map);
    setOriginalSettings({ ...map });
    setIsLoading(false);
  };

  const fetchTopUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, points, ward, lga, state")
      .order("points", { ascending: false })
      .limit(10);
    if (data) setTopUsers(data);
  };

  useEffect(() => {
    fetchSettings();
    fetchTopUsers();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { data: existing } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", key)
          .single();

        if (existing) {
          await supabase
            .from("app_settings")
            .update({ value, updated_by: user?.id, updated_at: new Date().toISOString() })
            .eq("key", key);
        } else {
          await supabase
            .from("app_settings")
            .insert({
              key,
              value,
              description: RANKING_SETTINGS.find(s => s.key === key)?.description || "",
              updated_by: user?.id,
            });
        }
      }
      setOriginalSettings({ ...settings });
      toast({ title: "Ranking settings saved successfully" });
    } catch (error: any) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ranking Control</h1>
            <p className="text-muted-foreground">Configure points system and leaderboard settings</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Points & Ranking Configuration
                </CardTitle>
                <CardDescription>
                  Configure how users earn and display points across the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  RANKING_SETTINGS.map((setting) => {
                    const Icon = setting.icon;
                    return (
                      <div key={setting.key} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {setting.label}
                        </Label>
                        <div className="relative">
                          <Input
                            type={setting.type || "number"}
                            value={settings[setting.key] || setting.defaultValue}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, [setting.key]: e.target.value }))
                            }
                            className="pr-12"
                          />
                          {setting.unit && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                              {setting.unit}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {hasChanges && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-sm text-primary font-medium">⚠️ You have unsaved changes</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Save Settings" to apply your changes.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live Leaderboard Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Current Top 10 Reciters
                </CardTitle>
                <CardDescription>Live preview of the national leaderboard</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {topUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No users ranked yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topUsers.map((u, i) => {
                        const maxPts = parseInt(settings.ranking_max_points || "10000");
                        const pct = Math.min(100, Math.round((u.points / maxPts) * 100));
                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <span className="text-lg">{getRankIcon(i + 1)}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {u.name?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                                  <p className="text-xs text-muted-foreground">{u.lga}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-bold text-foreground">{u.points.toLocaleString()}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{pct}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm text-foreground mb-2">💡 How Points Work</h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Users earn <strong>{settings.points_per_recitation || 100} pts</strong> per recitation</li>
                  <li>• Minimum accuracy required: <strong>{settings.min_accuracy_for_points || 60}%</strong></li>
                  <li>• Perfect score gives <strong>{settings.bonus_multiplier_perfect || 2}× bonus</strong></li>
                  <li>• Top rank requires <strong>{parseInt(settings.ranking_max_points || "10000").toLocaleString()} pts</strong></li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRankings;
