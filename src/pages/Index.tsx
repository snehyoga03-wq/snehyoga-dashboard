import { YogaHero } from "@/components/YogaHero";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCookie } from "@/lib/cookies";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already signed in
    const phone = getCookie('userPhone');
    if (phone) {
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get("returnUrl");
      navigate(returnUrl || '/dashboard');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <YogaHero />
    </div>
  );
};

export default Index;
