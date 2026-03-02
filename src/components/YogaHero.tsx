import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { setCookie } from "@/lib/cookies";
import { formatPhone } from "@/lib/utils";

// Validation schema
const registrationSchema = z.object({
  name: z.string().min(2, "नाव किमान २ अक्षरांचे असावे"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "कृपया वैध भारतीय मोबाईल नंबर टाका"),
});

export const YogaHero = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl"); // This might come from url query if landing page supports it?
  // Actually YogaHero is usually on landing page. The user might be redirected to main page with query param?
  // If SessionRedirect redirects to "/login", YogaHero is NOT the login page. Login.tsx is.
  // BUT if user manually goes to landing page... wait.
  // The user requirement said "redirect to the main link if the user alredy log in the yogahero section".
  // SessionRedirect redirects to `/login`. Login.tsx is the target.
  // If YogaHero is just the home page registration/login form, we can support it too just in case.
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  // Get referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      registrationSchema.parse(formData);
      setIsLoading(true);

      const normalizedPhone = formatPhone(formData.phone);

      // Check if user with this phone number already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('main_data_registration')
        .select('*')
        .eq('mobile_number', normalizedPhone)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      let userId: string;
      let referralLink: string;

      if (existingUser) {
        // User exists - use their existing data
        userId = existingUser.id;
        referralLink = existingUser.referral_link;

        // Optionally update name if it changed
        if (existingUser.name !== formData.name) {
          await supabase
            .from('main_data_registration')
            .update({ name: formData.name })
            .eq('id', userId);
        }

        toast({
          title: "पुन्हा स्वागत आहे! 👋",
          description: "तुमच्या डॅशबोर्डवर स्वागत आहे",
        });
      } else {
        // New user - create entry
        const cleanName = formData.name.toLowerCase().replace(/\s+/g, '');
        const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const newUserReferralCode = `sneh${cleanName}${randomNumber}`;
        referralLink = `${window.location.origin}/?ref=${newUserReferralCode}`;

        const { data: newUser, error: insertError } = await supabase
          .from('main_data_registration')
          .insert([
            {
              name: formData.name,
              mobile_number: normalizedPhone,
              days_left: 1,
              referral_link: referralLink,
            }
          ])
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        userId = newUser.id;

        // Process referral if user came via referral link
        if (referralCode) {
          try {
            // Check for self-referral
            if (referralLink.includes(referralCode)) {
              console.log("Self-referral attempt blocked");
            } else {
              // Find referrer by looking up their referral code
              const { data: referrer } = await supabase
                .from('main_data_registration')
                .select('mobile_number, name, days_left')
                .ilike('referral_link', `%ref=${referralCode}%`)
                .maybeSingle();

              if (referrer) {
                // Check if this user was already referred
                const { data: existingReferral } = await supabase
                  .from('referrals')
                  .select('id')
                  .eq('referred_mobile', formData.phone)
                  .maybeSingle();

                if (!existingReferral) {
                  // Insert referral record
                  await supabase
                    .from('referrals')
                    .insert({
                      referrer_mobile: referrer.mobile_number,
                      referred_mobile: normalizedPhone,
                      referral_code: referralCode,
                      reward_days: 1,
                    });

                  // Add +7 days to referrer
                  await supabase
                    .from('main_data_registration')
                    .update({ days_left: (referrer.days_left || 0) + 1 })
                    .eq('mobile_number', referrer.mobile_number);

                  toast({
                    title: "रेफरल बोनस! 🎁",
                    description: `${referrer.name} ला +1 दिवस मिळाला!`,
                  });
                }
              }
            }
          } catch (refError) {
            console.error("Referral processing error:", refError);
            // Don't block registration if referral fails
          }
        }

        toast({
          title: "नोंदणी यशस्वी! ✅",
          description: "तुम्हाला 1 दिवसाची मोफत चाचणी मिळाली!",
        });
      }

      // Set cookies for session
      setCookie('userName', formData.name);
      setCookie('userPhone', normalizedPhone);

      // Navigate to dashboard or returnUrl
      navigate(returnUrl || '/dashboard');

    } catch (error: any) {
      if (error.errors) {
        toast({
          title: "चुकीची माहिती",
          description: error.errors[0]?.message || "कृपया तपासा आणि पुन्हा प्रयत्न करा",
          variant: "destructive",
        });
      } else {
        console.error("Registration error:", error);
        toast({
          title: "त्रुटी",
          description: `काहीतरी चूक झाली. (${error.message || "Unknown error"})`,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-8 px-4 bg-gradient-to-b from-background to-secondary/20 min-h-screen flex flex-col justify-center">
      <div className="max-w-md mx-auto text-center w-full">
        {/* Registration Form - Isolated */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <Input
            type="text"
            placeholder="तुमचे नाव"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-12 text-lg"
            required
          />
          <Input
            type="tel"
            placeholder="WhatsApp नंबर"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="h-12 text-lg"
            maxLength={10}
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-lg font-semibold text-white gradient-bg rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                प्रक्रिया सुरू...
              </span>
            ) : (
              "Login to Dashboard"
            )}
          </button>
        </form>
      </div>
    </section>
  );
};

export default YogaHero;
