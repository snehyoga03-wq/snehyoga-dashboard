import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import { formatPhone } from "@/lib/utils";

export const Signup = () => {
  const { referralCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const normalizedPhone = formatPhone(formData.phone);
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: formData.name,
            phone: normalizedPhone,
            referral_code: referralCode || null,
          },
        },
      });

      if (authError) throw authError;

      // Process referral using database function
      if (authData.user && referralCode) {
        const { error: refError } = await supabase.rpc('process_referral', {
          referred_user_id: authData.user.id,
          referral_code_input: referralCode,
        });

        if (refError) {
          console.error('Referral processing error:', refError);
        }
      }

      toast({
        title: "Success! ✅",
        description: "Your account has been created. You get 7 free days!",
      });

      // Store user data in localStorage
      localStorage.setItem('userData', JSON.stringify({
        id: authData.user?.id,
        name: formData.name,
        email: formData.email,
        phone: normalizedPhone,
      }));

      // Redirect to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Sign Up</h1>
        </div>

        {referralCode && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
            <p className="text-sm text-green-800 dark:text-green-200">
              🎉 You're signing up with referral code: <span className="font-bold">{referralCode}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Phone</label>
            <Input
              type="tel"
              placeholder="Your WhatsApp number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Sign Up & Get 7 Free Days"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <button
            onClick={() => navigate("/login")}
            className="text-primary hover:underline font-medium"
          >
            Login
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Signup;
