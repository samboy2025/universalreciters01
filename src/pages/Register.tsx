import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, UserPlus, Loader2, CreditCard, Key, CheckCircle } from "lucide-react";

const nigeriaStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

const REGISTRATION_FEE = 1000; // ₦1,000

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    ward: "", lga: "", state: "", country: "Nigeria",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"paystack" | "pin" | null>(null);
  const [redemptionPin, setRedemptionPin] = useState("");
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        toast({ title: "Missing information", description: "Please fill in all required fields.", variant: "destructive" });
        return;
      }
      if (formData.password.length < 6) {
        toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
        return;
      }
    }
    if (step === 2) {
      if (!formData.ward || !formData.lga || !formData.state) {
        toast({ title: "Missing location", description: "Please fill in all location fields.", variant: "destructive" });
        return;
      }
    }
    setStep(step + 1);
  };

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).PaystackPop) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paystack"));
      document.head.appendChild(script);
    });
  };

  const handlePaystackPayment = async () => {
    setIsLoading(true);
    try {
      await loadPaystackScript();

      // Fetch public key from edge function or use env
      const { data: secretData } = await supabase.functions.invoke("get-paystack-key");
      const publicKey = secretData?.publicKey;
      if (!publicKey) {
        toast({ title: "Payment setup error", description: "Could not load payment gateway.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const paystack = new (window as any).PaystackPop();
      paystack.newTransaction({
        key: publicKey,
        email: formData.email,
        amount: REGISTRATION_FEE * 100, // Convert to kobo
        currency: "NGN",
        metadata: {
          custom_fields: [
            { display_name: "Purpose", variable_name: "purpose", value: "registration_fee" },
            { display_name: "Name", variable_name: "name", value: formData.name },
          ],
        },
        onSuccess: async (transaction: any) => {
          // Verify payment on server
          const { data: verifyData } = await supabase.functions.invoke("verify-paystack", {
            body: { reference: transaction.reference },
          });
          if (verifyData?.success) {
            setPaymentCompleted(true);
            setPaymentReference(transaction.reference);
            toast({ title: "Payment successful!", description: "₦1,000 registration fee paid." });
          } else {
            toast({ title: "Payment verification failed", variant: "destructive" });
          }
          setIsLoading(false);
        },
        onCancel: () => {
          toast({ title: "Payment cancelled", variant: "destructive" });
          setIsLoading(false);
        },
      });
    } catch (err: any) {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handlePinPayment = async () => {
    if (!redemptionPin) {
      toast({ title: "Enter a valid PIN", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // Verify pin exists and has value >= 1000 using a direct check
      const { data: pinData } = await supabase
        .from("redemption_pins")
        .select("*")
        .eq("pin_code", redemptionPin.toUpperCase())
        .eq("is_redeemed", false)
        .single();

      if (!pinData) {
        toast({ title: "Invalid or already used PIN", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (pinData.value < REGISTRATION_FEE) {
        toast({ title: "PIN value too low", description: `PIN value ₦${Number(pinData.value).toLocaleString()} is less than the ₦${REGISTRATION_FEE.toLocaleString()} registration fee.`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Mark pin as redeemed (will be used during registration)
      setPaymentCompleted(true);
      setPaymentReference(`PIN:${redemptionPin.toUpperCase()}`);
      toast({ title: "PIN verified!", description: "You can now complete registration." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentCompleted) {
      toast({ title: "Payment required", description: "Please complete the registration fee payment first.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const referralCode = searchParams.get("ref") || undefined;

      const { error } = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        ward: formData.ward,
        lga: formData.lga,
        state: formData.state,
        country: formData.country,
      });

      if (error) {
        let message = error.message;
        if (message.includes("already registered")) {
          message = "This email is already registered. Please login instead.";
        }
        toast({ title: "Registration failed", description: message, variant: "destructive" });
      } else {
        // If paid with PIN, redeem it now
        if (paymentReference.startsWith("PIN:")) {
          const pinCode = paymentReference.replace("PIN:", "");
          // We'll mark the pin as redeemed - the balance goes to the platform, not the user
          await supabase
            .from("redemption_pins")
            .update({ is_redeemed: true, redeemed_at: new Date().toISOString() })
            .eq("pin_code", pinCode);
        }

        toast({ title: "Registration successful!", description: "Welcome to Universal Reciters!" });
        navigate("/dashboard");
      }
    } catch (error) {
      toast({ title: "Registration failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero islamic-pattern">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero islamic-pattern p-4 py-12">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <Link to="/" className="inline-block mb-4">
            <Logo size="lg" className="mx-auto" />
          </Link>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join Universal Reciters and start your journey</CardDescription>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : s < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Step {step} of 3: {step === 1 ? "Account Info" : step === 2 ? "Location" : "Payment"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Enter your full name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Create a password (min 6 chars)" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" placeholder="Confirm your password" value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} required />
                </div>
                <Button type="button" className="w-full" onClick={handleNext}>Continue</Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={formData.country} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(value) => handleChange("state", value)}>
                    <SelectTrigger><SelectValue placeholder="Select your state" /></SelectTrigger>
                    <SelectContent>
                      {nigeriaStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lga">Local Government Area (LGA)</Label>
                  <Input id="lga" placeholder="Enter your LGA" value={formData.lga} onChange={(e) => handleChange("lga", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ward">Ward</Label>
                  <Input id="ward" placeholder="Enter your ward" value={formData.ward} onChange={(e) => handleChange("ward", e.target.value)} required />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button type="button" className="flex-1" onClick={handleNext}>Continue</Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">Registration Fee</p>
                  <p className="text-3xl font-bold text-foreground mt-1">₦{REGISTRATION_FEE.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">One-time payment to activate your account</p>
                </div>

                {paymentCompleted ? (
                  <div className="bg-success/10 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Payment Confirmed!</p>
                      <p className="text-xs text-muted-foreground">Ref: {paymentReference}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {!paymentMethod && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground text-center">Choose payment method:</p>
                        <Button type="button" className="w-full" onClick={() => setPaymentMethod("paystack")}>
                          <CreditCard className="w-4 h-4 mr-2" />Pay with Paystack
                        </Button>
                        <Button type="button" variant="outline" className="w-full" onClick={() => setPaymentMethod("pin")}>
                          <Key className="w-4 h-4 mr-2" />Use Redemption Code
                        </Button>
                      </div>
                    )}

                    {paymentMethod === "paystack" && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">You will be redirected to Paystack to complete payment of ₦{REGISTRATION_FEE.toLocaleString()}</p>
                        <Button type="button" className="w-full" onClick={handlePaystackPayment} disabled={isLoading}>
                          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                          {isLoading ? "Processing..." : `Pay ₦${REGISTRATION_FEE.toLocaleString()}`}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPaymentMethod(null)}>
                          ← Choose another method
                        </Button>
                      </div>
                    )}

                    {paymentMethod === "pin" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Enter Redemption Code</Label>
                          <Input placeholder="Enter your PIN code" value={redemptionPin} onChange={(e) => setRedemptionPin(e.target.value.toUpperCase())} />
                        </div>
                        <Button type="button" className="w-full" onClick={handlePinPayment} disabled={isLoading}>
                          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                          {isLoading ? "Verifying..." : "Verify & Pay"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPaymentMethod(null)}>
                          ← Choose another method
                        </Button>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={isLoading || !paymentCompleted}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Complete Registration
                  </Button>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
