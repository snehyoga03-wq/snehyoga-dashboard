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
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/, "कृपया वैध भारतीय मोबाईल नंबर टाका"),
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
              subscription_plan: "Free plan",
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
    <section className="py-8 px-4 bg-gradient-to-br from-[#faf9f6] via-orange-50/30 to-rose-50/30 min-h-screen flex flex-col justify-center relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-rose-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>

      <div className="max-w-md mx-auto w-full relative z-10">
        
        {/* Logo and Welcome Message */}
        <div className="mb-10 text-center space-y-4">
          <div className="w-44 h-44 mx-auto bg-white rounded-full shadow-xl shadow-orange-500/10 p-1 flex items-center justify-center border border-orange-100/50 transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/ICON-SNEHYOGA-1024x1024-removebg-preview.png" 
              alt="Snehyoga Logo" 
              className="w-full h-full object-contain hover:rotate-3 transition-transform duration-500"
            />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-amber-600 drop-shadow-sm">
              स्नेहा योगा
            </h1>
            <p className="text-gray-600 font-semibold tracking-wide">
              तुमच्या डॅशबोर्डवर स्वागत आहे
            </p>
          </div>
        </div>

        {/* Registration Form - Isolated */}
        <form onSubmit={handleSubmit} className="space-y-5 mb-8 bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-orange-500/5">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">तुमचे नाव</label>
              <Input
                type="text"
                placeholder="उदा. स्नेहा पाटील"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-14 text-lg bg-white/50 border-gray-200/80 focus:border-orange-400 focus:ring-orange-400/20 rounded-xl transition-all shadow-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">WhatsApp नंबर</label>
              <Input
                type="tel"
                placeholder="उदा. 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                onBlur={() => setFormData({ ...formData, phone: formatPhone(formData.phone) })}
                className="h-14 text-lg bg-white/50 border-gray-200/80 focus:border-orange-400 focus:ring-orange-400/20 rounded-xl transition-all shadow-sm"
                maxLength={13}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 mt-4 text-lg font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
