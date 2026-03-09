import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, ArrowDownLeft, CreditCard, Plus, Trash2, Loader2, Check, X,
  Download, Building2, RefreshCw, Tag, Copy
} from "lucide-react";

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code: string | null;
  status: string;
  admin_note: string | null;
  created_at: string | null;
  processed_at: string | null;
  userName?: string;
  userEmail?: string;
}

interface Pin {
  id: string;
  pin_code: string;
  value: number;
  is_redeemed: boolean | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string | null;
}

interface Bank {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
}

const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" }, { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" }, { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" }, { name: "First City Monument Bank", code: "214" },
  { name: "Globus Bank", code: "00103" }, { name: "Guaranty Trust Bank", code: "058" },
  { name: "Heritage Bank", code: "030" }, { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" }, { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" }, { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" }, { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" }, { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" }, { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa", code: "033" }, { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank", code: "566" }, { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

const generatePinCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pin = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) pin += "-";
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
};

const AdminWallet = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; withdrawal: WithdrawalRequest | null }>({ open: false, withdrawal: null });
  const [adminNote, setAdminNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pinAmount, setPinAmount] = useState(500);
  const [pinCount, setPinCount] = useState(10);
  const [isGeneratingPins, setIsGeneratingPins] = useState(false);
  const [newBank, setNewBank] = useState({ name: "", code: "" });
  const [isAddingBank, setIsAddingBank] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAll = async () => {
    setIsLoading(true);
    const [wRes, pRes, bRes] = await Promise.all([
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("redemption_pins").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("banks").select("*").order("name", { ascending: true }),
    ]);

    if (wRes.data) {
      // Fetch user profiles separately
      const userIds = [...new Set(wRes.data.map(w => w.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      const profileMap: Record<string, { name: string; email: string }> = {};
      profiles?.forEach(p => { profileMap[p.id] = { name: p.name, email: p.email }; });

      setWithdrawals(wRes.data.map(w => ({
        ...w,
        userName: profileMap[w.user_id]?.name || "Unknown",
        userEmail: profileMap[w.user_id]?.email || "",
      })));
    }
    if (pRes.data) setPins(pRes.data);
    if (bRes.data) setBanks(bRes.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async () => {
    if (!reviewDialog.withdrawal) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "approved",
          admin_note: adminNote || null,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", reviewDialog.withdrawal.id);
      if (error) throw error;
      toast({ title: "Withdrawal approved" });
      setReviewDialog({ open: false, withdrawal: null });
      setAdminNote("");
      fetchAll();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewDialog.withdrawal) return;
    setIsProcessing(true);
    try {
      const w = reviewDialog.withdrawal;
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          admin_note: adminNote || null,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", w.id);
      if (error) throw error;

      // Refund balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("money_balance")
        .eq("id", w.user_id)
        .single();
      if (profile) {
        await supabase
          .from("profiles")
          .update({ money_balance: (profile.money_balance || 0) + Number(w.amount) })
          .eq("id", w.user_id);
      }

      toast({ title: "Withdrawal rejected and balance refunded" });
      setReviewDialog({ open: false, withdrawal: null });
      setAdminNote("");
      fetchAll();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePins = async () => {
    if (pinCount < 1 || pinCount > 500) {
      toast({ title: "PIN count must be between 1 and 500", variant: "destructive" });
      return;
    }
    setIsGeneratingPins(true);
    try {
      const pinsToInsert = Array.from({ length: pinCount }, () => ({
        pin_code: generatePinCode(),
        value: pinAmount,
        created_by: user?.id,
      }));
      const { error } = await supabase.from("redemption_pins").insert(pinsToInsert);
      if (error) throw error;
      toast({ title: `${pinCount} PINs generated successfully` });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Error generating PINs", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingPins(false);
    }
  };

  const exportPins = () => {
    const unusedPins = pins.filter(p => !p.is_redeemed);
    const csv = ["PIN Code,Value,Created At", ...unusedPins.map(p =>
      `${p.pin_code},${p.value},${new Date(p.created_at || "").toLocaleDateString()}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemption-pins-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${unusedPins.length} unused PINs` });
  };

  const copyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast({ title: "PIN copied to clipboard" });
  };

  const handleAddBank = async () => {
    if (!newBank.name.trim() || !newBank.code.trim()) {
      toast({ title: "Bank name and code are required", variant: "destructive" });
      return;
    }
    setIsAddingBank(true);
    try {
      const { error } = await supabase.from("banks").insert({ name: newBank.name.trim(), code: newBank.code.trim() });
      if (error) throw error;
      toast({ title: "Bank added successfully" });
      setNewBank({ name: "", code: "" });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Error adding bank", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingBank(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Remove this bank?")) return;
    const { error } = await supabase.from("banks").delete().eq("id", id);
    if (!error) {
      toast({ title: "Bank removed" });
      fetchAll();
    }
  };

  const handleToggleBank = async (bank: Bank) => {
    await supabase.from("banks").update({ is_active: !bank.is_active }).eq("id", bank.id);
    fetchAll();
  };

  const seedNigerianBanks = async () => {
    if (!confirm(`Seed ${NIGERIAN_BANKS.length} Nigerian banks into the system?`)) return;
    try {
      const { error } = await supabase.from("banks").upsert(
        NIGERIAN_BANKS.map(b => ({ name: b.name, code: b.code, is_active: true })),
        { onConflict: "code" }
      );
      if (error) throw error;
      toast({ title: `${NIGERIAN_BANKS.length} Nigerian banks seeded successfully` });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Error seeding banks", description: error.message, variant: "destructive" });
    }
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
  const totalPending = pendingWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const unusedPins = pins.filter(p => !p.is_redeemed).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "approved": return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet Management</h1>
          <p className="text-muted-foreground">Manage withdrawals, redemption PINs, and Nigerian banks</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{pendingWithdrawals.length}</p>
              <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">₦{totalPending.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Pending Amount</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{unusedPins}</p>
              <p className="text-sm text-muted-foreground">Active PINs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{banks.filter(b => b.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Active Banks</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="withdrawals">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="withdrawals" className="gap-2">
              <ArrowDownLeft className="w-4 h-4" /> Withdrawals
              {pendingWithdrawals.length > 0 && (
                <Badge variant="destructive" className="text-xs h-4 px-1">{pendingWithdrawals.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-2">
              <Tag className="w-4 h-4" /> PINs
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-2">
              <Building2 className="w-4 h-4" /> Banks
            </TabsTrigger>
          </TabsList>

          {/* ============ WITHDRAWALS TAB ============ */}
          <TabsContent value="withdrawals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Withdrawal Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : withdrawals.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No withdrawal requests yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Bank Details</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{w.userName}</p>
                            <p className="text-xs text-muted-foreground">{w.userEmail}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-foreground">{w.bank_name}</p>
                            <p className="text-xs text-muted-foreground">{w.account_number}</p>
                            <p className="text-xs text-muted-foreground">{w.account_name}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-bold text-foreground">₦{Number(w.amount).toLocaleString()}</p>
                          </TableCell>
                          <TableCell>{getStatusBadge(w.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(w.created_at || "").toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {w.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReviewDialog({ open: true, withdrawal: w }); setAdminNote(""); }}
                              >
                                Review
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ PINS TAB ============ */}
          <TabsContent value="pins" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    Generate PINs
                  </CardTitle>
                  <CardDescription>Create coupon-style redemption codes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>PIN Value (₦)</Label>
                    <Input
                      type="number"
                      min="100"
                      step="100"
                      value={pinAmount}
                      onChange={(e) => setPinAmount(parseInt(e.target.value) || 500)}
                    />
                    <p className="text-xs text-muted-foreground">Amount each PIN adds to user balance</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of PINs</Label>
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={pinCount}
                      onChange={(e) => setPinCount(parseInt(e.target.value) || 10)}
                    />
                  </div>
                  <Button onClick={handleGeneratePins} disabled={isGeneratingPins} className="w-full">
                    {isGeneratingPins ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate {pinCount} PINs
                  </Button>
                  <Button variant="outline" onClick={exportPins} className="w-full" disabled={unusedPins === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Unused PINs (CSV)
                  </Button>
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                    <p><span className="font-medium">{pins.length}</span> total PINs</p>
                    <p className="text-success"><span className="font-medium">{unusedPins}</span> unused</p>
                    <p className="text-muted-foreground"><span className="font-medium">{pins.length - unusedPins}</span> redeemed</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recent PINs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    {pins.length === 0 ? (
                      <div className="text-center py-8">
                        <Tag className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No PINs generated yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PIN Code</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pins.map((pin) => (
                            <TableRow key={pin.id}>
                              <TableCell>
                                <code className="font-mono text-sm bg-muted px-2 py-1 rounded tracking-widest">
                                  {pin.pin_code}
                                </code>
                              </TableCell>
                              <TableCell className="font-medium">₦{Number(pin.value).toLocaleString()}</TableCell>
                              <TableCell>
                                {pin.is_redeemed ? (
                                  <Badge variant="secondary">Redeemed</Badge>
                                ) : (
                                  <Badge className="bg-success text-success-foreground">Active</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(pin.created_at || "").toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {!pin.is_redeemed && (
                                  <Button variant="ghost" size="sm" onClick={() => copyPin(pin.pin_code)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ BANKS TAB ============ */}
          <TabsContent value="banks" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Add Bank
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Input
                      placeholder="e.g. Zenith Bank"
                      value={newBank.name}
                      onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Code *</Label>
                    <Input
                      placeholder="e.g. 057"
                      value={newBank.code}
                      onChange={(e) => setNewBank({ ...newBank, code: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">CBN bank routing code</p>
                  </div>
                  <Button onClick={handleAddBank} disabled={isAddingBank} className="w-full">
                    {isAddingBank ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Bank
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={seedNigerianBanks} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Seed All Nigerian Banks
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Available Banks ({banks.length})</CardTitle>
                  <CardDescription>Banks users can select for withdrawal</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : banks.length === 0 ? (
                      <div className="text-center py-8">
                        <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No banks added yet</p>
                        <p className="text-xs text-muted-foreground">Use "Seed All Nigerian Banks" to get started</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bank Name</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {banks.map((bank) => (
                            <TableRow key={bank.id}>
                              <TableCell className="font-medium text-foreground">{bank.name}</TableCell>
                              <TableCell>
                                <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{bank.code}</code>
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => handleToggleBank(bank)}
                                  className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                                    bank.is_active
                                      ? "bg-success/10 text-success hover:bg-success/20"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {bank.is_active ? "Active" : "Inactive"}
                                </button>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteBank(bank.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Withdrawal Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ open, withdrawal: open ? reviewDialog.withdrawal : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Withdrawal Request</DialogTitle>
          </DialogHeader>
          {reviewDialog.withdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User</span>
                  <span className="text-sm font-medium">{reviewDialog.withdrawal.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-lg font-bold text-foreground">₦{Number(reviewDialog.withdrawal.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Bank</span>
                  <span className="text-sm font-medium">{reviewDialog.withdrawal.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account No.</span>
                  <span className="text-sm font-mono">{reviewDialog.withdrawal.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Name</span>
                  <span className="text-sm">{reviewDialog.withdrawal.account_name}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Note (optional)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note for the user..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  Reject & Refund
                </Button>
                <Button
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWallet;
